import { ArrowLeft, ArrowRight, Droplets, FileText } from 'lucide-react'
import { useLocale, useT } from '~/i18n'
import { cn } from '~/lib/cn'
import { formatMad } from '~/lib/format'
import { selectOffer } from '~/lib/offer-select'
import type { LandingData, LandingProduct } from '~/server/landing'
import { WhatsappIcon } from '../icons'
import { Picture } from '../Picture'
import { SectionBackdrop } from '../SectionBackdrop'
import { useSite } from '../SiteContext'
import { buttonVariants } from '../ui/button'
import { WhatsappLink } from '../WhatsappLink'
import { SectionHeading } from './SectionHeading'

const CARD_SIZES = '(min-width: 64rem) 16rem, (min-width: 40rem) 45vw, 8rem'

/*
 * The offers. No sideways scrolling anywhere: on phones every offer is a
 * compact horizontal card (photo beside the volume and price) stacked in one
 * column; from 640px a 2-column grid of tall cards, from 1024px all in a row.
 */
export function Products({
  products,
  pricing,
}: {
  products: LandingProduct[]
  pricing: LandingData['settings']['pricing']
}) {
  const t = useT()
  const { whatsappNumber } = useSite()
  const custom = pricing.custom && pricing.pricePerLiter !== null
  const count = products.length + (custom ? 1 : 0)

  return (
    <section aria-labelledby="products-title" className="relative isolate">
      <SectionBackdrop image="grove-panorama" tone="light" position="50% 40%" />
      <div className="container-page section-y">
        <div data-reveal>
          <SectionHeading
            id="products-title"
            eyebrow={t('products.eyebrow')}
            title={t('products.title')}
            intro={t('products.intro')}
          />
        </div>

        {products.length === 0 ? (
          <p className="mt-g4 max-w-[36rem] rounded-card bg-sand/70 p-6 text-ink-soft">
            {t('products.empty')}
          </p>
        ) : (
          <ul
            className={cn(
              'mt-g4 grid gap-g2 sm:grid-cols-2 sm:gap-g3 md:mt-g5',
              count >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
            )}
          >
            {products.map((p, i) => (
              <li key={p.id} data-reveal style={{ '--d': `${i * 0.08}s` } as React.CSSProperties}>
                <ProductCard product={p} />
              </li>
            ))}
            {custom && pricing.custom && pricing.pricePerLiter !== null ? (
              <li
                data-reveal
                style={{ '--d': `${products.length * 0.08}s` } as React.CSSProperties}
              >
                <CustomQuantityCard
                  pricePerLiter={pricing.pricePerLiter}
                  min={pricing.custom.min}
                  max={pricing.custom.max}
                />
              </li>
            ) : null}
          </ul>
        )}

        {whatsappNumber ? (
          <p
            data-reveal
            className="mt-g3 flex flex-wrap items-center gap-x-2 text-ink-soft sm:mt-g4"
          >
            {t('products.help')}
            <WhatsappLink
              placement="products_help"
              className="tap inline-flex items-center gap-1.5 font-medium text-olive underline decoration-oil decoration-2 underline-offset-4 hover:decoration-olive"
            >
              {t('products.helpLink')}
            </WhatsappLink>
          </p>
        ) : null}
      </div>
    </section>
  )
}

