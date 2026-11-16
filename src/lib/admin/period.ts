/**
 * Admin analytics period resolution — every metric in the Admin system is
 * computed for a selected period AND its preceding comparison period.
 * All figures are derived from real tables; nothing is estimated here.
 */

export type PeriodKey = 'today' | '7d' | '30d' | 'quarter' | 'ytd' | 'custom'

export const PERIOD_OPTIONS: {key: PeriodKey; label: string}[] = [
  {key: 'today', label: 'Today'},
  {key: '7d', label: 'Last 7 days'},
  {key: '30d', label: 'Last 30 days'},
  {key: 'quarter', label: 'This quarter'},
  {key: 'ytd', label: 'Year to date'},
  {key: 'custom', label: 'Custom range'},
]

export interface Period {
  key: PeriodKey
  label: string
  from: Date // inclusive
  to: Date // exclusive (now / end of custom day)
  prevFrom: Date
  prevTo: Date
  days: number
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000)
}

export function resolvePeriod(key?: string | null, fromParam?: string | null, toParam?: string | null): Period {
  const now = new Date()
  const today = startOfDay(now)
  const endOfToday = addDays(today, 1)

  const k = (PERIOD_OPTIONS.some((o) => o.key === key) ? key : '30d') as PeriodKey
  switch (k) {
    case 'today':
      return {key: k, label: 'Today', from: today, to: endOfToday, prevFrom: addDays(today, -1), prevTo: today, days: 1}
    case '7d':
      return {key: k, label: 'Last 7 days', from: addDays(today, -7), to: endOfToday, prevFrom: addDays(today, -14), prevTo: addDays(today, -7), days: 7}
    case 'quarter': {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 1)
      const prevStart = new Date(qStart.getFullYear(), qStart.getMonth() - 3, 1)
      return {key: k, label: 'This quarter', from: qStart, to: qEnd, prevFrom: prevStart, prevTo: qStart, days: Math.max(1, Math.round((qEnd.getTime() - qStart.getTime()) / 86400000))}
    }
    case 'ytd': {
      const yStart = new Date(now.getFullYear(), 0, 1)
      const yEnd = new Date(now.getFullYear() + 1, 0, 1)
      return {key: k, label: 'Year to date', from: yStart, to: yEnd, prevFrom: new Date(now.getFullYear() - 1, 0, 1), prevTo: yStart, days: Math.max(1, Math.round((now.getTime() - yStart.getTime()) / 86400000))}
    }
    case 'custom': {
      const from = fromParam ? startOfDay(new Date(fromParam)) : addDays(today, -30)
      const to = toParam ? addDays(startOfDay(new Date(toParam)), 1) : endOfToday
      const safeTo = to > from ? to : addDays(from, 1)
      const days = Math.max(1, Math.round((safeTo.getTime() - from.getTime()) / 86400000))
      return {key: k, label: `${from.toISOString().slice(0, 10)} → ${safeTo.toISOString().slice(0, 10)}`, from, to: safeTo, prevFrom: addDays(from, -days), prevTo: from, days}
    }
    default:
      return {key: '30d', label: 'Last 30 days', from: addDays(today, -30), to: endOfToday, prevFrom: addDays(today, -60), prevTo: addDays(today, -30), days: 30}
  }
}

/** Growth vs previous period — null when the previous period had no data. */
export function growth(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

export function inRange(date: Date, from: Date, to: Date): boolean {
  return date >= from && date < to
}

/** Group values into per-day buckets across [from, to). */
export function dailyBuckets(from: Date, to: Date): {date: string; label: string}[] {
  const out: {date: string; label: string}[] = []
  const spanDays = Math.round((to.getTime() - from.getTime()) / 86400000)
  const step = spanDays > 92 ? 7 : 1 // weekly buckets for long ranges
  for (let t = from.getTime(); t < to.getTime(); t += step * 86400000) {
    const d = new Date(t)
    out.push({date: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})})
  }
  return out
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export function avg(values: number[]): number | null {
  return values.length === 0 ? null : sum(values) / values.length
}
