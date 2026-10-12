import { useLocation, useParams, useRouterState } from '@tanstack/react-router'
import { useCallback } from 'react'
import { DEFAULT_LOCALE, isLocale, type Locale } from './config'
import { type MessageKey, type TranslateParams, translate } from './messages'

export * from './config'
export type { MessageKey } from './messages'
export { translate } from './messages'

/**
 * Active locale: the `/$locale` route segment on public pages; on admin
 * pages, the `uiLocale` an admin route puts in its context; else Arabic.
 */
export function useLocale(): Locale {
  const params = useParams({ strict: false }) as { locale?: string }
  const contextLocale = useRouterState({ select: (s) => uiLocaleFromMatches(s.matches) })
  if (isLocale(params.locale)) return params.locale
  return contextLocale ?? DEFAULT_LOCALE
}

/** Deepest `uiLocale` found in route contexts (admin routes set it). */
export function uiLocaleFromMatches(matches: ReadonlyArray<{ context: unknown }>): Locale | null {
  for (let i = matches.length - 1; i >= 0; i--) {
    const ui = (matches[i]?.context as { uiLocale?: unknown } | undefined)?.uiLocale
    if (isLocale(ui)) return ui
  }
  return null
}

export function useT() {
  const locale = useLocale()
  return useCallback(
    (key: MessageKey, params?: TranslateParams) => translate(locale, key, params),
    [locale],
  )
}

/**
 * Same page in the other language, keeping the query string (e.g. the order
 * confirmation token or a preselected product).
 */
export function useSwitchLocaleHref(target: Locale): string {
  const href = useLocation({ select: (l) => `${l.pathname}${l.searchStr}` })
  return href.replace(/^\/(ar|fr)(?=[/?#]|$)/, `/${target}`)
}
