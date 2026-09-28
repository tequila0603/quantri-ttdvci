import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getTodayVietnam,
  getAvailableYears,
  getAvailablePeriodTypes,
  getPeriodOptions,
  createDefaultTimeFilter,
  handleYearChange,
  handlePeriodTypeChange,
  handlePeriodSelect,
} from '../src/utils/timeFilter.ts'

// Fixed reference date: 2026-09-14T10:50:00+07:00 (Monday, Sep 14, 2026 in Vietnam)
const REF_DATE = new Date('2026-09-14T03:50:00.000Z')

test('getTodayVietnam computes correct date in Asia/Ho_Chi_Minh', () => {
  const today = getTodayVietnam(REF_DATE)
  assert.equal(today.year, 2026)
  assert.equal(today.month, 9)
  assert.equal(today.date, 14)
  assert.equal(today.dayOfWeek, 1) // Monday
  assert.equal(today.isoDate, '2026-09-14')
})

test('Default filter on opening system: Year 2026, Month 09, ongoing ends at 2026-09-14', () => {
  const filter = createDefaultTimeFilter(REF_DATE)
  assert.equal(filter.year, 2026)
  assert.equal(filter.periodType, 'MONTH')
  assert.equal(filter.periodKey, 'M-09')
  assert.equal(filter.periodLabel, 'Tháng 09/2026')
  assert.equal(filter.fromDate, '2026-09-01')
  assert.equal(filter.toDate, '2026-09-14')
  assert.equal(filter.displayRange, 'Tháng 09/2026 — từ 01/09/2026 đến 14/09/2026')
})

test('Available years cannot include future years (> 2026)', () => {
  const years = getAvailableYears(REF_DATE)
  assert.ok(years.includes(2026))
  assert.ok(years.includes(2025))
  assert.ok(years.every((y) => y <= 2026))
})

test('Current year supports Week, Month, Quarter, Half-year, Year', () => {
  const types = getAvailablePeriodTypes(2026, REF_DATE)
  assert.deepEqual(types, ['WEEK', 'MONTH', 'QUARTER', 'HALF_YEAR', 'YEAR'])
})

test('Past years only allow Month', () => {
  const types2025 = getAvailablePeriodTypes(2025, REF_DATE)
  assert.deepEqual(types2025, ['MONTH'])

  const types2024 = getAvailablePeriodTypes(2024, REF_DATE)
  assert.deepEqual(types2024, ['MONTH'])
})

test('Current year months: 1 to 9 only (no future months), month 9 ends at 14/09/2026', () => {
  const months = getPeriodOptions(2026, 'MONTH', REF_DATE)
  assert.equal(months.length, 9)
  // Completed month (Tháng 08)
  assert.equal(months[7].value, 'M-08')
  assert.equal(months[7].fromDate, '2026-08-01')
  assert.equal(months[7].toDate, '2026-08-31')
  assert.equal(months[7].isOngoing, false)
  // Ongoing month (Tháng 09)
  assert.equal(months[8].value, 'M-09')
  assert.equal(months[8].fromDate, '2026-09-01')
  assert.equal(months[8].toDate, '2026-09-14')
  assert.equal(months[8].isOngoing, true)
})

test('Past year months: all 12 months present, completed on last day of month', () => {
  const months = getPeriodOptions(2025, 'MONTH', REF_DATE)
  assert.equal(months.length, 12)
  assert.equal(months[0].value, 'M-01')
  assert.equal(months[0].fromDate, '2025-01-01')
  assert.equal(months[0].toDate, '2025-01-31')
  assert.equal(months[1].value, 'M-02')
  assert.equal(months[1].fromDate, '2025-02-01')
  assert.equal(months[1].toDate, '2025-02-28')
  assert.equal(months[11].value, 'M-12')
  assert.equal(months[11].fromDate, '2025-12-01')
  assert.equal(months[11].toDate, '2025-12-31')
})

