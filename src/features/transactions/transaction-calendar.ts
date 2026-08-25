import type {
  Transaction,
  TransactionDateGroup,
  TransactionMonth,
} from './transaction-types'

const monthPattern = /^(\d{4})-(\d{2})$/
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(value: number, length = 2) {
  return String(value).padStart(length, '0')
}

function readMonthParts(value: string) {
  const match = monthPattern.exec(value)

  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])

  if (year < 1 || year > 9999 || month < 1 || month > 12) return null

  return { month, year }
}

function readDateParts(value: string) {
  const match = datePattern.exec(value)

  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null
  }

  return { day, month, year }
}

function createLocalDate(year: number, month: number, day: number) {
  const date = new Date(0)
  date.setHours(12, 0, 0, 0)
  date.setFullYear(year, month - 1, day)
  return date
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1)
}

export function isTransactionMonth(value: unknown): value is TransactionMonth {
  return typeof value === 'string' && readMonthParts(value) !== null
}

export function getLocalCurrentMonth(today = new Date()): TransactionMonth {
  return `${pad(today.getFullYear(), 4)}-${pad(today.getMonth() + 1)}`
}

export function getMonthBounds(month: TransactionMonth) {
  const parts = readMonthParts(month)

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
    nextMonthStart: `${pad(nextYear, 4)}-${pad(nextMonth)}-01`,
  }
}

export function shiftTransactionMonth(
  month: TransactionMonth,
  offset: -1 | 1,
): TransactionMonth | null {
  const parts = readMonthParts(month)

  if (!parts) throw new Error(`Invalid transaction month: ${month}`)

  const absoluteMonth = parts.year * 12 + parts.month - 1 + offset
  const year = Math.floor(absoluteMonth / 12)
  const nextMonth = (absoluteMonth % 12) + 1

  if (year < 1 || year > 9999) return null

  return `${pad(year, 4)}-${pad(nextMonth)}`
}

export function getDefaultTransactionDate(
  month: TransactionMonth,
  today = new Date(),
) {
  const parts = readMonthParts(month)

  if (!parts) throw new Error(`Invalid transaction month: ${month}`)

  const currentMonth = getLocalCurrentMonth(today)

  if (month === currentMonth) {
    return `${currentMonth}-${pad(today.getDate())}`
  }

  const day = Math.min(today.getDate(), daysInMonth(parts.year, parts.month))
  return `${month}-${pad(day)}`
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
  const parts = readMonthParts(month)

  if (!parts) throw new Error(`Invalid transaction month: ${month}`)

  return capitalize(
    new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(createLocalDate(parts.year, parts.month, 1)),
  )
}

export function formatTransactionDate(value: string) {
  const parts = readDateParts(value)

  if (!parts) throw new Error(`Invalid transaction date: ${value}`)

  return capitalize(
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      weekday: 'long',
    }).format(createLocalDate(parts.year, parts.month, parts.day)),
  )
}

function daysInMonth(year: number, month: number) {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    return isLeapYear ? 29 : 28
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31
}
