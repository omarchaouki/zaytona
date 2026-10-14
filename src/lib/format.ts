import type { Locale } from '~/i18n/config'

// Western digits in both languages (nu-latn), as requested by the client.
const numberLocale: Record<Locale, string> = { ar: 'ar-MA-u-nu-latn', fr: 'fr-MA' }

const formatters = new Map<string, Intl.NumberFormat>()

function numberFormat(locale: Locale) {
  const key = numberLocale[locale]
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat(key, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    formatters.set(key, f)
  }
  return f
}

/** 1250.5 → "1.250,5 درهم" (ar) / "1.250,5 MAD" (fr), Moroccan CLDR format. Accepts Drizzle numeric strings. */
export function formatMad(amount: number | string, locale: Locale): string {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  const n = numberFormat(locale).format(value)
  return locale === 'ar' ? `${n} درهم` : `${n} MAD`
}

export function formatNumber(value: number, locale: Locale): string {
  return numberFormat(locale).format(value)
}

/** The calendar day of a moment in Morocco, as "YYYY-MM-DD" (computed once, on the server). */
export function moroccoDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(date)
}

/** The current year in Morocco, e.g. for the footer copyright (never hard-coded). */
export function moroccoYear(date = new Date()): number {
  return Number(moroccoDay(date).slice(0, 4))
}

/**
 * "2026-10-09" → "9 oct. 2026" / "09‏/10‏/2026". The day is read and printed in
 * UTC so the server and the browser always produce the same text (anything
 * time-zone dependent in SSR markup makes React rebuild the page on load).
 */
export function formatDay(day: string, locale: Locale, style: 'medium' | 'long' = 'medium') {
  return new Intl.DateTimeFormat(numberLocale[locale], {
    dateStyle: style,
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))
}
