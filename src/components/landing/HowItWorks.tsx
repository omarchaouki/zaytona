import { ClipboardList, MessageCircle, Truck } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { useLocale, useT } from '~/i18n'
import { formatNumber } from '~/lib/format'
import { Emphasis } from '../Emphasis'
import { SectionBackdrop } from '../SectionBackdrop'
import { Button } from '../ui/button'

type Step = {
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  body: string
  tag: string
}

/**
 * "How to order": three steps over the golden-hour grove. Phones get a
 * vertical timeline (numbered beads on a gold thread, a frosted card per
 * step); from tablets the steps sit side by side on a horizontal thread.
 */
export function HowItWorks() {
  const t = useT()
  const locale = useLocale()

  const steps: Step[] = [
    {
      Icon: ClipboardList,
      title: t('how.step1Title'),
      body: t('how.step1Body'),
      tag: t('how.step1Tag'),
    },
    {
      Icon: MessageCircle,
      title: t('how.step2Title'),
      body: t('how.step2Body'),
      tag: t('how.step2Tag'),
    },
    {
      Icon: Truck,
      title: t('how.step3Title'),
      body: t('how.step3Body'),
      tag: t('how.step3Tag'),
    },
  ]

  return (
    <section aria-labelledby="how-title" className="relative isolate">
      <SectionBackdrop image="olives-golden-hour" tone="photo" position="50% 70%" motion />
      <div className="container-page section-y">
        <div data-reveal className="mx-auto max-w-[38.2rem] text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-olive-950 px-g2 py-1.5 text-sm font-medium text-oil-bright shadow-lift">
            <span className="size-1.5 rounded-full bg-oil-bright" aria-hidden="true" />
            {t('how.eyebrow')}
          </p>
          <h2 id="how-title" className="mt-g2 text-h2">
            <Emphasis text={t('how.title')} className="text-oil-deep" />
          </h2>
          <p className="mt-g1 text-lede text-ink-soft">{t('how.intro')}</p>
        </div>

        <ol className="relative mx-auto mt-g4 grid max-w-[64rem] gap-g3 md:mt-g5 md:grid-cols-3 md:gap-g3">
          {/* The gold thread: down the bead column on phones, across the beads from tablets. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-7 start-[1.6875rem] w-0.5 rounded-full bg-gradient-to-b from-oil via-oil/70 to-oil/20 md:inset-x-[16.6%] md:inset-y-auto md:top-[1.6875rem] md:h-0.5 md:w-auto md:bg-gradient-to-r rtl:md:bg-gradient-to-l"
          />
          {steps.map(({ Icon, title, body, tag }, i) => (
            <li
              key={title}
              data-reveal
              style={{ '--d': `${i * 0.12}s` } as React.CSSProperties}
              className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-g2 md:flex md:flex-col md:items-center"
            >
              <span className="relative z-10 flex size-14 items-center justify-center rounded-full bg-olive-950 font-display text-[1.618rem] leading-none font-bold text-oil-bright tabular-nums shadow-[0_10px_24px_-10px_rgb(20_27_12/0.8)] ring-4 ring-limewash">
                <span className="sr-only">{t('how.stepLabel', { n: i + 1 })}</span>
                <span aria-hidden="true">{formatNumber(i + 1, locale)}</span>
              </span>
              <div className="rounded-card bg-limewash/90 p-g2 shadow-lift ring-1 ring-white/70 backdrop-blur-md md:mt-g2 md:w-full md:flex-1 md:p-g3 md:text-center">
                <div className="flex items-center gap-g1 md:flex-col">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-oil/20 text-olive-600 ring-1 ring-oil/40 md:size-12">
                    <Icon className="size-5 md:size-6" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <h3 className="text-h3">{title}</h3>
                </div>
                <p className="mt-g1 text-ink-soft">{body}</p>
                <p className="mt-g2 inline-flex rounded-full bg-olive/[0.07] px-3 py-1 text-sm font-medium text-olive-600">
                  {tag}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div data-reveal className="mt-g4 flex justify-center md:mt-g5">
          <Button
            asChild
            size="lg"
            className="w-full bg-oil text-olive-950 shadow-[0_10px_30px_-10px_rgb(217_162_27/0.8)] hover:bg-oil-bright sm:w-auto"
          >
            <a href="#order">{t('how.cta')}</a>
          </Button>
        </div>
      </div>
    </section>
  )
}
