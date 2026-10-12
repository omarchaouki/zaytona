import manifest from '~/generated/images.json'

/*
 * Image references stored in the DB (`product_images.url`, `gallery_images.url`…):
 *   static:<name>   a photo built by `pnpm images` (public/images/<name>-<w>.<ext>)
 *   upload:<id>     an admin upload re-encoded by sharp (/uploads/<id>-<w>.<ext>)
 * Both produce AVIF + WebP at the widths below (never wider than the original).
 */

export const UPLOAD_WIDTHS = [480, 960, 1600] as const

export type ImageSources = {
  avifSrcSet: string
  webpSrcSet: string
  fallback: string
  width: number
  height: number
}

export type StaticImageName = keyof typeof manifest

function build(base: string, widths: number[], width: number, height: number): ImageSources {
  const set = (ext: string) => widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ')
  return {
    avifSrcSet: set('avif'),
    webpSrcSet: set('webp'),
    fallback: `${base}-${widths[widths.length - 1]}.webp`,
    width,
    height,
  }
}

export function staticImage(name: StaticImageName): ImageSources {
  const entry = manifest[name]
  return build(`/images/${name}`, entry.widths, entry.width, entry.height)
}

/** Resolve a DB image reference; returns null for an unknown format. */
export function resolveImage(
  ref: string,
  size?: { width: number | null; height: number | null },
): ImageSources | null {
  if (ref.startsWith('static:')) {
    const name = ref.slice('static:'.length)
    return name in manifest ? staticImage(name as StaticImageName) : null
  }
  if (ref.startsWith('upload:')) {
    const id = ref.slice('upload:'.length)
    if (!/^[a-z0-9-]+$/i.test(id)) return null
    const width = size?.width ?? 1600
    const height = size?.height ?? width
    const widths = [...UPLOAD_WIDTHS.filter((w) => w < width), Math.min(width, 1600)]
    return build(`/uploads/${id}`, [...new Set(widths)], width, height)
  }
  return null
}

/** Plain URL for a stored file (certificate scan, lab report) — not an image set. */
export function fileUrl(ref: string): string | null {
  if (ref.startsWith('upload-file:')) {
    const name = ref.slice('upload-file:'.length)
    return /^[a-z0-9-]+\.(pdf|webp|jpg|jpeg|png)$/i.test(name) ? `/uploads/${name}` : null
  }
  if (ref.startsWith('static:')) {
    const src = resolveImage(ref)
    return src?.fallback ?? null
  }
  return null
}
