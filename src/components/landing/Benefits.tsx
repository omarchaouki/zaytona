import { ChefHat, Droplet, HeartPulse, Leaf, ShieldCheck, Sparkles } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { type MessageKey, useT } from '~/i18n'
import { ArchWindow } from '../ArchWindow'
import { Emphasis } from '../Emphasis'
import { Button } from '../ui/button'

type Benefit = {
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  title: MessageKey
  body: MessageKey
}

/*
 * Wording follows the nutrition claims authorised for olive oil (healthy fats
 * replacing saturated fats, vitamin E), plus facts about taste, cooking and
 * Moroccan tradition. No cure or prevention claims: they are not allowed on
 * food and Meta rejects ads that lead to them.
 */
const NUTRITION: Benefit[] = [
  { Icon: HeartPulse, title: 'benefits.fatsTitle', body: 'benefits.fatsBody' },
  { Icon: ShieldCheck, title: 'benefits.vitaminTitle', body: 'benefits.vitaminBody' },
  { Icon: Leaf, title: 'benefits.polyphenolsTitle', body: 'benefits.polyphenolsBody' },
]
const EVERYDAY: Benefit[] = [
  { Icon: ChefHat, title: 'benefits.cookingTitle', body: 'benefits.cookingBody' },
  { Icon: Droplet, title: 'benefits.tableTitle', body: 'benefits.tableBody' },
  { Icon: Sparkles, title: 'benefits.careTitle', body: 'benefits.careBody' },
]

/**
 * "Benefits of olive oil": warm oil-gold ground between the offers and the
 * reasons. Phones: the arch photo, then the six cards. Desktop: three cards
 * either side of the arch, then the order button.
 */
export function Benefits() {
  const t = useT()
  return (
    <section
      aria-labelledby="benefits-title"
      className="relative isolate overflow-hidden bg-gradient-to-b from-oil-soft/70 via-limewash to-limewash"
    >
      <div aria-hidden="true" className="pattern-on-light absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="absolute start-1/2 top-24 -z-10 size-[28rem] -translate-x-1/2 rounded-full bg-oil/25 blur-3xl rtl:translate-x-1/2"
      />

      <div className="container-page section-y">
        <div data-reveal className="mx-auto max-w-[38.2rem] text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-olive-950 px-g2 py-1.5 text-sm font-medium text-oil-bright">
            <Droplet className="size-4" aria-hidden="true" />
            {t('benefits.eyebrow')}
          </p>
          <h2 id="benefits-title" className="mt-g2 text-h2">
            <Emphasis text={t('benefits.title')} className="text-oil-deep" />
          </h2>
          <p className="mt-g1 text-lede text-ink-soft">{t('benefits.intro')}</p>
        </div>

        <div className="mt-g4 grid items-center gap-g3 md:mt-g5 lg:grid-cols-[minmax(0,1fr)_16rem_minmax(0,1fr)] lg:gap-g4 [&>*]:min-w-0">
          <div
            data-reveal="scale"
            className="mx-auto w-[56vw] max-w-[13rem] lg:order-2 lg:w-full lg:max-w-none"
          >
            <ArchWindow
              slides={[
                { image: 'oil-pour', alt: t('benefits.imageAlt') },
                { image: 'olives-golden-hour', alt: '' },
              ]}
              sizes="(min-width: 64rem) 16rem, 56vw"
              traceColor="var(--color-oil-deep)"
            />
          </div>
          <BenefitList items={NUTRITION} className="lg:order-1" from={0} />
          <BenefitList items={EVERYDAY} className="lg:order-3" from={3} />
        </div>

        <div data-reveal className="mt-g4 flex flex-col items-center gap-g1 text-center md:mt-g5">
          <Button
            asChild
            size="lg"
            className="w-full bg-olive text-limewash shadow-[0_10px_30px_-12px_rgb(46_59_31/0.7)] sm:w-auto"
          >
            <a href="#order">{t('benefits.cta')}</a>
          </Button>
          <p className="max-w-[34rem] text-xs text-ink-soft">{t('benefits.note')}</p>
        </div>
      </div>
    </section>
  )
}

function BenefitList({
  items,
  className,
  from,
}: {
  items: Benefit[]
  className?: string
  from: number
}) {
  const t = useT()
  return (
    <ul className={`grid gap-g2 sm:grid-cols-3 lg:grid-cols-1 ${className ?? ''}`}>
      {items.map(({ Icon, title, body }, i) => (
        <li
          key={title}
          data-reveal="start"
          style={{ '--d': `${(from + i) * 0.06}s` } as React.CSSProperties}
          className="flex gap-g2 rounded-card bg-white/85 p-g2 shadow-lift ring-1 ring-oil/25 backdrop-blur-sm sm:flex-col lg:flex-row"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-oil/20 text-oil-deep ring-1 ring-oil/40">
            <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-olive">{t(title)}</h3>
            <p className="mt-1 text-[0.9375rem] text-ink-soft">{t(body)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
