import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import type { UseRealtimeEventsOptions } from '../src/realtime/useRealtimeEvents.ts'
import type { RealtimeEvent } from '../src/realtime/types.ts'

// Mock EventSource implementation
class MockEventSource {
  public static instances: MockEventSource[] = []
  public static openInstances: MockEventSource[] = []

  public url: string
  public options?: { withCredentials?: boolean }
  public onopen: (() => void) | null = null
  public onmessage: ((event: { data: string }) => void) | null = null
  public onerror: ((error: any) => void) | null = null
  public closed = false

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url
    this.options = options
    MockEventSource.instances.push(this)
    MockEventSource.openInstances.push(this)
  }

  public simulateOpen() {
    if (this.onopen && !this.closed) {
      this.onopen()
    }
  }

  public simulateMessage(data: string) {
    if (this.onmessage && !this.closed) {
      this.onmessage({ data })
    }
  }

  public simulateError(err?: any) {
    if (this.onerror && !this.closed) {
      this.onerror(err ?? new Error('SSE connection error'))
    }
  }

  public close() {
    this.closed = true
    MockEventSource.openInstances = MockEventSource.openInstances.filter((i) => i !== this)
  }

  public static reset() {
    MockEventSource.instances = []
    MockEventSource.openInstances = []
  }
}

// Ensure globalThis.EventSource is available for testing in Node
;(globalThis as any).EventSource = MockEventSource

// Lightweight React Hook Test Harness
function createHookHarness(hookFn: (props: UseRealtimeEventsOptions) => any, initialProps: UseRealtimeEventsOptions) {
  let stateIndex = 0
  let refIndex = 0
  let callbackIndex = 0
  let effectIndex = 0

  const states: any[] = []
  const stateSetters: Array<(val: any) => void> = []
  const refs: Array<{ current: any }> = []
  const callbacks: Array<{ fn: any; deps: any[] | undefined }> = []
  const effects: Array<{
    effect: () => (() => void) | void
    deps: any[] | undefined
    cleanup?: (() => void) | void
    hasChanged: boolean
  }> = []

  let isMounted = true
  let isRendering = false
  let hasQueuedStateUpdate = false
  let currentResult: any = null
  let currentProps = initialProps

  const mockReact = {
    useState<T>(initialValue: T | (() => T)): [T, (val: T | ((prev: T) => T)) => void] {
      const idx = stateIndex++
      if (states.length <= idx) {
        const val = typeof initialValue === 'function' ? (initialValue as any)() : initialValue
        states[idx] = val
        stateSetters[idx] = (newVal: any) => {
          const resolved = typeof newVal === 'function' ? newVal(states[idx]) : newVal
          states[idx] = resolved
          if (isMounted) {
            if (isRendering) {
              hasQueuedStateUpdate = true
            } else {
              runRender()
            }
          }
        }
      }
      return [states[idx], stateSetters[idx]]
    },

    useRef<T>(initialValue: T): { current: T } {
      const idx = refIndex++
      if (refs.length <= idx) {
        refs[idx] = { current: initialValue }
      }
      return refs[idx]
    },

    useCallback<T extends (...args: any[]) => any>(fn: T, deps: any[]): T {
      const idx = callbackIndex++
      if (callbacks.length <= idx) {
        callbacks[idx] = { fn, deps }
        return fn
      }

      const prev = callbacks[idx]
      const hasChanged = !deps || !prev.deps || deps.some((dep, i) => !Object.is(dep, prev.deps![i]))
      if (hasChanged) {
        callbacks[idx] = { fn, deps }
        return fn
      }
      return prev.fn
    },

    useEffect(effect: () => (() => void) | void, deps?: any[]) {
      const idx = effectIndex++
      if (effects.length <= idx) {
        effects[idx] = { effect, deps, hasChanged: true }
        return
      }

      const prev = effects[idx]
      const hasChanged = !deps || !prev.deps || deps.some((dep, i) => !Object.is(dep, prev.deps![i]))
      effects[idx] = { effect, deps, cleanup: prev.cleanup, hasChanged }
    },
  }

  function runRender() {
    if (isRendering) return
    isRendering = true
    try {
      stateIndex = 0
      refIndex = 0
      callbackIndex = 0
      effectIndex = 0

      const ReactCurrentDispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher
      const prevDispatcher = ReactCurrentDispatcher?.current

      if (ReactCurrentDispatcher) {
        ReactCurrentDispatcher.current = mockReact
      }

      try {
        currentResult = hookFn(currentProps)
      } finally {
        if (ReactCurrentDispatcher) {
          ReactCurrentDispatcher.current = prevDispatcher
        }
      }

      // Execute scheduled effects after render only if deps changed
      for (const record of effects) {
        if (record.hasChanged) {
          if (record.cleanup) {
            record.cleanup()
            record.cleanup = undefined
          }
          record.cleanup = record.effect()
          record.hasChanged = false
        }
      }
    } finally {
      isRendering = false
    }

    if (hasQueuedStateUpdate && isMounted) {
      hasQueuedStateUpdate = false
      runRender()
    }
  }

  // Initial render
  runRender()

  return {
    get result() {
      return currentResult
    },
    rerender(nextProps: UseRealtimeEventsOptions) {
      currentProps = nextProps
      runRender()
    },
    unmount() {
      isMounted = false
      for (const record of effects) {
        if (record.cleanup) {
          record.cleanup()
          record.cleanup = undefined
        }
      }
    },
  }
}

