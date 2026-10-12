import { createFileRoute, redirect } from '@tanstack/react-router'
import { DEFAULT_LOCALE } from '~/i18n/config'

/**
 * "/" → "/ar": Arabic is the site's language for everyone; French is one tap
 * away in the header. A permanent redirect lets caches and search engines keep it.
 */
export const Route = createFileRoute('/')({
  server: {
    handlers: {
      GET: () =>
        new Response(null, {
          status: 301,
          headers: { Location: `/${DEFAULT_LOCALE}`, 'Cache-Control': 'public, max-age=3600' },
        }),
    },
  },
  beforeLoad: () => {
    throw redirect({ to: '/$locale', params: { locale: DEFAULT_LOCALE } })
  },
})
