import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'
import { AttributionCapture } from '~/components/AttributionCapture'
import { FloatingWhatsapp } from '~/components/FloatingWhatsapp'
import { MetaPixel } from '~/components/MetaPixel'
import { RevealObserver } from '~/components/RevealObserver'
import { SiteProvider } from '~/components/SiteContext'
import { SiteFooter } from '~/components/SiteFooter'
import { SiteHeader } from '~/components/SiteHeader'
import { WhatsappClickTracker } from '~/components/WhatsappClickTracker'
import { DEFAULT_LOCALE, isLocale, LOCALE_META, translate, useT } from '~/i18n'
import { fontPreloadLinks } from '~/i18n/fonts'
import { getSiteChrome } from '~/server/functions/public'

export const Route = createFileRoute('/$locale')({
  params: {
    parse: (raw) => {
      if (!isLocale(raw.locale)) throw notFound()
      return { locale: raw.locale }
    },
    stringify: (p) => ({ locale: p.locale }),
  },
  // Settings (WhatsApp number, contact…) are read on every request so an admin
  // change shows up immediately; client navigations reuse them for a minute.
  loader: ({ params }) => getSiteChrome({ data: { locale: params.locale } }),
  staleTime: 60_000,
  // head() still runs for an unknown segment (e.g. /xx) while the 404 renders,
  // with the raw param, so re-check before using it as a Locale.
  head: ({ params }) => {
    if (!isLocale(params.locale)) {
      return {
        meta: [
          { title: translate(DEFAULT_LOCALE, 'errors.notFoundTitle') },
          { name: 'robots', content: 'noindex' },
        ],
        links: fontPreloadLinks(DEFAULT_LOCALE),
      }
    }
    const { locale } = params
    return {
      meta: [
        { title: translate(locale, 'meta.title') },
        { name: 'description', content: translate(locale, 'meta.description') },
        { property: 'og:locale', content: LOCALE_META[locale].ogLocale },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: translate(locale, 'meta.title') },
        { property: 'og:description', content: translate(locale, 'meta.description') },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      links: fontPreloadLinks(locale),
    }
  },
  component: LocaleLayout,
})

function LocaleLayout() {
  const chrome = Route.useLoaderData()
  const t = useT()
  return (
    <SiteProvider value={chrome}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-olive focus:px-4 focus:py-2 focus:text-limewash"
      >
        {t('nav.skipToContent')}
      </a>
      <SiteHeader />
      <main id="main">
        <Outlet />
      </main>
      <SiteFooter />
      <FloatingWhatsapp />
      <WhatsappClickTracker />
      <RevealObserver />
      <MetaPixel />
      <AttributionCapture />
    </SiteProvider>
  )
}
