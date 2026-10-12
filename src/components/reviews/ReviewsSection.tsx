import { useServerFn } from '@tanstack/react-start'
import { BadgeCheck, MessageSquareQuote, PenLine, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useState } from 'react'
import { useLocale, useT } from '~/i18n'
import { cn } from '~/lib/cn'
import { formatDay, formatNumber } from '~/lib/format'
import { getReviewsPage } from '~/server/functions/reviews'
import type { LandingData } from '~/server/landing'
import type { PublicReview } from '~/server/reviews'
import { SectionHeading } from '../landing/SectionHeading'
import { Picture } from '../Picture'
import { SectionBackdrop } from '../SectionBackdrop'
import { Button } from '../ui/button'
import { ReviewForm } from './ReviewForm'
import { Stars } from './Stars'

type Props = {
  data: NonNullable<LandingData['reviews']>
  formToken: string
}

/*
 * Marketplace-style reviews: average with partial stars, the per-star
 * distribution (bars double as filters), review cards with photo thumbnails,
 * "verified purchase" badges and the cooperative's replies. Only reviews the
 * admin approved are ever listed; the numbers come from those alone.
 */
export function ReviewsSection({ data, formToken }: Props) {
  const t = useT()
  const locale = useLocale()
  const fetchPage = useServerFn(getReviewsPage)
  const [items, setItems] = useState<PublicReview[]>(data.items)
  const [hasMore, setHasMore] = useState(data.hasMore)
  const [page, setPage] = useState(1)
  const [stars, setStars] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [writing, setWriting] = useState(false)
  const { summary } = data

  async function load(nextPage: number, filter: number | undefined) {
    setLoading(true)
    try {
      const res = await fetchPage({ data: { locale, page: nextPage, stars: filter } })
      setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]))
      setHasMore(res.hasMore)
      setPage(nextPage)
    } finally {
      setLoading(false)
    }
  }

  function filterBy(value: number | undefined) {
    setStars(value)
    void load(1, value)
  }

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="relative isolate scroll-mt-16">
      <SectionBackdrop image="grove-green" tone="light" />
      <div className="container-page section-y">
        <div className="grid gap-g4 lg:grid-cols-[1fr_1.618fr] lg:gap-g6 [&>*]:min-w-0">
          {/* Summary column */}
          <div className="lg:sticky lg:top-24 lg:self-start" data-reveal>
            <SectionHeading
              id="reviews-title"
              eyebrow={t('reviews.eyebrow')}
              title={t('reviews.title')}
            />

            {summary.count > 0 ? (
              <div className="mt-g3 rounded-card bg-white p-g3 shadow-lift ring-1 ring-sand-deep/50">
                <div className="flex flex-wrap items-center gap-x-g2 gap-y-g1">
                  <p className="font-display text-[2.618rem] leading-none font-bold text-olive tabular-nums sm:text-[3.33rem]">
                    {formatNumber(summary.average, locale)}
                  </p>
                  <div>
                    <Stars value={summary.average} size="lg" />
                    <p className="mt-1 text-sm text-ink-soft">
                      {t('reviews.basedOn', { count: formatNumber(summary.count, locale) })}
                    </p>
                  </div>
                </div>
                <ul className="mt-g3 space-y-1">
                  {[5, 4, 3, 2, 1].map((s) => {
                    const n = summary.distribution[s - 1] ?? 0
                    const pct = summary.count ? Math.round((n / summary.count) * 100) : 0
                    const active = stars === s
                    return (
                      <li key={s}>
                        <button
                          type="button"
                          disabled={n === 0}
                          onClick={() => filterBy(active ? undefined : s)}
                          aria-pressed={active}
                          aria-label={t('reviews.distributionLabel', { stars: s, count: n })}
                          className={cn(
                            'flex min-h-11 w-full items-center gap-g1 rounded-field px-1 text-sm transition-colors disabled:cursor-default',
                            n > 0 && 'hover:bg-sand/60',
                            active && 'bg-oil-soft/70',
                          )}
                        >
                          <span className="w-10 shrink-0 text-start font-medium tabular-nums">
                            {s} ★
                          </span>
                          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand-deep/60">
                            <span
                              className="block h-full rounded-full bg-oil transition-[width] duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                          <span className="w-10 shrink-0 text-end text-ink-soft tabular-nums">
                            {pct}%
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

            <div className="mt-g3">
              <p className="text-sm text-ink-soft">{t('reviews.writeHint')}</p>
              <Button size="lg" className="mt-g1 w-full sm:w-auto" onClick={() => setWriting(true)}>
                <PenLine aria-hidden="true" />
                {t('reviews.write')}
              </Button>
              {/* "Real customers, checked before publishing": only once every review on the page is real. */}
              {data.realSummary.count === summary.count ? (
                <p className="mt-g2 flex items-center gap-1.5 text-xs text-ink-soft">
                  <BadgeCheck className="size-4 text-olive-600" aria-hidden="true" />
                  {t('reviews.moderated')}
                </p>
              ) : null}
            </div>
          </div>

          {/* List column */}
          <div className="min-w-0">
            {stars ? (
              <button
                type="button"
                onClick={() => filterBy(undefined)}
                className="tap mb-g2 inline-flex items-center gap-1.5 rounded-full bg-oil-soft px-4 text-sm font-medium text-olive-950"
              >
                {t('reviews.filterStars', { stars })}
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">{t('reviews.filterAll')}</span>
              </button>
            ) : null}

            {items.length === 0 ? (
              <div className="rounded-card border-2 border-dashed border-sand-deep p-g4 text-center">
                <MessageSquareQuote
                  className="mx-auto size-10 text-olive-600/60"
                  aria-hidden="true"
                />
                <p className="mx-auto mt-g2 max-w-[26rem] text-ink-soft">{t('reviews.empty')}</p>
                <Button className="mt-g3" onClick={() => setWriting(true)}>
                  {t('reviews.write')}
                </Button>
              </div>
            ) : (
              <ul className="space-y-g2" aria-busy={loading}>
                {items.map((review, i) => (
                  <ReviewCard key={review.id} review={review} index={i} />
                ))}
              </ul>
            )}

            {hasMore ? (
              <Button
                variant="outline"
                className="mt-g3 w-full"
                disabled={loading}
                onClick={() => load(page + 1, stars)}
              >
                {t('reviews.more')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <Dialog.Root open={writing} onOpenChange={setWriting}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[24px] bg-limewash p-g3 pb-[calc(1.618rem+env(safe-area-inset-bottom))] shadow-lift focus:outline-none sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[36rem] sm:rounded-[24px] sm:p-g4">
            <div className="mb-g2 flex items-center justify-between gap-3">
              <Dialog.Title className="font-display text-h3 text-olive">
                {t('reviews.form.title')}
              </Dialog.Title>
              <Dialog.Close
                className="tap inline-flex items-center justify-center rounded-full text-olive hover:bg-olive/5"
                aria-label={t('reviews.close')}
              >
                <X className="size-5" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">{t('reviews.form.intro')}</Dialog.Description>
            <ReviewForm formToken={formToken} onDone={() => setWriting(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  )
}

function ReviewCard({ review, index }: { review: PublicReview; index: number }) {
  const t = useT()
  const locale = useLocale()
  const date = formatDay(review.day, locale)
  const initial = review.name.charAt(0).toUpperCase()

  return (
    <li
      data-reveal
      style={{ '--d': `${(index % 6) * 0.08}s` } as React.CSSProperties}
      className="rounded-card bg-white p-g3 shadow-lift ring-1 ring-sand-deep/50"
    >
      <div className="flex items-start gap-g2">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-olive text-lg font-bold text-oil-bright"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="font-bold text-ink">{review.name}</p>
            {review.city ? <p className="text-sm text-ink-soft">· {review.city}</p> : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-g1 gap-y-1">
            <Stars value={review.rating} size="sm" />
            {review.verified ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-olive-600">
                <BadgeCheck className="size-4" aria-hidden="true" />
                {t('reviews.verified')}
              </span>
            ) : null}
            <span className="text-xs text-ink-soft">{date}</span>
            {review.isDemo ? (
              <span
                className="rounded-full bg-ink/75 px-2 py-0.5 text-xs font-medium text-limewash"
                title={t('reviews.demoNote')}
              >
                {t('reviews.demo')}
                <span className="sr-only"> — {t('reviews.demoNote')}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <p
        className="mt-g2 whitespace-pre-line text-ink"
        lang={review.language === 'ar' ? 'ar' : 'fr'}
        dir="auto"
      >
        {review.comment}
      </p>

      {review.photo ? <ReviewPhoto review={review} /> : null}

      {review.reply ? (
        <div className="mt-g2 rounded-field border-s-4 border-oil bg-sand/60 px-g2 py-g1">
          <p className="text-xs font-bold text-olive">{t('reviews.reply')}</p>
          <p className="mt-0.5 text-sm text-ink">{review.reply}</p>
        </div>
      ) : null}
    </li>
  )
}

function ReviewPhoto({ review }: { review: PublicReview }) {
  const t = useT()
  if (!review.photo) return null
  const alt = t('reviews.photoAlt', { name: review.name })
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className="group mt-g2 block overflow-hidden rounded-field ring-1 ring-sand-deep focus-visible:outline-3 focus-visible:outline-oil"
        aria-label={t('reviews.openPhoto')}
      >
        <Picture
          image={review.photo}
          alt={alt}
          sizes="6rem"
          className="block size-24"
          imgClassName="transition-transform duration-300 group-hover:scale-105"
        />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-3 z-50 m-auto flex max-h-[90dvh] max-w-3xl items-center justify-center focus:outline-none">
          <Dialog.Title className="sr-only">{alt}</Dialog.Title>
          <Picture
            image={review.photo}
            alt={alt}
            sizes="(min-width: 48rem) 48rem, 94vw"
            className="block max-h-[90dvh]"
            imgClassName="h-auto max-h-[90dvh] w-auto rounded-card object-contain"
          />
          <Dialog.Close
            className="absolute end-0 top-0 inline-flex size-11 items-center justify-center rounded-full bg-limewash text-olive shadow-lift"
            aria-label={t('reviews.close')}
          >
            <X className="size-5" aria-hidden="true" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
