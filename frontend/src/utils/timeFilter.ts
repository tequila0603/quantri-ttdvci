/**
 * Global Time Filter Utilities
 * Timezone: Asia/Ho_Chi_Minh (UTC+7)
 */

export type PeriodType = 'WEEK' | 'MONTH' | 'QUARTER' | 'HALF_YEAR' | 'YEAR'

export type PeriodOption = {
  value: string // Unique identifier within type, e.g. 'M-09', 'W-38', 'Q-3', 'H-2', 'Y-2026'
  label: string // Descriptive label, e.g. 'Tháng 09/2026'
  shortLabel: string // Short label for compact display, e.g. 'Tháng 09'
  fromDate: string // 'YYYY-MM-DD'
  toDate: string // 'YYYY-MM-DD'
  isOngoing: boolean
}

export type GlobalTimeFilter = {
  year: number
  periodType: PeriodType
  periodKey: string
  periodLabel: string
  fromDate: string
  toDate: string
  displayRange: string
}

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  WEEK: 'Tuần',
  MONTH: 'Tháng',
  QUARTER: 'Quý',
  HALF_YEAR: '6 tháng',
  YEAR: 'Năm',
}

export const AVAILABLE_HISTORICAL_YEARS_COUNT = 5

/**
 * Get current date in Asia/Ho_Chi_Minh timezone
 */
