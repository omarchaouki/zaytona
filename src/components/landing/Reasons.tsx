import { Banknote, FileText, MapPin, ShieldCheck, Sprout, Star, Users } from 'lucide-react'
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { useLocale, useT } from '~/i18n'
import { cn } from '~/lib/cn'
import { formatNumber } from '~/lib/format'
import type { LandingData } from '~/server/landing'
import { Emphasis } from '../Emphasis'
import { Stars } from '../reviews/Stars'
import { SectionBackdrop } from '../SectionBackdrop'
import { Button } from '../ui/button'

type ReasonsProps = Pick<LandingData, 'onssa' | 'reviews' | 'hasLabReports'>

type Reason = {
  key: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  body: ReactNode
  highlight?: boolean
  extra?: ReactNode
}

/*
 * "Why our oil, and not another?" — the conversion hook. Every card is a fact
 * the visitor can check: the ONSSA number and scan, the region, how the oil is
 * made, the payment terms, real reviews. Cards that depend on data (ONSSA,
 * reviews, lab reports) only appear once that data exists.
 */
export function Reasons({ onssa, reviews, hasLabReports }: ReasonsProps) {
  const t = useT()
  const locale = useLocale()

  const reasons: Reason[] = [
    {
      key: 'onssa',
      Icon: ShieldCheck,
      title: t('reasons.onssaTitle'),
      body: onssa
        ? t('reasons.onssaBody', { number: onssa.number })
        : t('reasons.onssaBodyNoNumber'),
      highlight: true,
      extra: (
        <a
          href="#onssa"
          className="mt-g1 inline-flex min-h-11 items-center font-bold text-oil-bright underline decoration-2 underline-offset-4"
        >
          {t('reasons.onssaLink')}
        </a>
      ),
    },
    { key: 'origin', Icon: MapPin, title: t('reasons.originTitle'), body: t('reasons.originBody') },
    { key: 'extra', Icon: Sprout, title: t('reasons.extraTitle'), body: t('reasons.extraBody') },
    { key: 'direct', Icon: Users, title: t('reasons.directTitle'), body: t('reasons.directBody') },
    { key: 'pay', Icon: Banknote, title: t('reasons.codTitle'), body: t('reasons.codBody') },
    ...(reviews && reviews.realSummary.count > 0
      ? [
          {
            key: 'reviews',
            Icon: Star,
            title: t('reasons.reviewsTitle', {
              average: formatNumber(reviews.realSummary.average, locale),
            }),
            body: t('reasons.reviewsBody', {
              count: formatNumber(reviews.realSummary.count, locale),
            }),
            extra: <Stars value={reviews.realSummary.average} className="mt-g1" />,
          },
        ]
      : []),
    ...(hasLabReports
      ? [{ key: 'lab', Icon: FileText, title: t('reasons.labTitle'), body: t('reasons.labBody') }]
      : []),
  ]

  return (
    <section
      aria-labelledby="reasons-title"
      className="relative isolate bg-olive-950 text-limewash"
    >
      <SectionBackdrop image="olives-harvest" tone="dark" position="50% 35%" motion />
      <div className="container-page section-y">
        <div data-reveal className="max-w-[38.2rem]">
          <p className="mb-g1 text-sm font-medium text-olive-400">{t('reasons.eyebrow')}</p>
          <h2 id="reasons-title" className="text-h2 text-limewash">
            <Emphasis text={t('reasons.title')} />
          </h2>
          <p className="mt-g2 text-lede text-limewash/75">{t('reasons.intro')}</p>
        </div>

        <ul className="mt-g4 grid gap-g2 sm:grid-cols-2 sm:gap-g3 lg:grid-cols-3 md:mt-g5">
          {reasons.map(({ key, Icon, title, body, highlight, extra }, i) => (
            <li
              key={key}
              data-reveal="scale"
              style={{ '--d': `${i * 0.07}s` } as React.CSSProperties}
              className={cn(
                'relative flex flex-col rounded-card p-g2 transition-[transform,border-color] duration-300 hover:-translate-y-1 sm:p-g3',
                highlight
                  ? 'border-2 border-oil bg-gradient-to-br from-oil/25 via-olive-900 to-olive-950 shadow-[0_20px_50px_-25px_rgb(217_162_27/0.6)] sm:col-span-2 lg:col-span-1'
                  : 'border border-limewash/10 bg-limewash/[0.05] hover:border-oil/40',
              )}
            >
              <span
                className={cn(
                  'flex size-10 items-center justify-center rounded-full sm:size-12',
                  highlight
                    ? 'bg-oil text-olive-950'
                    : 'bg-oil/15 text-oil-bright ring-1 ring-oil/40',
                )}
              >
                <Icon className="size-6" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h3 className="mt-g1 text-h3 text-limewash sm:mt-g2">{title}</h3>
              <p className="mt-g1 text-limewash/75">{body}</p>
              {extra}
            </li>
          ))}
        </ul>

        <div
          data-reveal
          className="mt-g4 flex flex-col items-start gap-g2 sm:flex-row sm:items-center md:mt-g5"
        >
          <Button
            asChild
            size="lg"
            className="bg-oil text-olive-950 shadow-[0_10px_30px_-10px_rgb(217_162_27/0.7)] hover:bg-oil-bright"
          >
            <a href="#order">{t('reasons.cta')}</a>
          </Button>
          {reviews && reviews.realSummary.count > 0 ? (
            <a
              href="#reviews"
              className="inline-flex min-h-11 items-center gap-g1 text-sm text-limewash/80 hover:text-limewash"
            >
              <Stars value={reviews.realSummary.average} size="sm" />
              {t('hero.rating', {
                average: formatNumber(reviews.realSummary.average, locale),
                count: formatNumber(reviews.realSummary.count, locale),
              })}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  )
}