test('Current year quarters: Q1, Q2 completed; Q3 ongoing ends at 14/09/2026; Q4 omitted', () => {
  const quarters = getPeriodOptions(2026, 'QUARTER', REF_DATE)
  assert.equal(quarters.length, 3)
  assert.equal(quarters[0].value, 'Q-1')
  assert.equal(quarters[0].fromDate, '2026-01-01')
  assert.equal(quarters[0].toDate, '2026-03-31')
  assert.equal(quarters[1].value, 'Q-2')
  assert.equal(quarters[1].fromDate, '2026-04-01')
  assert.equal(quarters[1].toDate, '2026-06-30')
  assert.equal(quarters[2].value, 'Q-3')
  assert.equal(quarters[2].fromDate, '2026-07-01')
  assert.equal(quarters[2].toDate, '2026-09-14')
  assert.equal(quarters[2].isOngoing, true)
})

test('Current year 6-months: H1 completed (30/06); H2 ongoing ends at 14/09/2026', () => {
  const halfYears = getPeriodOptions(2026, 'HALF_YEAR', REF_DATE)
  assert.equal(halfYears.length, 2)
  assert.equal(halfYears[0].value, 'H-1')
  assert.equal(halfYears[0].fromDate, '2026-01-01')
  assert.equal(halfYears[0].toDate, '2026-06-30')
  assert.equal(halfYears[0].isOngoing, false)
  assert.equal(halfYears[1].value, 'H-2')
  assert.equal(halfYears[1].fromDate, '2026-07-01')
  assert.equal(halfYears[1].toDate, '2026-09-14')
  assert.equal(halfYears[1].isOngoing, true)
})

test('Current year full-year: ends at 14/09/2026', () => {
  const fullYear = getPeriodOptions(2026, 'YEAR', REF_DATE)
  assert.equal(fullYear.length, 1)
  assert.equal(fullYear[0].value, 'Y-2026')
  assert.equal(fullYear[0].fromDate, '2026-01-01')
  assert.equal(fullYear[0].toDate, '2026-09-14')
  assert.equal(fullYear[0].isOngoing, true)
})

test('Current year weeks: Monday to Sunday, ongoing ends at today, future weeks blocked', () => {
  const weeks = getPeriodOptions(2026, 'WEEK', REF_DATE)
  assert.ok(weeks.length > 0)
  // Last week generated must be ongoing or <= today
  const lastWeek = weeks[weeks.length - 1]
  assert.ok(lastWeek.fromDate <= '2026-09-14')
  assert.equal(lastWeek.toDate, '2026-09-14')
  assert.equal(lastWeek.isOngoing, true)
  // Previous week must be completed Monday to Sunday
  const prevWeek = weeks[weeks.length - 2]
  assert.equal(prevWeek.isOngoing, false)
  assert.equal(prevWeek.fromDate, '2026-09-07')
  assert.equal(prevWeek.toDate, '2026-09-13')
})

test('Switching year from 2026 (QUARTER) to 2025 automatically forces Month type', () => {
  const initial = createDefaultTimeFilter(REF_DATE)
  const quarterFilter = handlePeriodTypeChange(initial, 'QUARTER', REF_DATE)
  assert.equal(quarterFilter.periodType, 'QUARTER')
  assert.equal(quarterFilter.periodKey, 'Q-3')

  // Switch to 2025
  const pastYearFilter = handleYearChange(quarterFilter, 2025, REF_DATE)
  assert.equal(pastYearFilter.year, 2025)
  assert.equal(pastYearFilter.periodType, 'MONTH')
  assert.equal(pastYearFilter.periodKey, 'M-09')
  assert.equal(pastYearFilter.fromDate, '2025-09-01')
  assert.equal(pastYearFilter.toDate, '2025-09-30')
  assert.equal(pastYearFilter.displayRange, 'Tháng 09/2025 — từ 01/09/2025 đến 30/09/2025')
})

test('Switching year to future year (> 2026) is clamped to 2026', () => {
  const initial = createDefaultTimeFilter(REF_DATE)
  const clamped = handleYearChange(initial, 2028, REF_DATE)
  assert.equal(clamped.year, 2026)
})

test('Selecting specific period updates filter correctly', () => {
  const initial = createDefaultTimeFilter(REF_DATE)
  const updated = handlePeriodSelect(initial, 'M-05', REF_DATE)
  assert.equal(updated.periodKey, 'M-05')
  assert.equal(updated.periodLabel, 'Tháng 05/2026')
  assert.equal(updated.fromDate, '2026-05-01')
  assert.equal(updated.toDate, '2026-05-31')
  assert.equal(updated.displayRange, 'Tháng 05/2026 — từ 01/05/2026 đến 31/05/2026')
})
