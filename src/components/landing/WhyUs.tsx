import { Link } from '@tanstack/react-router'
import { Banknote, Clock, MessageCircle, PackageCheck, ShieldCheck, Truck } from 'lucide-react'
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { useLocale, useT } from '~/i18n'
import { formatMad, formatNumber } from '~/lib/format'
import { formatPhoneDisplay } from '~/lib/phone'
import type { LandingData } from '~/server/landing'
import { SectionBackdrop } from '../SectionBackdrop'
import { useSite } from '../SiteContext'
import { Button } from '../ui/button'
import { WhatsappLink } from '../WhatsappLink'
import { SectionHeading } from './SectionHeading'

type WhyUsProps = Pick<LandingData, 'onssa' | 'certifications' | 'stats' | 'content'> & {
  delivery: LandingData['settings']['delivery']
}

export function WhyUs({ onssa, certifications, stats, content, delivery }: WhyUsProps) {
  const t = useT()
  const locale = useLocale()
  const { contact, legal } = useSite()
  const others = certifications.filter((c) => c.id !== onssa?.id && c.number.trim())

  const deliveryText =
    content.policies.delivery ??
    (delivery.mode === 'flat' && delivery.fee === 0
      ? t('whyUs.deliveryFree')
      : delivery.mode === 'flat' && delivery.fee !== null
        ? t('whyUs.deliveryFlat', { fee: formatMad(delivery.fee, locale) })
        : delivery.mode === 'free_above' && delivery.fee !== null && delivery.freeAbove !== null
          ? t('whyUs.deliveryFreeAbove', {
              fee: formatMad(delivery.fee, locale),
              threshold: formatMad(delivery.freeAbove, locale),
            })
          : t('whyUs.deliveryConfirm'))

  return (
    <section aria-labelledby="why-title" className="relative isolate bg-olive-950 text-limewash">
      <SectionBackdrop image="grove-path" tone="dark" />
      <div className="container-page section-y">
        <div data-reveal>
          <SectionHeading
            id="why-title"
            title={t('whyUs.title')}
            intro={t('whyUs.intro')}
            className="[&_h2]:text-limewash [&_p]:text-limewash/75"
          />
        </div>

        <ul className="mt-g4 grid gap-g2 sm:grid-cols-2 sm:gap-g3 md:mt-g5">
          <Assurance Icon={Banknote} title={t('whyUs.codTitle')}>
            {content.policies.cod ?? t('whyUs.codBody')}
          </Assurance>
          <Assurance Icon={Truck} title={t('whyUs.deliveryTitle')}>
            {deliveryText}
            {delivery.time ? <> {delivery.time}</> : null}
          </Assurance>
          <Assurance Icon={PackageCheck} title={t('whyUs.returnsTitle')}>
            {content.policies.returns ?? t('whyUs.returnsBody')} <PolicyLink page="terms" />
          </Assurance>
          <Assurance Icon={ShieldCheck} title={t('whyUs.privacyTitle')}>
            {content.policies.privacy ?? t('whyUs.privacyBody')} <PolicyLink page="privacy" />
          </Assurance>
        </ul>

        {others.length ? (
          <div className="mt-12">
            <h3 className="text-h3 text-limewash">{t('whyUs.otherCerts')}</h3>
            <ul className="mt-4 flex flex-wrap gap-3">
              {others.map((c) => (
                <li
                  key={c.id}
                  className="rounded-full border border-limewash/20 bg-limewash/5 px-4 py-2 text-sm"
                >
                  <span className="font-medium text-oil-bright">
                    {c.label ?? c.type.toUpperCase()}
                  </span>
                  <span className="text-limewash/70"> · {c.number}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-g5 grid gap-g4 border-t border-limewash/15 pt-g4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <h3 className="text-h3 text-limewash">{t('whyUs.contactTitle')}</h3>
            <p className="mt-2 text-limewash/75">{t('whyUs.contactBody')}</p>
            <dl className="mt-5 grid gap-3 text-[0.9375rem] sm:grid-cols-2">
              {contact.hours ? (
                <Fact Icon={Clock} label={t('whyUs.hours')} value={contact.hours} />
              ) : null}
              {contact.responseTime ? (
                <Fact
                  Icon={MessageCircle}
                  label={t('whyUs.responseTime')}
                  value={contact.responseTime}
                />
              ) : null}
            </dl>
            {stats.deliveredOrders ? (
              <p className="mt-6 text-limewash/75">
                <span className="font-display text-h3 text-oil-bright tabular-nums">
                  {formatNumber(stats.deliveredOrders, locale)}
                </span>{' '}
                {t('whyUs.delivered')}
              </p>
            ) : null}
            {legal && (legal.legalName || legal.ice || legal.rc) ? (
              <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-sm text-limewash/70">
                {legal.legalName ? (
                  <LegalId label={t('whyUs.legalName')} value={legal.legalName} />
                ) : null}
                {legal.ice ? <LegalId label={t('whyUs.ice')} value={legal.ice} /> : null}
                {legal.rc ? <LegalId label={t('whyUs.rc')} value={legal.rc} /> : null}
              </dl>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {contact.phones[0] ? (
              <Button
                asChild
                variant="outline"
                className="border-limewash/30 text-limewash hover:border-limewash hover:bg-limewash/10"
              >
                <a href={`tel:${contact.phones[0]}`} dir="ltr">
                  {formatPhoneDisplay(contact.phones[0])}
                </a>
              </Button>
            ) : null}
            <WhatsappLink
              placement="why_us"
              className="tap inline-flex items-center justify-center gap-2 rounded-full bg-whatsapp px-5 py-2.5 font-medium text-whatsapp-ink shadow-lift hover:brightness-95"
            >
              {t('finalCta.whatsapp')}
            </WhatsappLink>
          </div>
        </div>
      </div>
    </section>
  )
}

function PolicyLink({ page }: { page: 'privacy' | 'terms' }) {
  const t = useT()
  const locale = useLocale()
  return (
    <Link
      to={page === 'privacy' ? '/$locale/privacy' : '/$locale/terms'}
      params={{ locale }}
      className="inline-flex min-h-11 items-center font-medium text-oil-bright underline decoration-oil/60 decoration-2 underline-offset-4 hover:decoration-oil-bright"
    >
      {t('whyUs.readMore')}
    </Link>
  )
}

function Assurance({
  Icon,
  title,
  children,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  children: ReactNode
}) {
  return (
    <li
      data-reveal
      className="flex gap-g2 rounded-card border border-limewash/10 bg-limewash/[0.05] p-g2 transition-colors hover:border-oil/40 hover:bg-limewash/[0.08] sm:p-g3"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-oil text-olive-950">
        <Icon className="size-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-h3 text-limewash">{title}</h3>
        <p className="mt-1.5 text-limewash/75">{children}</p>
      </div>
    </li>
  )
}

function Fact({
  Icon,
  label,
  value,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-1 size-4 shrink-0 text-olive-400" aria-hidden="true" />
      <div>
        <dt className="font-medium text-limewash">{label}</dt>
        <dd className="text-limewash/70">{value}</dd>
      </div>
    </div>
  )
}

function LegalId({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt>{label}:</dt>
      <dd className="font-medium text-limewash" dir="ltr">
        {value}
      </dd>
    </div>
  )
}