// Now let's test useRealtimeEvents
import { useRealtimeEvents } from '../src/realtime/useRealtimeEvents.ts'

test('EventSource maintains a single connection across multiple re-renders with new callback references', () => {
  MockEventSource.reset()

  let refreshCallCount = 0
  const user = { id: 'u-1', roleCode: 'DIRECTOR' }

  // Initial render with callback #1
  const harness = createHookHarness(useRealtimeEvents, {
    user,
    apiRoot: '/api/v1',
    onRefreshScopes: () => {
      refreshCallCount++
    },
  })

  assert.equal(MockEventSource.instances.length, 1, 'Exactly 1 EventSource instance should be created initially')
  const initialEs = MockEventSource.instances[0]
  assert.equal(initialEs.closed, false)

  initialEs.simulateOpen()
  assert.equal(harness.result.connectionState, 'connected')

  // Re-render #1 with a NEW inline function for onRefreshScopes and onRecordDeleted
  harness.rerender({
    user,
    apiRoot: '/api/v1',
    onRefreshScopes: () => {
      refreshCallCount += 2
    },
    onRecordDeleted: () => {},
  })

  // Re-render #2 with another NEW inline function
  harness.rerender({
    user,
    apiRoot: '/api/v1',
    onRefreshScopes: () => {
      refreshCallCount += 3
    },
    onRecordDeleted: () => {},
  })

  // Re-render #3
  harness.rerender({
    user,
    apiRoot: '/api/v1',
    onRefreshScopes: () => {
      refreshCallCount += 4
    },
  })

  // CRITICAL ASSERTION: No new EventSource instances created, initial connection stayed alive!
  assert.equal(MockEventSource.instances.length, 1, 'Re-renders must NOT create new EventSource instances')
  assert.equal(initialEs.closed, false, 'Initial EventSource connection must NOT be closed on re-render')

  harness.unmount()
})

test('EventSource is properly closed on unmount or user logout', () => {
  MockEventSource.reset()
  const user = { id: 'u-1', roleCode: 'DIRECTOR' }

  const harness = createHookHarness(useRealtimeEvents, {
    user,
    apiRoot: '/api/v1',
  })

  assert.equal(MockEventSource.instances.length, 1)
  const es = MockEventSource.instances[0]
  assert.equal(es.closed, false)

  // Logout (user becomes null)
  harness.rerender({
    user: null,
    apiRoot: '/api/v1',
  })

  assert.equal(es.closed, true, 'EventSource must be closed when user logs out')
  assert.equal(harness.result.connectionState, 'idle')

  // Log back in
  harness.rerender({
    user: { id: 'u-2', roleCode: 'DATA_ADMIN' },
    apiRoot: '/api/v1',
  })

  assert.equal(MockEventSource.instances.length, 2, 'New EventSource created for new user session')
  const newEs = MockEventSource.instances[1]
  assert.equal(newEs.closed, false)

  // Unmount
  harness.unmount()
  assert.equal(newEs.closed, true, 'EventSource must be closed on component unmount')
})

