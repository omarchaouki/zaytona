import { cn } from '~/lib/cn'
import { type ImageName, Picture } from './Picture'

type SectionBackdropProps = {
  image: ImageName
  /** light: watermark under limewash · dark: deep olive veil · photo: photo stays visible. */
  tone: 'light' | 'dark' | 'photo'
  /** object-position of the photo, e.g. "50% 30%". */
  position?: string
  /** Slow Ken Burns drift (off under reduced motion). */
  motion?: boolean
}

/**
 * Photo background for a section (see "section backdrops" in app.css). The
 * section needs `relative isolate overflow-hidden`. Decorative: hidden from
 * screen readers, lazy loaded, never the LCP.
 */
export function SectionBackdrop({ image, tone, position, motion = false }: SectionBackdropProps) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className={cn('backdrop-img absolute inset-0', motion && 'kenburns')}
        style={position ? ({ '--pos': position } as React.CSSProperties) : undefined}
      >
        <Picture
          image={image}
          alt=""
          sizes="100vw"
          className="block h-full w-full"
          imgClassName={cn(tone === 'light' && 'blur-[2px]')}
        />
      </div>
      <div className={cn('absolute inset-0', `veil-${tone}`)} />
      {/* The olive-sprig texture; the "photo" tone keeps the photo alone. */}
      {tone === 'photo' ? null : (
        <div
          className={cn(
            'absolute inset-0',
            tone === 'dark' ? 'pattern-on-dark' : 'pattern-on-light',
          )}
        />
      )}
    </div>
  )
}
