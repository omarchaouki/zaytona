import { createHash, createHmac, randomBytes } from 'node:crypto'
import { env } from '~/lib/env'

/** Keyed hash for values we must compare but never store in clear (IPs, phones). */
export function keyedHash(value: string, purpose: string): string {
  return createHmac('sha256', env().APP_SECRET).update(`${purpose}:${value}`).digest('hex')
}

export const hashIp = (ip: string | undefined | null) => (ip ? keyedHash(ip, 'ip') : null)
export const hashPhone = (e164: string) => keyedHash(e164, 'phone')

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}
