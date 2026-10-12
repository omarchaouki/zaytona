export const LOCALES = ['ar', 'fr'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ar'

export const LOCALE_META = {
  ar: { dir: 'rtl', htmlLang: 'ar-MA', ogLocale: 'ar_MA', label: 'العربية' },
  fr: { dir: 'ltr', htmlLang: 'fr-MA', ogLocale: 'fr_MA', label: 'Français' },
} as const satisfies Record<
  Locale,
  { dir: 'rtl' | 'ltr'; htmlLang: string; ogLocale: string; label: string }
>

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'ar' ? 'fr' : 'ar'
}
