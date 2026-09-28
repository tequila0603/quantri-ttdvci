import { useEffect, useRef, useState, useCallback } from 'react'
import type {
  NotificationItem,
  RealtimeEvent,
  RefreshScope,
} from './types.js'
import {
  parseRealtimeEvent,
  isDuplicateEvent,
  recordEventId,
  mapEventToRefreshTargets,
  mapEventToNotification,
  enqueueNotification,
} from './eventHelpers.js'

export type UseRealtimeEventsOptions = {
  user: { id: string; roleCode: string } | null
  apiRoot?: string
  onRefreshScopes?: (scopes: RefreshScope[]) => void
  onRecordUpdated?: (event: RealtimeEvent) => void
  onRecordDeleted?: (event: RealtimeEvent) => void
}

export function useRealtimeEvents({
  user,
  apiRoot = '/api/v1',
  onRefreshScopes,
  onRecordUpdated,
  onRecordDeleted,
}: UseRealtimeEventsOptions) {
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle')
  const [queue, setQueue] = useState<NotificationItem[]>([])
  const [currentNotification, setCurrentNotification] = useState<NotificationItem | null>(null)

  const onRefreshScopesRef = useRef(onRefreshScopes)
  onRefreshScopesRef.current = onRefreshScopes

  const onRecordUpdatedRef = useRef(onRecordUpdated)
  onRecordUpdatedRef.current = onRecordUpdated

  const onRecordDeletedRef = useRef(onRecordDeleted)
  onRecordDeletedRef.current = onRecordDeleted

  const eventSourceRef = useRef<EventSource | null>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const readyRef = useRef(false)
  const pendingScopesRef = useRef<Set<RefreshScope>>(new Set())
  const throttleTimerRef = useRef<any>(null)
  const fallbackTimerRef = useRef<any>(null)
  const disconnectedAtRef = useRef<number | null>(null)

  // Flush batched refresh scopes (150ms debounce/throttle)
  const scheduleScopeRefresh = useCallback((scopes: RefreshScope[]) => {
    for (const scope of scopes) {
      pendingScopesRef.current.add(scope)
    }

    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setTimeout(() => {
        const scopesToRefresh = Array.from(pendingScopesRef.current)
        pendingScopesRef.current.clear()
        throttleTimerRef.current = null

        if (scopesToRefresh.length > 0 && onRefreshScopesRef.current) {
          onRefreshScopesRef.current(scopesToRefresh)
        }
      }, 150)
    }
  }, [])

  // Dismiss current notification and advance queue
  const dismissCurrentNotification = useCallback(() => {
    setQueue((prevQueue) => {
      if (prevQueue.length > 0) {
        const [next, ...rest] = prevQueue
        setCurrentNotification(next)
        return rest
      }
      setCurrentNotification(null)
      return []
    })
  }, [])

  // If no notification is active but items are in queue, show next item
  useEffect(() => {
    if (!currentNotification && queue.length > 0) {
      const [next, ...rest] = queue
      setCurrentNotification(next)
      setQueue(rest)
    }
  }, [currentNotification, queue])

  // Connect single EventSource when user is logged in
  useEffect(() => {
    if (!user) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setConnectionState('idle')
      setCurrentNotification(null)
      setQueue([])
      readyRef.current = false
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
      return
    }

    const sseUrl = `${apiRoot}/realtime/events`
    let isCancelled = false

    const connect = () => {
      if (isCancelled) return
      setConnectionState('connecting')

      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      const eventSource = new EventSource(sseUrl, { withCredentials: true })
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        if (isCancelled) return
        setConnectionState('connected')

        // If reconnecting after a disconnect, perform a catch-up refresh
        if (disconnectedAtRef.current) {
          disconnectedAtRef.current = null
          scheduleScopeRefresh([
            'field_reports',
            'incidents',
            'work_orders',
            'infrastructure_assets',
            'infrastructure_projects',
          ])
        }

        // Stop fallback polling on reconnect
        if (fallbackTimerRef.current) {
          clearInterval(fallbackTimerRef.current)
          fallbackTimerRef.current = null
        }

        // Mark as ready to display incoming notifications
        readyRef.current = true
      }

      eventSource.onmessage = (messageEvent) => {
        if (isCancelled || !messageEvent.data) return

        const event = parseRealtimeEvent(messageEvent.data)
        if (!event) return

        // Deduplication
        if (isDuplicateEvent(event.id, seenIdsRef.current)) {
          return
        }
        recordEventId(event.id, seenIdsRef.current)

        // 1. Trigger throttled data refresh for relevant scopes
        const scopes = mapEventToRefreshTargets(event)
        scheduleScopeRefresh(scopes)

        // 2. Call specific callbacks for update and delete (e.g. to close modals)
        if (event.action === 'UPDATE' && onRecordUpdatedRef.current) {
          onRecordUpdatedRef.current(event)
        } else if (event.action === 'DELETE' && onRecordDeletedRef.current) {
          onRecordDeletedRef.current(event)
        }

        // 3. Enqueue notification if ready (not initial batch)
        if (readyRef.current) {
          const notif = mapEventToNotification(event)
          setQueue((prevQueue) => enqueueNotification(prevQueue, notif))
        }
      }

      eventSource.onerror = () => {
        if (isCancelled) return
        setConnectionState('disconnected')

        if (!disconnectedAtRef.current) {
          disconnectedAtRef.current = Date.now()
        }

        // Start fallback polling (every 60s) if disconnected long term
        if (!fallbackTimerRef.current) {
          fallbackTimerRef.current = setInterval(() => {
            scheduleScopeRefresh([
              'field_reports',
              'incidents',
              'work_orders',
              'infrastructure_assets',
              'infrastructure_projects',
            ])
          }, 60000)
        }

        // EventSource will automatically attempt reconnection per its retry header
      }
    }

    connect()

    return () => {
      isCancelled = true
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current)
        throttleTimerRef.current = null
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [user?.id, apiRoot, scheduleScopeRefresh])

  return {
    connectionState,
    currentNotification,
    dismissCurrentNotification,
  }
}
