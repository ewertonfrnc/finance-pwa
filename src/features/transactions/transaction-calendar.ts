import type {
  Transaction,
  TransactionDateGroup,
  TransactionMonth,
} from './transaction-types'

import {
  createCalendarDate,
  daysInMonth,
  getLocalCurrentMonthIso,
  getLocalTodayIsoDate,
  parseCalendarDate,
  parseCalendarMonth,
  toIsoDate,
  toIsoMonth,
} from '../../lib/calendar-date'

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1)
}

export function isTransactionMonth(value: unknown): value is TransactionMonth {
  return typeof value === 'string' && parseCalendarMonth(value) !== null
}

export function getLocalCurrentMonth(today = new Date()): TransactionMonth {
  return getLocalCurrentMonthIso(today) as TransactionMonth
}

export function getMonthBounds(month: TransactionMonth) {
  const parts = parseCalendarMonth(month)

  if (!parts) throw new Error(`Invalid transaction month: ${month}`)

  const monthStart = `${month}-01`

  if (parts.year === 9999 && parts.month === 12) {
    return { monthEnd: '9999-12-31', monthStart, nextMonthStart: null }
  }

  const nextYear = parts.month === 12 ? parts.year + 1 : parts.year
  const nextMonth = parts.month === 12 ? 1 : parts.month + 1

  return {
    monthEnd: null,
    monthStart,
    nextMonthStart: toIsoDate(nextYear, nextMonth, 1),
  }
}

export function shiftTransactionMonth(
  month: TransactionMonth,
  offset: -1 | 1,
): TransactionMonth | null {
  const parts = parseCalendarMonth(month)

  if (!parts) throw new Error(`Invalid transaction month: ${month}`)

  const absoluteMonth = parts.year * 12 + parts.month - 1 + offset
  const year = Math.floor(absoluteMonth / 12)
  const nextMonth = (absoluteMonth % 12) + 1

  if (year < 1 || year > 9999) return null

  return toIsoMonth(year, nextMonth) as TransactionMonth
}

export function getDefaultTransactionDate(
  month: TransactionMonth,
  today = new Date(),
) {
  const parts = parseCalendarMonth(month)

  if (!parts) throw new Error(`Invalid transaction month: ${month}`)

  const currentMonth = getLocalCurrentMonth(today)

  if (month === currentMonth) {
    return getLocalTodayIsoDate(today)
  }

  const day = Math.min(today.getDate(), daysInMonth(parts.year, parts.month))
  return toIsoDate(parts.year, parts.month, day)
}

export function groupTransactionsByDate(
  transactions: readonly Transaction[],
): TransactionDateGroup[] {
  const groups: TransactionDateGroup[] = []

  for (const transaction of transactions) {
    const currentGroup = groups.at(-1)

    if (currentGroup?.date === transaction.transaction_date) {
      currentGroup.transactions.push(transaction)
      continue
    }

    groups.push({
      date: transaction.transaction_date,
      transactions: [transaction],
    })
  }

  return groups
}

export function formatTransactionMonth(month: TransactionMonth) {
  const parts = parseCalendarMonth(month)

  if (!parts) throw new Error(`Invalid transaction month: ${month}`)

  return capitalize(
    new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(createCalendarDate(parts.year, parts.month, 1)),
  )
}

export function formatTransactionDate(value: string) {
  const parts = parseCalendarDate(value)

  if (!parts) throw new Error(`Invalid transaction date: ${value}`)

  return capitalize(
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      weekday: 'long',
    }).format(createCalendarDate(parts.year, parts.month, parts.day)),
  )
}

export function getTransactionMonth(date: string): TransactionMonth {
  const parts = parseCalendarDate(date)

  if (!parts) throw new Error(`Invalid transaction date: ${date}`)

  return toIsoMonth(parts.year, parts.month) as TransactionMonth
}

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })
const relativeTimeFormatter = new Intl.RelativeTimeFormat('pt-BR', {
  numeric: 'auto',
})

function monthDifference(
  from: { month: number; year: number },
  to: { month: number; year: number },
) {
  return to.year * 12 + to.month - (from.year * 12 + from.month)
}

export function formatTransactionDateFootnote(
  date: string,
  today = new Date(),
) {
  const parts = parseCalendarDate(date)

  if (!parts) throw new Error(`Invalid transaction date: ${date}`)

  const todayParts = {
    day: today.getDate(),
    month: today.getMonth() + 1,
    year: today.getFullYear(),
  }

  if (
    parts.day === todayParts.day &&
    parts.month === todayParts.month &&
    parts.year === todayParts.year
  ) {
    const weekday = weekdayFormatter.format(
      createCalendarDate(parts.year, parts.month, parts.day),
    )
    return `Hoje · ${weekday}`
  }

  // Compare local noon instants so the day count never shifts across a DST
  // transition between the two dates.
  const dayDifference = Math.round(
    (createCalendarDate(parts.year, parts.month, parts.day).getTime() -
      createCalendarDate(
        todayParts.year,
        todayParts.month,
        todayParts.day,
      ).getTime()) /
      86_400_000,
  )

  const relative =
    Math.abs(dayDifference) <= 29
      ? relativeTimeFormatter.format(dayDifference, 'day')
      : relativeTimeFormatter.format(
          monthDifference(todayParts, parts),
          'month',
        )

  return `${formatTransactionDate(date)} · ${relative}`
}
