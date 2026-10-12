import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp, { type Metadata } from 'sharp'
import { env } from '~/lib/env'
import { UPLOAD_WIDTHS } from '~/lib/images'

/*
 * Uploaded images (review photos, certificate scans, later product photos).
 * Every upload is decoded by sharp — so only real images get through, whatever
 * the file name or declared type says — auto-rotated, re-encoded to WebP and
 * AVIF at up to three widths, and stripped of metadata (EXIF, GPS position).
 * Files live behind a small driver interface so S3/R2 can replace the disk.
 */

export interface StorageDriver {
  put(name: string, data: Buffer): Promise<void>
  get(name: string): Promise<Buffer | null>
}

class LocalDriver implements StorageDriver {
  constructor(private dir: string) {}
  async put(name: string, data: Buffer) {
    await mkdir(this.dir, { recursive: true })
    await writeFile(path.join(this.dir, name), data)
  }
  async get(name: string) {
    try {
      return await readFile(path.join(this.dir, name))
    } catch {
      return null
    }
  }
}

let driver: StorageDriver | undefined
export function storage(): StorageDriver {
  // S3/R2: implement StorageDriver and select it here from STORAGE_DRIVER.
  driver ??= new LocalDriver(path.resolve(env().UPLOAD_DIR))
  return driver
}

export class UploadError extends Error {
  constructor(public code: 'too_large' | 'not_image' | 'too_small') {
    super(code)
  }
}

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'heif', 'gif'])

export type StoredImage = { key: string; width: number; height: number }

export async function storeImage(
  input: ArrayBuffer | Uint8Array,
  opts: { maxBytes?: number; driver?: StorageDriver } = {},
): Promise<StoredImage> {
  const bytes = Buffer.from(input instanceof ArrayBuffer ? new Uint8Array(input) : input)
  const maxBytes = opts.maxBytes ?? env().MAX_UPLOAD_MB * 1024 * 1024
  if (bytes.byteLength > maxBytes) throw new UploadError('too_large')

  let meta: Metadata
  try {
    meta = await sharp(bytes, { limitInputPixels: 50_000_000 }).metadata()
  } catch {
    throw new UploadError('not_image')
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) throw new UploadError('not_image')

  const base = sharp(bytes, { limitInputPixels: 50_000_000, animated: false }).rotate()
  const { width = 0, height = 0 } = await base
    .clone()
    .toBuffer({ resolveWithObject: true })
    .then((r) => r.info)
  if (width < 120 || height < 120) throw new UploadError('too_small')

  const id = randomUUID()
  const widths = [...new Set([...UPLOAD_WIDTHS.filter((w) => w < width), Math.min(width, 1600)])]
  const store = opts.driver ?? storage()
  for (const w of widths) {
    const resized = base.clone().resize({ width: w, withoutEnlargement: true })
    await store.put(`${id}-${w}.webp`, await resized.clone().webp({ quality: 80 }).toBuffer())
    await store.put(`${id}-${w}.avif`, await resized.clone().avif({ quality: 58 }).toBuffer())
  }
  return {
    key: `upload:${id}`,
    width: Math.min(width, 1600),
    height: Math.round((Math.min(width, 1600) / width) * height),
  }
}

/** Reads a stored variant; `name` must look like `<uuid>-<width>.<webp|avif>`. */
export async function readUpload(name: string): Promise<{ data: Buffer; type: string } | null> {
  const m = /^[0-9a-f-]{36}-\d{2,4}\.(webp|avif)$/.exec(name)
  if (!m) return null
  const data = await storage().get(name)
  return data ? { data, type: `image/${m[1]}` } : null
}
