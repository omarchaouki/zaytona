import { ArrowLeft, ArrowRight, Banknote, ShieldCheck, Truck } from 'lucide-react'
import videos from '~/generated/videos.json'
import { useLocale, useT } from '~/i18n'
import { cn } from '~/lib/cn'
import { formatMad, formatNumber } from '~/lib/format'
import type { LandingData } from '~/server/landing'
import { ArchWindow, type VideoSource } from '../ArchWindow'
import { Emphasis } from '../Emphasis'
import { WhatsappIcon } from '../icons'
import { OliveBranch } from '../OliveBranch'
import { Picture } from '../Picture'
import { Stars } from '../reviews/Stars'
import { Button, buttonVariants } from '../ui/button'
import { WhatsappLink } from '../WhatsappLink'

/** Full-bleed background: backlit olives at golden hour (the LCP image, preloaded). */
export const HERO_BACKGROUND = 'olives-golden-hour' as const
export const HERO_BACKGROUND_SIZES = '100vw'
export const HERO_IMAGE = 'olives-harvest' as const
export const HERO_IMAGE_SIZES = '(min-width: 64rem) 22rem, (min-width: 48rem) 18rem, 61.8vw'
/** Drop assets/source/hero.mp4 (and/or .webm) and run `pnpm images` to animate the arch with video. */
const HERO_VIDEO = (videos as Record<string, VideoSource[] | undefined>).hero

type HeroProps = {
  content: LandingData['content']['hero']
  /** Approved-review average and count; the snippet is hidden until there is one. */
  rating: { average: number; count: number } | null
  /** Cheapest offer and price per litre: the price anchor under the subtitle. */
  price: { from: number | null; perLiter: number | null }
}

/*
 * Proportions follow φ: text and arch share the width 1.618 : 1, the arch is
 * 1 : 1.618 and 61.8% of the screen on phones, and every gap is a φ step.
 * Texts come from the admin (Content → Hero) when set, else the translations.
 */
export function Hero({ content, rating, price }: HeroProps) {
  const t = useT()
  const locale = useLocale()
  const subtitle = content.subtitle ?? t('hero.subtitle')
  const ArrowIcon = locale === 'ar' ? ArrowLeft : ArrowRight

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate -mt-16 overflow-hidden bg-olive-950 pt-16 text-limewash"
    >
      {/* Living background photo + the olive gradient that keeps text readable. */}
      <div aria-hidden="true" className="kenburns absolute inset-0 -z-20">
        <Picture
          image={HERO_BACKGROUND}
          alt=""
          sizes={HERO_BACKGROUND_SIZES}
          priority
          className="block h-full w-full"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-olive-950/80 via-olive-950/70 to-olive-950 md:bg-gradient-to-r md:from-olive-950 md:via-olive-950/80 md:to-olive-950/30 rtl:md:bg-gradient-to-l"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-g6 bg-gradient-to-t from-olive-950 to-transparent"
      />

      <div className="container-page grid items-center gap-g5 pt-g4 pb-g5 md:grid-cols-[1.618fr_1fr] md:pt-g6 md:pb-g6 lg:gap-g6">
        <div className="max-w-[38.2rem]">
          <p
            style={{ '--d': '0.05s' } as React.CSSProperties}
            className="rise-in mb-g3 inline-flex items-center gap-g1 rounded-full border border-olive-400/40 bg-olive-950/50 px-g2 py-g0 text-sm font-medium text-olive-200 backdrop-blur-sm"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-oil-bright" />
            {content.eyebrow ?? t('hero.eyebrow')}
          </p>
          <h1
            id="hero-title"
            className="text-display text-limewash [text-shadow:0_2px_24px_rgb(20_27_12/0.6)]"
          >
            <Emphasis text={content.title ?? t('hero.title')} />
          </h1>
          <p
            style={{ '--d': '0.25s' } as React.CSSProperties}
            className="rise-in mt-g3 max-w-[32rem] text-lede text-limewash/85"
          >
            {subtitle}
          </p>
          {price.from !== null ? (
            <p
              style={{ '--d': '0.32s' } as React.CSSProperties}
              className="rise-in mt-g2 inline-flex flex-wrap items-baseline gap-x-2 rounded-full bg-olive-950/60 px-g2 py-1.5 text-limewash backdrop-blur-sm"
            >
              <span className="text-sm text-limewash/75">{t('hero.from')}</span>
              <span className="text-lg font-bold text-oil-bright tabular-nums">
                {formatMad(price.from, locale)}
              </span>
              {price.perLiter !== null ? (
                <span className="text-sm text-limewash/75 tabular-nums">
                  · {t('products.perLiter', { price: formatMad(price.perLiter, locale) })}
                </span>
              ) : null}
            </p>
          ) : null}
          <div
            data-hero-cta
            style={{ '--d': '0.4s' } as React.CSSProperties}
            className="rise-in mt-g4 flex flex-col gap-g2 sm:flex-row"
          >
            <Button
              asChild
              size="lg"
              className="bg-oil text-olive-950 shadow-[0_10px_30px_-10px_rgb(217_162_27/0.7)] hover:bg-oil-bright"
            >
              <a href="#order">
                {t('hero.ctaOrder')}
                <ArrowIcon aria-hidden="true" />
              </a>
            </Button>
            <WhatsappLink
              placement="hero"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'border-limewash/35 bg-olive-950/30 text-limewash backdrop-blur-sm hover:border-limewash hover:bg-limewash/10',
              )}
            >
              <WhatsappIcon className="text-whatsapp" />
              {t('hero.ctaWhatsapp')}
            </WhatsappLink>
          </div>
          {/* What ad visitors worry about, answered under the button. */}
          <ul
            style={{ '--d': '0.5s' } as React.CSSProperties}
            className="rise-in mt-g2 flex flex-wrap gap-x-g2 gap-y-1 text-sm text-limewash/85"
          >
            {[
              { Icon: Banknote, text: t('hero.assureCod') },
              { Icon: Truck, text: t('hero.assureDelivery') },
              { Icon: ShieldCheck, text: t('hero.assureOnssa') },
            ].map(({ Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-1.5">
                <Icon className="size-4 text-oil-bright" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
          {rating && rating.count > 0 ? (
            <a
              href="#reviews"
              style={{ '--d': '0.55s' } as React.CSSProperties}
              className="rise-in mt-g3 inline-flex min-h-11 items-center gap-g1 text-sm text-limewash/85 hover:text-limewash"
            >
              <Stars value={rating.average} />
              <span>
                {t('hero.rating', {
                  average: formatNumber(rating.average, locale),
                  count: formatNumber(rating.count, locale),
                })}
              </span>
            </a>
          ) : null}
        </div>

        <div
          style={{ '--d': '0.2s' } as React.CSSProperties}
          className="rise-in relative mx-auto w-[61.8vw] max-w-[16rem] md:w-full md:max-w-[22rem]"
        >
          <OliveBranch className="absolute -start-[24%] -bottom-[3%] w-[44%] md:-start-[34%] md:w-[52%]" />
          {/* Soft gold halo behind the arch. */}
          <div
            aria-hidden="true"
            className="absolute inset-[8%] rounded-t-full bg-oil/30 blur-3xl"
          />
          <ArchWindow
            slides={[
              { image: HERO_IMAGE, alt: t('hero.imageAlt') },
              { image: 'grove-path', alt: '' },
            ]}
            sizes={HERO_IMAGE_SIZES}
            video={HERO_VIDEO}
            traceColor="var(--color-oil-bright)"
            className="relative"
          />
        </div>
      </div>
    </section>
  )
}
