export function formatDateRange(start: string, end: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).formatRange(new Date(`${start}T00:00:00`), new Date(`${end}T00:00:00`))
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

export function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}
