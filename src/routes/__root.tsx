/// <reference types="vite/client" />
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouterState,
} from '@tanstack/react-router'
import { type ReactNode, useEffect } from 'react'
import { TopProgress } from '~/components/TopProgress'
import { uiLocaleFromMatches } from '~/i18n'
import { DEFAULT_LOCALE, isLocale, LOCALE_META } from '~/i18n/config'
import appCss from '~/styles/app.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'theme-color', content: '#141b0c' },
      { name: 'format-detection', content: 'telephone=no' },
    ],
    scripts: [
      {
        // 1. Lets CSS hide scroll-reveal content only when JS will reveal it.
        // 2. Until the app has hydrated, no form may submit the plain-HTML way: a
        //    native GET would put what was typed (passwords, phone numbers) in the URL.
        children:
          "document.documentElement.classList.add('js');document.addEventListener('submit',function(e){if(!window.__hydrated)e.preventDefault()},true)",
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  shellComponent: RootDocument,
})

/** <html lang dir> follows the `/$locale` segment, or the admin's UI language; else Arabic. */
function useDocumentLocale() {
  return useRouterState({
    select: (s) => {
      for (const match of s.matches) {
        const locale = (match.params as { locale?: string }).locale
        if (isLocale(locale)) return locale
      }
      return uiLocaleFromMatches(s.matches) ?? DEFAULT_LOCALE
    },
  })
}

function RootDocument({ children }: { children: ReactNode }) {
  const locale = useDocumentLocale()
  useEffect(() => {
    ;(window as Window & { __hydrated?: boolean }).__hydrated = true
  }, [])
  const meta = LOCALE_META[locale]
  return (
    <html lang={meta.htmlLang} dir={meta.dir} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <TopProgress />
        {children}
        <Scripts />
      </body>
    </html>
  )
}
