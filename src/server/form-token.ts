import { keyedHash } from './crypto'

/*
 * Anti-bot timing: the page embeds a signed timestamp; a submission is
 * accepted only if it arrives at least MIN_FILL_MS after the page was rendered
 * (people need a few seconds; scripts post instantly) and within MAX_AGE_MS.
 */
export const MIN_FILL_MS = 3_000
export const MAX_AGE_MS = 24 * 60 * 60 * 1000

export function issueFormToken(now = Date.now()): string {
  return `${now}.${keyedHash(String(now), 'form-token').slice(0, 32)}`
}

export type FormTokenCheck = 'ok' | 'invalid' | 'too_fast' | 'expired'

export function checkFormToken(token: string, now = Date.now()): FormTokenCheck {
  const [ts, sig] = token.split('.')
  const issued = Number(ts)
  if (!ts || !sig || !Number.isSafeInteger(issued)) return 'invalid'
  if (keyedHash(ts, 'form-token').slice(0, 32) !== sig) return 'invalid'
  if (now - issued < MIN_FILL_MS) return 'too_fast'
  if (now - issued > MAX_AGE_MS) return 'expired'
  return 'ok'
}
