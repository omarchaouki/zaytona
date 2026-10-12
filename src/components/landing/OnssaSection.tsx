import { FileCheck2, Route as RouteIcon, ShieldCheck, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { ComponentType, SVGProps } from 'react'
import { useLocale, useT } from '~/i18n'
import { cn } from '~/lib/cn'
import { formatDay } from '~/lib/format'
import type { LandingCertification } from '~/server/landing'
import { Emphasis } from '../Emphasis'
import { WhatsappIcon } from '../icons'
import { Picture } from '../Picture'
import { buttonVariants } from '../ui/button'
import { WhatsappLink } from '../WhatsappLink'

/*
 * The cooperative's ONSSA food-safety authorisation, on paper-coloured ground
 * like an official document. Signature: the round seal is "pressed" onto the
 * page as it scrolls in, then its ring text turns slowly. The number, dates
 * and scan come from Admin → Certificates; nothing is shown that isn't there.
 */
export function OnssaSection({ cert }: { cert: LandingCertification | null }) {
  const t = useT()
  const points: Array<{
    Icon: ComponentType<SVGProps<SVGSVGElement>>
    title: string
    body: string
  }> = [
    { Icon: ShieldCheck, title: t('onssa.point1Title'), body: t('onssa.point1Body') },
    { Icon: RouteIcon, title: t('onssa.point2Title'), body: t('onssa.point2Body') },
    { Icon: FileCheck2, title: t('onssa.point3Title'), body: t('onssa.point3Body') },
  ]

  return (
    <section
      id="onssa"
      aria-labelledby="onssa-title"
      className="relative isolate scroll-mt-16 overflow-hidden bg-sand"
    >
      {/* Paper: olive-sprig texture and a double rule top and bottom, like a certificate border. */}
      <div aria-hidden="true" className="pattern-on-light absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1.5 border-b border-olive-600/25 bg-olive-600"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1.5 border-t border-olive-600/25 bg-olive-600"
      />

      <div className="container-page section-y grid items-center gap-g5 lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] lg:gap-g6">
        <div>
          <div data-reveal>
            <p className="mb-g1 inline-flex items-center gap-2 text-sm font-medium text-olive-600">
              <ShieldCheck className="size-4" aria-hidden="true" />
              {t('onssa.eyebrow')}
            </p>
            <h2 id="onssa-title" className="text-h2">
              <Emphasis text={t('onssa.title')} className="text-olive-600" />
            </h2>
            <p className="mt-g2 max-w-[38rem] text-lede text-ink-soft">{t('onssa.intro')}</p>
          </div>

          <ul className="mt-g4 grid gap-g2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {points.map(({ Icon, title, body }, i) => (
              <li
                key={title}
                data-reveal
                style={{ '--d': `${0.1 + i * 0.1}s` } as React.CSSProperties}
                className="flex gap-g2 rounded-card bg-limewash/80 p-g2 ring-1 ring-olive-600/15 sm:flex-col"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-olive-600 text-limewash">
                  <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold text-olive">{title}</h3>
                  <p className="mt-1 text-[0.9375rem] text-ink-soft">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <CertificateCard cert={cert} />
      </div>
    </section>
  )
}

/** The document itself: seal, number, dates, and the scan or a way to ask for it. */
function CertificateCard({ cert }: { cert: LandingCertification | null }) {
  const t = useT()
  const locale = useLocale()
  return (
    <div
      data-reveal="scale"
      style={{ '--d': '0.15s' } as React.CSSProperties}
      className="relative mx-auto w-full max-w-md rounded-[6px] bg-limewash p-g3 text-center shadow-[0_30px_60px_-30px_rgb(29_39_18/0.55)] ring-1 ring-olive-600/20 sm:p-g4"
    >
      {/* Inner border of an official paper. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-2 rounded-[3px] border border-double border-olive-600/30 [border-width:3px]"
      />
      <p className="relative text-xs font-bold tracking-[0.2em] text-olive-600 uppercase">
        {t('onssa.cardKicker')}
      </p>
      <h3 className="relative mt-1 text-h3">{t('onssa.cardTitle')}</h3>

      <div
        data-reveal="stamp"
        style={{ '--d': '0.45s' } as React.CSSProperties}
        className="relative"
      >
        <OnssaSeal number={cert?.number ?? null} />
      </div>

      {cert ? (
        <dl className="relative mt-g2 grid gap-g1 text-[0.9375rem]">
          <div className="flex flex-wrap items-baseline justify-center gap-x-2">
            <dt className="text-ink-soft">{t('onssa.number')}</dt>
            <dd className="font-bold text-olive tabular-nums" dir="ltr">
              {cert.number}
            </dd>
          </div>
          {cert.issuedAt ? (
            <div className="flex flex-wrap items-baseline justify-center gap-x-2">
              <dt className="text-ink-soft">{t('onssa.issued')}</dt>
              <dd className="font-medium">{formatDay(cert.issuedAt, locale, 'long')}</dd>
            </div>
          ) : null}
          {cert.expiresAt ? (
            <div className="flex flex-wrap items-baseline justify-center gap-x-2">
              <dt className="text-ink-soft">{t('onssa.expires')}</dt>
              <dd className="font-medium">{formatDay(cert.expiresAt, locale, 'long')}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="relative mt-g3 flex flex-col gap-g1">
        {cert?.image ? <CertificateDialog cert={cert} /> : null}
        <WhatsappLink
          placement="onssa"
          text={t('onssa.askMessage')}
          className={cn(
            buttonVariants({ variant: cert?.image ? 'ghost' : 'outline' }),
            'w-full whitespace-normal text-center',
          )}
        >
          <WhatsappIcon className="text-whatsapp-deep" />
          {t('onssa.ask')}
        </WhatsappLink>
      </div>
    </div>
  )
}

/** Round ink seal. Symmetric, so it reads the same in Arabic and French. */
function OnssaSeal({ number }: { number: string | null }) {
  const t = useT()
  return (
    <svg
      viewBox="0 0 160 160"
      // The seal's Latin text runs left to right even on the Arabic page
      // (an inherited rtl direction pushes the ring text off its circle).
      direction="ltr"
      className="mx-auto mt-g2 size-40 text-olive-600 [direction:ltr] sm:size-44"
      role="img"
      aria-label={number ? t('onssa.sealLabel', { number }) : t('onssa.sealLabelNoNumber')}
    >
      <defs>
        <path id="onssa-ring" d="M80 80 m-58 0 a58 58 0 1 1 116 0 a58 58 0 1 1 -116 0" />
      </defs>
      <g className="seal-spin">
        <circle cx="80" cy="80" r="74" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle
          cx="80"
          cy="80"
          r="68"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
        <text
          fill="currentColor"
          fontSize="10.5"
          fontWeight="600"
          letterSpacing="2.2"
          fontFamily="var(--font-body-fr)"
        >
          <textPath href="#onssa-ring" startOffset="0">
            AUTORISATION SANITAIRE • ONSSA • MAROC •
          </textPath>
        </text>
      </g>
      <circle
        cx="80"
        cy="80"
        r="46"
        fill="currentColor"
        fillOpacity="0.07"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text
        x="80"
        y={number ? 80 : 86}
        textAnchor="middle"
        fill="currentColor"
        fontSize="20"
        fontWeight="700"
        fontFamily="var(--font-body-fr)"
      >
        ONSSA
      </text>
      {number ? (
        <text
          x="80"
          y="98"
          textAnchor="middle"
          fill="currentColor"
          fontSize={number.length > 14 ? 7.5 : 10}
          fontFamily="var(--font-body-fr)"
        >
          {number}
        </text>
      ) : null}
    </svg>
  )
}

function CertificateDialog({ cert }: { cert: LandingCertification }) {
  const t = useT()
  if (!cert.image) return null
  return (
    <Dialog.Root>
      <Dialog.Trigger className={cn(buttonVariants(), 'w-full')}>
        <FileCheck2 aria-hidden="true" />
        {t('onssa.view')}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 top-1/2 z-50 mx-auto max-h-[90dvh] max-w-2xl -translate-y-1/2 overflow-auto rounded-card bg-limewash p-4 shadow-lift focus:outline-none sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="font-display text-h3 text-olive">
              {t('onssa.cardTitle')}
            </Dialog.Title>
            <Dialog.Close
              className="tap inline-flex items-center justify-center rounded-full text-olive hover:bg-olive/5"
              aria-label={t('whyUs.close')}
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {t('whyUs.certificateAlt', { number: cert.number })}
          </Dialog.Description>
          <Picture
            image={cert.image}
            alt={t('whyUs.certificateAlt', { number: cert.number })}
            sizes="(min-width: 42rem) 40rem, 94vw"
            imgClassName="h-auto object-contain"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