export function getTodayVietnam(referenceDate: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const parts = formatter.formatToParts(referenceDate)
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 2026)
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 9)
  const date = Number(parts.find((p) => p.type === 'day')?.value ?? 14)
  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  }
  const dayOfWeek = weekdayMap[weekdayStr ?? 'Mon'] ?? 1
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`
  return { year, month, date, dayOfWeek, isoDate }
}

export function pad2(num: number): string {
  return String(num).padStart(2, '0')
}

export function formatDmy(isoDate: string): string {
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Returns available years (no future years allowed).
 */
export function getAvailableYears(referenceDate?: Date): number[] {
  const today = getTodayVietnam(referenceDate)
  const currentYear = today.year
  const years: number[] = []
  for (let i = 0; i < AVAILABLE_HISTORICAL_YEARS_COUNT; i++) {
    years.push(currentYear - i)
  }
  return years
}

/**
 * Generate weekly periods for a year (Monday to Sunday).
 * Weeks not yet started are omitted.
 * Ongoing week ends at today.
 */
export function getAvailableWeeks(year: number, referenceDate?: Date): PeriodOption[] {
  const today = getTodayVietnam(referenceDate)
  const isCurrentYear = year === today.year
  const weeks: PeriodOption[] = []

  // Generate Monday-Sunday weeks starting from Jan 1
  let cursor = new Date(Date.UTC(year, 0, 1))
  let weekNum = 1

  // If Jan 1 is not Monday, week 1 is Jan 1 to first Sunday
  const jan1Day = cursor.getUTCDay() // 0 is Sunday, 1 is Monday...
  if (jan1Day !== 1) {
    const daysUntilSunday = (7 - jan1Day) % 7
    const endOfFirstWeek = new Date(Date.UTC(year, 0, 1 + daysUntilSunday))
    const startIso = `${year}-01-01`
    const endIso = `${year}-${pad2(endOfFirstWeek.getUTCMonth() + 1)}-${pad2(endOfFirstWeek.getUTCDate())}`

    if (!isCurrentYear || startIso <= today.isoDate) {
      const isOngoing = isCurrentYear && today.isoDate >= startIso && today.isoDate <= endIso
      const toDate = isOngoing ? today.isoDate : endIso
      weeks.push({
        value: `W-${pad2(weekNum)}`,
        label: `Tuần ${pad2(weekNum)} (${formatDmy(startIso)} – ${formatDmy(toDate)})`,
        shortLabel: `Tuần ${pad2(weekNum)}`,
        fromDate: startIso,
        toDate,
        isOngoing,
      })
    }
    weekNum = 2
    cursor = new Date(Date.UTC(year, 0, 2 + daysUntilSunday))
  }

  while (cursor.getUTCFullYear() === year) {
    const startMonth = cursor.getUTCMonth() + 1
    const startDate = cursor.getUTCDate()
    const startIso = `${year}-${pad2(startMonth)}-${pad2(startDate)}`

    // If start is in the future in current year, stop generating
    if (isCurrentYear && startIso > today.isoDate) {
      break
    }

    const endOfSunday = new Date(cursor)
    endOfSunday.setUTCDate(endOfSunday.getUTCDate() + 6)
    let endIso: string
    if (endOfSunday.getUTCFullYear() > year) {
      endIso = `${year}-12-31`
    } else {
      endIso = `${year}-${pad2(endOfSunday.getUTCMonth() + 1)}-${pad2(endOfSunday.getUTCDate())}`
    }

    const isOngoing = isCurrentYear && today.isoDate >= startIso && today.isoDate <= endIso
    const toDate = isOngoing ? today.isoDate : endIso

    weeks.push({
      value: `W-${pad2(weekNum)}`,
      label: `Tuần ${pad2(weekNum)} (${formatDmy(startIso)} – ${formatDmy(toDate)})`,
      shortLabel: `Tuần ${pad2(weekNum)}`,
      fromDate: startIso,
      toDate,
      isOngoing,
    })

    weekNum++
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }

  return weeks
}

/**
 * Generate monthly periods.
 * For past years: all 12 months.
 * For current year: months 1 to currentMonth.
 * Ongoing month ends at today.
 */
export function getAvailableMonths(year: number, referenceDate?: Date): PeriodOption[] {
  const today = getTodayVietnam(referenceDate)
  const isCurrentYear = year === today.year
  const maxMonth = isCurrentYear ? today.month : 12
  const months: PeriodOption[] = []

  for (let m = 1; m <= maxMonth; m++) {
    const fromDate = `${year}-${pad2(m)}-01`
    const isOngoing = isCurrentYear && m === today.month
    const toDate = isOngoing ? today.isoDate : `${year}-${pad2(m)}-${pad2(getDaysInMonth(year, m))}`

    months.push({
      value: `M-${pad2(m)}`,
      label: `Tháng ${pad2(m)}/${year}`,
      shortLabel: `Tháng ${pad2(m)}`,
      fromDate,
      toDate,
      isOngoing,
    })
  }

  return months
}

/**
 * Generate quarterly periods.
 * Only available for current year.
 * Ongoing quarter ends at today. Future quarters omitted.
 */
export function getAvailableQuarters(year: number, referenceDate?: Date): PeriodOption[] {
  const today = getTodayVietnam(referenceDate)
  const isCurrentYear = year === today.year
  const currentQuarter = Math.ceil(today.month / 3)
  const maxQuarter = isCurrentYear ? currentQuarter : 4
  const quarters: PeriodOption[] = []

  const quarterRanges = [
    { q: 1, startM: 1, endM: 3, endD: 31 },
    { q: 2, startM: 4, endM: 6, endD: 30 },
    { q: 3, startM: 7, endM: 9, endD: 30 },
    { q: 4, startM: 10, endM: 12, endD: 31 },
  ]

  for (const item of quarterRanges) {
    if (item.q > maxQuarter) break
    const fromDate = `${year}-${pad2(item.startM)}-01`
    const naturalEnd = `${year}-${pad2(item.endM)}-${pad2(item.endD)}`
    const isOngoing = isCurrentYear && item.q === currentQuarter
    const toDate = isOngoing ? today.isoDate : naturalEnd

    quarters.push({
      value: `Q-${item.q}`,
      label: `Quý ${item.q}/${year}`,
      shortLabel: `Quý ${item.q}`,
      fromDate,
      toDate,
      isOngoing,
    })
  }

  return quarters
}

/**
 * Generate 6-month periods (Half-year).
 * H1: 01/01 - 30/06
 * H2: 01/07 - 31/12 (or today if ongoing)
 */
export function getAvailableHalfYears(year: number, referenceDate?: Date): PeriodOption[] {
  const today = getTodayVietnam(referenceDate)
  const isCurrentYear = year === today.year
  const halfYears: PeriodOption[] = []

  // H1: 6 tháng đầu năm
  const h1Start = `${year}-01-01`
  const h1NaturalEnd = `${year}-06-30`
  const isH1Ongoing = isCurrentYear && today.month <= 6
  const h1End = isH1Ongoing ? today.isoDate : h1NaturalEnd

  halfYears.push({
    value: 'H-1',
    label: `6 tháng đầu năm ${year}`,
    shortLabel: '6 tháng đầu năm',
    fromDate: h1Start,
    toDate: h1End,
    isOngoing: isH1Ongoing,
  })

  // H2: 6 tháng cuối năm
  if (!isCurrentYear || today.month >= 7) {
    const h2Start = `${year}-07-01`
    const h2NaturalEnd = `${year}-12-31`
    const isH2Ongoing = isCurrentYear && today.month >= 7
    const h2End = isH2Ongoing ? today.isoDate : h2NaturalEnd

    halfYears.push({
      value: 'H-2',
      label: `6 tháng cuối năm ${year}`,
      shortLabel: '6 tháng cuối năm',
      fromDate: h2Start,
      toDate: h2End,
      isOngoing: isH2Ongoing,
    })
  }

  return halfYears
}

/**
 * Generate full year period.
 */
export function getAvailableFullYear(year: number, referenceDate?: Date): PeriodOption[] {
  const today = getTodayVietnam(referenceDate)
  const isCurrentYear = year === today.year
  const fromDate = `${year}-01-01`
  const toDate = isCurrentYear ? today.isoDate : `${year}-12-31`

  return [
    {
      value: `Y-${year}`,
      label: `Năm ${year}`,
      shortLabel: `Cả năm ${year}`,
      fromDate,
      toDate,
      isOngoing: isCurrentYear,
    },
  ]
}

/**
 * Returns available period types for a year.
 * Current year: WEEK, MONTH, QUARTER, HALF_YEAR, YEAR.
 * Past years: MONTH only.
 */
export function getAvailablePeriodTypes(year: number, referenceDate?: Date): PeriodType[] {
  const today = getTodayVietnam(referenceDate)
  if (year < today.year) {
    return ['MONTH']
  }
  return ['WEEK', 'MONTH', 'QUARTER', 'HALF_YEAR', 'YEAR']
}

/**
 * Returns list of period options for a given year and periodType.
 */
export function getPeriodOptions(year: number, periodType: PeriodType, referenceDate?: Date): PeriodOption[] {
  switch (periodType) {
    case 'WEEK':
      return getAvailableWeeks(year, referenceDate)
    case 'MONTH':
      return getAvailableMonths(year, referenceDate)
    case 'QUARTER':
      return getAvailableQuarters(year, referenceDate)
    case 'HALF_YEAR':
      return getAvailableHalfYears(year, referenceDate)
    case 'YEAR':
      return getAvailableFullYear(year, referenceDate)
    default:
      return getAvailableMonths(year, referenceDate)
  }
}

/**
 * Build display string e.g. "Tháng 09/2026 — từ 01/09/2026 đến 14/09/2026"
 */
export function buildDisplayRange(label: string, fromDate: string, toDate: string): string {
  return `${label} — từ ${formatDmy(fromDate)} đến ${formatDmy(toDate)}`
}

/**
 * Default global time filter on system startup:
 * Year: Current Year (e.g. 2026)
 * Period: Current Month (e.g. Tháng 09/2026)
 * fromDate: 2026-09-01
 * toDate: 2026-09-14
 */
export function createDefaultTimeFilter(referenceDate?: Date): GlobalTimeFilter {
  const today = getTodayVietnam(referenceDate)
  const year = today.year
  const periodType: PeriodType = 'MONTH'
  const periodKey = `M-${pad2(today.month)}`
  const fromDate = `${year}-${pad2(today.month)}-01`
  const toDate = today.isoDate
  const periodLabel = `Tháng ${pad2(today.month)}/${year}`
  const displayRange = buildDisplayRange(periodLabel, fromDate, toDate)

  return {
    year,
    periodType,
    periodKey,
    periodLabel,
    fromDate,
    toDate,
    displayRange,
  }
}

/**
 * Handle switching year:
 * - If switching to a past year, force periodType = 'MONTH' (Rule 4)
 * - If switching to current year, ensure selected period doesn't exceed current date
 */
export function handleYearChange(
  current: GlobalTimeFilter,
  newYearInput: number,
  referenceDate?: Date,
): GlobalTimeFilter {
  const today = getTodayVietnam(referenceDate)
  // Clamp to current year max (Rule 5: no future years)
  const newYear = Math.min(newYearInput, today.year)
  const isPastYear = newYear < today.year

  let periodType = current.periodType
  if (isPastYear) {
    // Rule 4: "Khi chuyển từ năm hiện tại sang năm trước, tự chuyển loại kỳ về Tháng."
    periodType = 'MONTH'
  }

  const options = getPeriodOptions(newYear, periodType, referenceDate)
  if (!options.length) {
    return createDefaultTimeFilter(referenceDate)
  }

  // Try to preserve matching period key
  let selected = options.find((opt) => opt.value === current.periodKey)
  if (!selected) {
    // If was on another type and converted to MONTH, pick the same month number or current month
    if (periodType === 'MONTH') {
      const targetMonthKey = `M-${pad2(today.month)}`
      selected = options.find((opt) => opt.value === targetMonthKey) || options[options.length - 1]
    } else {
      // Pick the latest available option (current ongoing or last completed)
      selected = options[options.length - 1]
    }
  }

  return {
    year: newYear,
    periodType,
    periodKey: selected.value,
    periodLabel: selected.label,
    fromDate: selected.fromDate,
    toDate: selected.toDate,
    displayRange: buildDisplayRange(selected.label, selected.fromDate, selected.toDate),
  }
}

/**
 * Handle switching period type (e.g. from Month to Quarter)
 */
export function handlePeriodTypeChange(
  current: GlobalTimeFilter,
  newType: PeriodType,
  referenceDate?: Date,
): GlobalTimeFilter {
  const today = getTodayVietnam(referenceDate)
  if (current.year < today.year) {
    // Past years only allow MONTH
    newType = 'MONTH'
  }

  const options = getPeriodOptions(current.year, newType, referenceDate)
  if (!options.length) return current

  // Pick the ongoing option if available, else latest
  const ongoingOption = options.find((opt) => opt.isOngoing)
  const selected = ongoingOption ?? options[options.length - 1]

  return {
    year: current.year,
    periodType: newType,
    periodKey: selected.value,
    periodLabel: selected.label,
    fromDate: selected.fromDate,
    toDate: selected.toDate,
    displayRange: buildDisplayRange(selected.label, selected.fromDate, selected.toDate),
  }
}

/**
 * Handle selecting a specific period option
 */
export function handlePeriodSelect(
  current: GlobalTimeFilter,
  periodValue: string,
  referenceDate?: Date,
): GlobalTimeFilter {
  const options = getPeriodOptions(current.year, current.periodType, referenceDate)
  const selected = options.find((opt) => opt.value === periodValue)
  if (!selected) return current

  return {
    year: current.year,
    periodType: current.periodType,
    periodKey: selected.value,
    periodLabel: selected.label,
    fromDate: selected.fromDate,
    toDate: selected.toDate,
    displayRange: buildDisplayRange(selected.label, selected.fromDate, selected.toDate),
  }
}

export const STORAGE_KEY_GLOBAL_TIME_FILTER = 'center_ops_global_time_filter'

export function loadSavedTimeFilter(referenceDate?: Date): GlobalTimeFilter {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GLOBAL_TIME_FILTER)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GlobalTimeFilter>
      if (
        typeof parsed.year === 'number' &&
        typeof parsed.periodType === 'string' &&
        typeof parsed.periodKey === 'string'
      ) {
        // Validate against current rules
        const today = getTodayVietnam(referenceDate)
        const safeYear = Math.min(parsed.year, today.year)
        const safeType = safeYear < today.year ? 'MONTH' : parsed.periodType
        const options = getPeriodOptions(safeYear, safeType, referenceDate)
        const match = options.find((o) => o.value === parsed.periodKey)
        if (match) {
          return {
            year: safeYear,
            periodType: safeType,
            periodKey: match.value,
            periodLabel: match.label,
            fromDate: match.fromDate,
            toDate: match.toDate,
            displayRange: buildDisplayRange(match.label, match.fromDate, match.toDate),
          }
        }
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return createDefaultTimeFilter(referenceDate)
}

export function saveTimeFilter(filter: GlobalTimeFilter) {
  try {
    localStorage.setItem(STORAGE_KEY_GLOBAL_TIME_FILTER, JSON.stringify(filter))
  } catch {
    // Ignore localStorage errors
  }
}