test('valid SSE message triggers throttled onRefreshScopes and enqueues notification', async () => {
  MockEventSource.reset()
  const refreshedScopes: string[][] = []

  const harness = createHookHarness(useRealtimeEvents, {
    user: { id: 'u-1', roleCode: 'DIRECTOR' },
    apiRoot: '/api/v1',
    onRefreshScopes: (scopes) => {
      refreshedScopes.push(scopes)
    },
  })

  const es = MockEventSource.instances[0]
  es.simulateOpen()

  const sampleEvent: RealtimeEvent = {
    id: 'evt-100',
    type: 'field_report.created',
    entityType: 'field_report',
    entityId: 'rep-1',
    action: 'CREATE',
    occurredAt: new Date().toISOString(),
    data: {
      code: 'BC-2026-001',
      title: 'Hư hỏng mặt đường',
      parkName: 'KCN An Phú',
      reporterName: 'Huỳnh Hữu Hợp',
      category: 'INCIDENT',
      severity: 'HIGH',
    },
  }

  // Simulate incoming SSE message
  es.simulateMessage(JSON.stringify(sampleEvent))

  // Wait 180ms for 150ms throttle timer to flush
  await new Promise((r) => setTimeout(r, 180))

  assert.equal(refreshedScopes.length, 1, 'onRefreshScopes should be called once')
  assert.deepEqual(refreshedScopes[0], ['field_reports'])

  // Check notification
  assert.notEqual(harness.result.currentNotification, null, 'Notification pill should be displayed')
  assert.equal(harness.result.currentNotification?.title, 'Hư hỏng mặt đường')
  assert.equal(harness.result.currentNotification?.action, 'CREATE')

  harness.unmount()
})

test('duplicate event IDs are suppressed and do not trigger duplicate refresh or notifications', async () => {
  MockEventSource.reset()
  let refreshCount = 0

  const harness = createHookHarness(useRealtimeEvents, {
    user: { id: 'u-1', roleCode: 'DIRECTOR' },
    apiRoot: '/api/v1',
    onRefreshScopes: () => {
      refreshCount++
    },
  })

  const es = MockEventSource.instances[0]
  es.simulateOpen()

  const eventJson = JSON.stringify({
    id: 'evt-dup',
    type: 'incident.created',
    entityType: 'incident',
    entityId: 'inc-1',
    action: 'CREATE',
    occurredAt: new Date().toISOString(),
    data: { title: 'Sự cố chập điện' },
  })

  // First dispatch
  es.simulateMessage(eventJson)
  await new Promise((r) => setTimeout(r, 180))
  assert.equal(refreshCount, 1)

  // Second dispatch with same event ID
  es.simulateMessage(eventJson)
  await new Promise((r) => setTimeout(r, 180))
  assert.equal(refreshCount, 1, 'Duplicate event ID must be suppressed')

  harness.unmount()
})

test('heartbeats and malformed SSE data do not produce notifications or refresh calls', async () => {
  MockEventSource.reset()
  let refreshCount = 0

  const harness = createHookHarness(useRealtimeEvents, {
    user: { id: 'u-1', roleCode: 'DIRECTOR' },
    apiRoot: '/api/v1',
    onRefreshScopes: () => {
      refreshCount++
    },
  })

  const es = MockEventSource.instances[0]
  es.simulateOpen()

  // Heartbeat comment or empty string
  es.simulateMessage('')
  es.simulateMessage('   ')
  es.simulateMessage('not-a-json')
  es.simulateMessage('{}') // Missing id/type

  await new Promise((r) => setTimeout(r, 180))

  assert.equal(refreshCount, 0, 'No refresh call should be made for invalid or heartbeat messages')
  assert.equal(harness.result.currentNotification, null, 'No notification should be enqueued for heartbeats')

  harness.unmount()
})
