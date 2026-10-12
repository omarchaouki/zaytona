import type { Locale } from '~/i18n/config'
import { LOCALES } from '~/i18n/config'

/**
 * Public origin for absolute URLs (canonical, hreflang, OG). SITE_URL on the
 * server; on client-side navigations the page's own origin (same value in prod).
 */
export function siteUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin
  const fromEnv = typeof process !== 'undefined' ? process.env.SITE_URL : undefined
  return (fromEnv ?? 'http://localhost:3000').replace(/\/+$/, '')
}

/** canonical + hreflang alternates for a locale-agnostic path such as "" or "/privacy". */
export function alternateLinks(locale: Locale, path: string) {
  const origin = siteUrl()
  return [
    { rel: 'canonical', href: `${origin}/${locale}${path}` },
    ...LOCALES.map((l) => ({ rel: 'alternate', hrefLang: l, href: `${origin}/${l}${path}` })),
    { rel: 'alternate', hrefLang: 'x-default', href: `${origin}/ar${path}` },
  ]
}
