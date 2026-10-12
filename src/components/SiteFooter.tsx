import { Link } from '@tanstack/react-router'
import { MapPin } from 'lucide-react'
import { useState } from 'react'
import { LOCALE_META, otherLocale, useLocale, useSwitchLocaleHref, useT } from '~/i18n'
import { formatPhoneDisplay } from '~/lib/phone'
import { ArchMark } from './icons'
import { OliveBranch } from './OliveBranch'
import { useSite } from './SiteContext'
import { WhatsappLink } from './WhatsappLink'

const SOCIAL_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
} as const

export function SiteFooter() {
  const t = useT()
  const locale = useLocale()
  const site = useSite()
  const { contact } = site
  const target = otherLocale(locale)
  const switchPath = useSwitchLocaleHref(target)
  const socials = Object.entries(contact.socials).filter(
    (e): e is [keyof typeof SOCIAL_LABELS, string] => Boolean(e[1]),
  )
  const year = new Date().getFullYear()

  const linkClass =
    'tap inline-flex items-center rounded text-limewash/90 underline-offset-4 hover:text-limewash hover:underline'

  return (
    <footer className="relative overflow-hidden bg-olive-950 pb-[calc(var(--mobile-bar-h)+env(safe-area-inset-bottom))] text-limewash">
      <OliveBranch className="pointer-events-none absolute -end-g4 -top-g3 w-40 rotate-[200deg] opacity-25 md:w-56" />
      <div
        data-reveal="fade"
        className="container-page relative grid gap-10 py-14 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <ArchMark className="h-8 w-6 [&_path:first-child]:fill-olive-400" />
            <p className="font-display text-xl font-bold">{site.name}</p>
          </div>
          {contact.address ? (
            <p className="mt-4 max-w-[22rem] whitespace-pre-line text-limewash/85">
              {contact.address}
            </p>
          ) : null}
          {contact.mapUrl ? (
            <a
              href={contact.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkClass} mt-2 gap-1.5`}
            >
              <MapPin className="size-4" aria-hidden="true" />
              {t('footer.openMap')}
            </a>
          ) : null}
          {contact.mapEmbedUrl ? <MapReveal src={contact.mapEmbedUrl} /> : null}
          {site.onssaNumber ? (
            <p className="mt-5 text-sm text-limewash/75">
              {t('footer.onssa', { number: site.onssaNumber })}
            </p>
          ) : null}
        </div>

        <div>
          <h2 className="font-display text-lg text-limewash">{t('footer.contact')}</h2>
          <ul className="mt-3 space-y-1">
            {contact.phones.map((phone) => (
              <li key={phone}>
                <a href={`tel:${phone}`} className={linkClass}>
                  <span className="sr-only">{t('footer.phone')}: </span>
                  <span dir="ltr">{formatPhoneDisplay(phone)}</span>
                </a>
              </li>
            ))}
            <li>
              <WhatsappLink placement="footer" className={linkClass}>
                {t('footer.whatsapp')}
              </WhatsappLink>
            </li>
            {contact.email ? (
              <li>
                <a href={`mailto:${contact.email}`} className={linkClass} dir="ltr">
                  {contact.email}
                </a>
              </li>
            ) : null}
          </ul>
          {contact.hours ? (
            <p className="mt-4 text-sm text-limewash/80">
              <span className="font-medium text-limewash">{t('footer.hours')}: </span>
              {contact.hours}
            </p>
          ) : null}
          {socials.length ? (
            <>
              <h2 className="mt-6 font-display text-lg text-limewash">{t('footer.follow')}</h2>
              <ul className="mt-2 flex flex-wrap gap-x-4">
                {socials.map(([key, url]) => (
                  <li key={key}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {SOCIAL_LABELS[key]}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <div>
          <h2 className="font-display text-lg text-limewash">{t('footer.legal')}</h2>
          <ul className="mt-3 space-y-1">
            <li>
              <Link to="/$locale/privacy" params={{ locale }} className={linkClass}>
                {t('footer.privacy')}
              </Link>
            </li>
            <li>
              <Link to="/$locale/terms" params={{ locale }} className={linkClass}>
                {t('footer.terms')}
              </Link>
            </li>
            <li>
              <a
                href={switchPath}
                hrefLang={target}
                lang={LOCALE_META[target].htmlLang}
                className={linkClass}
              >
                {t('nav.switchTo')}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-limewash/15">
        <p className="container-page py-5 text-sm text-limewash/70">
          {t('footer.rights', { year, name: site.name })}
        </p>
      </div>
    </footer>
  )
}

/** The map iframe is heavy; load it only when the visitor asks for it. */
function MapReveal({ src }: { src: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap mt-2 block rounded text-start text-limewash/90 underline underline-offset-4 hover:text-limewash"
      >
        {t('footer.showMap')}
      </button>
    )
  }
  return (
    <iframe
      src={src}
      title={t('footer.mapTitle')}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className="mt-4 aspect-[4/3] w-full max-w-[22rem] rounded-card border-0"
    />
  )
}
