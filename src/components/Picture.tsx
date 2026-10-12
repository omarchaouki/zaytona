import { cn } from '~/lib/cn'
import { type ImageSources, type StaticImageName, staticImage } from '~/lib/images'

export type ImageName = StaticImageName

type PictureProps = {
  /** A static image built by `pnpm images`, or resolved sources from the DB. */
  image: StaticImageName | ImageSources
  alt: string
  /** `sizes` attribute; describe the rendered width at each breakpoint. */
  sizes: string
  /** true for the LCP image: eager load + high fetch priority. */
  priority?: boolean
  className?: string
  imgClassName?: string
}

/** Responsive <picture>: AVIF first, WebP fallback, intrinsic size to avoid layout shift. */
export function Picture({ image, alt, sizes, priority, className, imgClassName }: PictureProps) {
  const src = typeof image === 'string' ? staticImage(image) : image
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={src.avifSrcSet} sizes={sizes} />
      <img
        src={src.fallback}
        srcSet={src.webpSrcSet}
        sizes={sizes}
        alt={alt}
        width={src.width}
        height={src.height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        className={cn('block h-full w-full object-cover', imgClassName)}
      />
    </picture>
  )
}

export function imagePreloadLink(name: StaticImageName, sizes: string) {
  return {
    rel: 'preload',
    as: 'image',
    type: 'image/avif',
    imageSrcSet: staticImage(name).avifSrcSet,
    imageSizes: sizes,
    fetchPriority: 'high',
  } as const
}
