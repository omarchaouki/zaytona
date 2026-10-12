import { useId, useState } from 'react'
import { type MessageKey, useT } from '~/i18n'
import { cn } from '~/lib/cn'

const STAR_PATH =
  'M12 2.6l2.83 5.95 6.53.78-4.82 4.5 1.25 6.46L12 17.1l-5.79 3.19 1.25-6.46-4.82-4.5 6.53-.78L12 2.6z'

/**
 * Read-only stars, with partial fill for averages (4.7 → 4 full + 70%).
 * Fills from the reading start, so it mirrors correctly in Arabic.
 */
export function Stars({
  value,
  size = 'md',
  className,
  label,
}: {
  value: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Accessible text; defaults to "4.7 out of 5 stars". */
  label?: string
}) {
  const t = useT()
  const uid = useId().replace(/:/g, '')
  const px = { sm: 'size-4', md: 'size-5', lg: 'size-7' }[size]
  return (
    <span
      role="img"
      aria-label={label ?? t('reviews.starsLabel', { rating: value })}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i))
        const gradId = `${uid}-${i}`
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className={cn(px, 'rtl:-scale-x-100')}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradId}>
                <stop offset={`${fill * 100}%`} stopColor="var(--color-oil)" />
                <stop offset={`${fill * 100}%`} stopColor="var(--color-sand-deep)" />
              </linearGradient>
            </defs>
            <path d={STAR_PATH} fill={`url(#${gradId})`} />
          </svg>
        )
      })}
    </span>
  )
}

const LABELS: MessageKey[] = [
  'reviews.form.r1',
  'reviews.form.r2',
  'reviews.form.r3',
  'reviews.form.r4',
  'reviews.form.r5',
]

/**
 * Star picker as a native radio group: arrow keys, focus ring and screen
 * readers work without extra ARIA. Hovering previews the rating.
 */
export function StarInput({
  name,
  value,
  onChange,
  invalid,
  describedBy,
  legend,
}: {
  name: string
  value: number
  onChange: (rating: number) => void
  invalid?: boolean
  describedBy?: string
  legend: string
}) {
  const t = useT()
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <fieldset aria-describedby={describedBy} aria-invalid={invalid || undefined}>
      <legend className="mb-1.5 font-medium text-olive">{legend}</legend>
      <div className="flex items-center gap-g2">
        {/* Hover preview is a mouse-only nicety; keyboard users get the radios. */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: preview only, no action */}
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((rating) => (
            <label
              key={rating}
              className="group relative inline-flex size-11 cursor-pointer items-center justify-center"
              onMouseEnter={() => setHover(rating)}
            >
              <input
                type="radio"
                name={name}
                value={rating}
                checked={value === rating}
                onChange={() => onChange(rating)}
                className="peer sr-only"
                aria-label={t('reviews.form.star', { rating })}
              />
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={cn(
                  'size-9 transition-transform duration-150 group-hover:scale-110 peer-focus-visible:rounded peer-focus-visible:outline-3 peer-focus-visible:outline-oil',
                  rating <= shown ? 'fill-oil' : 'fill-sand-deep',
                )}
              >
                <path d={STAR_PATH} />
              </svg>
            </label>
          ))}
        </div>
        <span aria-hidden="true" className="min-w-[5rem] text-sm font-medium text-oil-deep">
          {shown ? t(LABELS[shown - 1] ?? 'reviews.form.r5') : ''}
        </span>
      </div>
    </fieldset>
  )
}
