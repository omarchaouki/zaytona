// The same files the @fontsource CSS references, so Vite emits one hashed asset each.
import cairoArabic700 from '@fontsource/cairo/files/cairo-arabic-700-normal.woff2?url'
import plexArabic400 from '@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2?url'
import frauncesLatin from '@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url'
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'
import type { Locale } from './config'

const critical: Record<Locale, string[]> = {
  ar: [cairoArabic700, plexArabic400],
  fr: [frauncesLatin, interLatin],
}

/** Preload the heading + body faces the first screen needs, per locale. */
export function fontPreloadLinks(locale: Locale) {
  return critical[locale].map((href) => ({
    rel: 'preload',
    as: 'font',
    type: 'font/woff2',
    href,
    crossOrigin: 'anonymous' as const,
  }))
}
