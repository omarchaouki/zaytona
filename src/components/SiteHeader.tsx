import { Link } from '@tanstack/react-router'
import { LOCALE_META, otherLocale, useLocale, useSwitchLocaleHref, useT } from '~/i18n'
import { ArchMark } from './icons'
import { useSite } from './SiteContext'
import { Button } from './ui/button'

export function SiteHeader() {
  const t = useT()
  const locale = useLocale()
  const { name } = useSite()
  const target = otherLocale(locale)
  // Keep the visitor on the same page when switching language.
  const switchPath = useSwitchLocaleHref(target)

  return (
    <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)] border-b border-limewash/10 bg-olive-950/90 text-limewash backdrop-blur-md supports-[backdrop-filter]:bg-olive-950/70">
      <div className="container-page flex h-16 items-center gap-3">
        <Link
          to="/$locale"
          params={{ locale }}
          className="tap -ms-1 flex items-center gap-2.5 rounded-md ps-1 pe-2"
          aria-label={t('brand.homeLink')}
        >
          <ArchMark className="h-7 w-5 [&_path:first-child]:fill-olive-400" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[1.0625rem] font-bold text-limewash">{name}</span>
            <span className="mt-1 text-xs text-olive-200/80">{t('brand.place')}</span>
          </span>
        </Link>

        <nav aria-label={t('nav.language')} className="ms-auto">
          <a
            href={switchPath}
            hrefLang={target}
            lang={LOCALE_META[target].htmlLang}
            aria-label={t('nav.switchToLabel')}
            className="tap inline-flex items-center rounded-full border border-limewash/20 px-3.5 text-sm font-medium text-limewash transition-colors hover:border-limewash/60 hover:bg-limewash/10"
          >
            {t('nav.switchTo')}
          </a>
        </nav>

        <Button
          asChild
          size="md"
          className="hidden bg-oil text-olive-950 hover:bg-oil-bright sm:inline-flex"
        >
          {/* From any page; on the home page only the fragment changes (no reload). */}
          <a href={`/${locale}#order`}>{t('nav.orderNow')}</a>
        </Button>
      </div>
    </header>
  )
}
