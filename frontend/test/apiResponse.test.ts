import assert from 'node:assert/strict'
import test from 'node:test'
import { unwrapApiData } from '../src/utils/apiResponse.ts'

test('keeps pagination and stats returned beside an array payload', () => {
  const reports = [{ id: 'r-1', status: 'NEW' }]
  const pagination = { total: 1, limit: 100, offset: 0 }
  const stats = { total: 1, new: 1, reviewed: 0, converted: 0, archived: 0 }

  assert.deepEqual(unwrapApiData({ data: reports, pagination, stats }), {
    data: reports,
    pagination,
    stats,
  })
})

test('unwraps a plain array payload when no sibling metadata exists', () => {
  const reports = [{ id: 'r-1' }]
  assert.equal(unwrapApiData({ data: reports }), reports)
})

test('unwraps object payloads without changing their shape', () => {
  const user = { id: 'u-1', roleCode: 'DIRECTOR' }
  assert.equal(unwrapApiData({ data: user, stats: { total: 0 } }), user)
})