function ProductCard({ product: p }: { product: LandingProduct }) {
  const t = useT()
  const locale = useLocale()
  const unavailable = p.stockStatus === 'out_of_stock'
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight

  return (
    <article className="group grid h-full grid-cols-[7rem_minmax(0,1fr)] gap-g2 rounded-[20px] bg-white/80 p-2.5 shadow-lift ring-1 ring-sand-deep/60 backdrop-blur-sm transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgb(29_39_18/0.45)] sm:flex sm:flex-col sm:gap-0">
      <div className="relative overflow-hidden rounded-card bg-olive-900">
        <div className="kenburns aspect-square h-full sm:aspect-[1.618/1]">
          {p.image ? (
            <Picture
              image={p.image}
              alt={p.imageAlt}
              sizes={CARD_SIZES}
              imgClassName={cn(unavailable && 'opacity-60 grayscale-[40%]')}
            />
          ) : null}
        </div>
        {unavailable ? (
          <span className="absolute inset-x-2 top-2 rounded-full bg-limewash px-2 py-0.5 text-center text-xs font-medium text-danger">
            {t('products.outOfStock')}
          </span>
        ) : p.stockStatus === 'low_stock' ? (
          <span className="absolute inset-x-2 top-2 rounded-full bg-oil-soft px-2 py-0.5 text-center text-xs font-medium text-oil-deep">
            {t('products.lowStock')}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col py-1 pe-1 sm:px-2.5 sm:pt-5 sm:pb-2.5">
        {p.sizeLabel ? (
          <p className="font-display text-[1.618rem] leading-none font-bold text-olive tabular-nums sm:text-h2">
            {p.sizeLabel}
          </p>
        ) : null}
        <h3
          className={cn(
            p.sizeLabel ? 'mt-1.5 text-[0.9375rem] font-medium text-ink sm:text-lede' : 'text-h3',
          )}
        >
          {p.name}
        </h3>
        <p className="mt-g1 flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-bold text-oil-deep tabular-nums sm:text-xl">
            {formatMad(p.price, locale)}
          </span>
          {p.liters ? (
            <span className="text-xs text-ink-soft tabular-nums sm:text-sm">
              {t('products.perLiter', {
                price: formatMad(Number.parseFloat(p.price) / p.liters, locale),
              })}
            </span>
          ) : null}
        </p>
        {p.tagline ? <p className="mt-2 hidden text-ink-soft sm:block">{p.tagline}</p> : null}
        {p.labReport ? (
          <a
            href={p.labReport.url}
            target="_blank"
            rel="noopener noreferrer"
            className="tap mt-1 inline-flex items-center gap-1.5 self-start text-sm font-medium text-leaf underline-offset-4 hover:underline"
          >
            <FileText className="size-4" aria-hidden="true" />
            {t('products.qualityReport')}
          </a>
        ) : null}

        <div className="mt-auto pt-g1 sm:pt-5">
          {unavailable ? (
            <WhatsappLink
              placement="product_unavailable"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'w-full px-3 text-center whitespace-normal',
              )}
            >
              <WhatsappIcon className="text-whatsapp-deep" />
              {t('products.outOfStockAsk')}
            </WhatsappLink>
          ) : (
            // biome-ignore lint/a11y/useValidAnchor: a real link to #order (scrolls even before JS); the click also picks the offer
            <a
              href="#order"
              onClick={() => selectOffer(p.slug)}
              aria-label={t('products.orderLabel', {
                name: [p.name, p.sizeLabel].filter(Boolean).join(' '),
              })}
              className={cn(
                buttonVariants(),
                'w-full px-3 text-center whitespace-normal group-hover:bg-olive-600 group-hover:shadow-[0_10px_24px_-12px_rgb(79_106_38/0.8)]',
              )}
            >
              {/* Short on the card (the column can be ~150px wide); the full name is in aria-label. */}
              {t('products.orderShort')}
              <Arrow
                className="transition-transform duration-300 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

/** "Other quantity": the visitor types the litres in the order form, priced per litre. */
function CustomQuantityCard({
  pricePerLiter,
  min,
  max,
}: {
  pricePerLiter: number
  min: number
  max: number
}) {
  const t = useT()
  const locale = useLocale()
  return (
    <article className="flex h-full flex-col rounded-[20px] border-2 border-dashed border-olive-600/40 bg-limewash/85 p-g2 shadow-lift backdrop-blur-sm sm:p-g3">
      <div className="flex items-center gap-g2 sm:block">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-olive-950 text-oil-bright">
          <Droplets className="size-6" aria-hidden="true" />
        </span>
        <div className="sm:mt-g2">
          <h3 className="text-h3">{t('products.customTitle')}</h3>
          <p className="font-display text-lg font-bold text-oil-deep tabular-nums sm:mt-1 sm:text-h3">
            {t('products.perLiter', { price: formatMad(pricePerLiter, locale) })}
          </p>
        </div>
      </div>
      <p className="mt-g1 text-ink-soft">{t('products.customBody', { min, max })}</p>
      <div className="mt-auto pt-g2 sm:pt-5">
        {/* biome-ignore lint/a11y/useValidAnchor: a real link to #order (scrolls even before JS); the click also picks the offer */}
        <a
          href="#order"
          onClick={() => selectOffer('custom')}
          aria-label={t('products.customLabel')}
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'w-full bg-white/60 text-center whitespace-normal',
          )}
        >
          {t('products.customCta')}
        </a>
      </div>
    </article>
  )
}
