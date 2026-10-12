import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '~/lib/cn'
import type { ImageSources } from '~/lib/images'
import { type ImageName, Picture } from './Picture'

/*
 * The bab arch: a Moroccan horseshoe arch, drawn in a 100 × 161.8 box (1 : φ).
 * The arc is a circle (centre 50,50) that continues 30° below its centre
 * before the jambs drop, which is what makes it a horseshoe and not a
 * plain round arch. It is symmetric, so it needs no RTL mirroring.
 *
 * Photo window: r = 46. Gold trace: r = 48.5, just outside the photo.
 * Inside, photos move slowly (Ken Burns) and crossfade; a short video can
 * replace them once loaded (never for reduced motion or data saver).
 */
const H = 161.8
// objectBoundingBox units: x / 100, y / H (73 / H = 0.4512, 46 / H = 0.2843).
const PHOTO_CLIP = 'M0.1016 1 V0.4512 A0.46 0.2843 0 1 1 0.8984 0.4512 V1 Z'
const TRACE_PATH = `M8 ${H} V74.25 A48.5 48.5 0 1 1 92 74.25 V${H}`

export type ArchSlide = { image: ImageName | ImageSources; alt: string }
export type VideoSource = { src: string; type: string }

type ArchWindowProps = {
  slides: ArchSlide[]
  sizes: string
  /** First slide is the LCP image: eager + high priority. */
  priority?: boolean
  /** Slow zoom/pan on the photos. */
  living?: boolean
  /** Draw the trace once, then run a light glint along it. */
  animateTrace?: boolean
  video?: VideoSource[]
  traceColor?: string
  className?: string
}

export function ArchWindow({
  slides,
  sizes,
  priority,
  living = true,
  animateTrace = true,
  video,
  traceColor = 'var(--color-oil)',
  className,
}: ArchWindowProps) {
  const clipId = useId().replace(/:/g, '')
  const shown = slides.slice(0, 2)
  const multiple = shown.length > 1

  return (
    <figure className={cn('relative aspect-[100/161.8] w-full', className)}>
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <clipPath id={clipId} clipPathUnits="objectBoundingBox">
          <path d={PHOTO_CLIP} />
        </clipPath>
      </svg>
      <div
        className={cn('absolute inset-0 overflow-hidden bg-olive-900', multiple && 'slides')}
        style={{ clipPath: `url(#${clipId})` }}
      >
        {shown.map((slide, i) => (
          <div
            key={typeof slide.image === 'string' ? slide.image : slide.image.fallback}
            className={cn(
              multiple ? 'slide' : 'absolute inset-0',
              living && (i % 2 === 0 ? 'kenburns' : 'kenburns-alt'),
            )}
            style={multiple ? ({ '--i': i } as React.CSSProperties) : undefined}
            aria-hidden={i > 0 || undefined}
          >
            <Picture
              image={slide.image}
              alt={i === 0 ? slide.alt : ''}
              sizes={sizes}
              priority={priority && i === 0}
            />
          </div>
        ))}
        {video?.length ? <ArchVideo sources={video} /> : null}
      </div>
      <svg
        viewBox={`0 0 100 ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d={TRACE_PATH}
          pathLength={1}
          fill="none"
          stroke={traceColor}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          className={animateTrace ? 'arch-trace' : undefined}
        />
        {animateTrace ? (
          <path
            d={TRACE_PATH}
            pathLength={1}
            fill="none"
            stroke="#fff6d8"
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="arch-glint"
            style={{ filter: 'drop-shadow(0 0 4px rgb(242 193 78 / 0.9))' }}
          />
        ) : null}
      </svg>
    </figure>
  )
}

/** Muted looping clip layered over the photos, mounted only when motion is welcome. */
function ArchVideo({ sources }: { sources: VideoSource[] }) {
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData
    if (!reduce && !saveData) setEnabled(true)
  }, [])

  if (!enabled) return null
  return (
    // Decorative: the wrapper hides it from assistive tech (no controls, muted).
    <div aria-hidden="true" className="absolute inset-0">
      <video
        ref={ref}
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-opacity duration-1000',
          ready ? 'opacity-100' : 'opacity-0',
        )}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        tabIndex={-1}
        onCanPlay={() => setReady(true)}
      >
        {sources.map((s) => (
          <source key={s.src} src={s.src} type={s.type} />
        ))}
      </video>
    </div>
  )
}
