import { createFileRoute } from '@tanstack/react-router'
import { LOCALES } from '~/i18n/config'
import { siteUrl } from '~/lib/site'

const PATHS = ['', '/privacy', '/terms'] as const

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => {
        const origin = siteUrl()
        const urls = PATHS.flatMap((path) =>
          LOCALES.map((locale) => {
            const alternates = LOCALES.map(
              (l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${origin}/${l}${path}"/>`,
            ).join('')
            return `<url><loc>${origin}/${locale}${path}</loc>${alternates}<xhtml:link rel="alternate" hreflang="x-default" href="${origin}/ar${path}"/><priority>${path ? '0.3' : '1.0'}</priority></url>`
          }),
        )
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>\n`
        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
