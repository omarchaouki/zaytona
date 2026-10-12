import { type Challenge, createChallenge, randomInt, verifySolution } from 'altcha-lib'
import { deriveKey } from 'altcha-lib/algorithms/sha'
import type { Database } from '~/db/client'
import { keyedHash, sha256 } from './crypto'
import { claimOnce } from './rate-limit'

/*
 * Proof of work (ALTCHA, self-hosted, no third party). The server signs a
 * challenge whose answer is a counter it picked at random; the visitor's
 * browser finds it by hashing (about a second on a phone, in the background
 * while they fill the form). Verifying costs the server one HMAC. A bot that
 * posts thousands of forms has to pay that second for every single one, and
 * each solution is accepted once only.
 */

const ALGORITHM = 'SHA-256'
/** The answer is drawn from [MIN, max]; the browser tries counters from 0 upwards. */
export const POW_MIN_COUNTER = 5_000
export const POW_MAX_COUNTER = 60_000
export const POW_TTL_MS = 2 * 60 * 60 * 1000

const secrets = () => ({
  hmacSignatureSecret: keyedHash('signature', 'altcha'),
  hmacKeySignatureSecret: keyedHash('key', 'altcha'),
})

export async function issuePowChallenge(
  opts: { maxCounter?: number; now?: number } = {},
): Promise<Challenge> {
  const max = opts.maxCounter ?? POW_MAX_COUNTER
  return createChallenge({
    algorithm: ALGORITHM,
    cost: 1,
    counter: randomInt(max, Math.min(POW_MIN_COUNTER, max)),
    deriveKey,
    expiresAt: new Date((opts.now ?? Date.now()) + POW_TTL_MS),
    ...secrets(),
  })
}

/** The payload the browser sends back: base64 of {challenge, solution}. */
export type PowCheck = 'ok' | 'missing' | 'invalid' | 'replayed'

export async function checkPow(db: Database, payload: string | undefined): Promise<PowCheck> {
  if (!payload) return 'missing'
  let decoded: { challenge?: Challenge; solution?: { counter: number; derivedKey: string } }
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
  } catch {
    return 'invalid'
  }
  if (!decoded.challenge?.signature || !decoded.solution) return 'invalid'
  try {
    const result = await verifySolution({
      challenge: decoded.challenge,
      solution: decoded.solution,
      deriveKey,
      ...secrets(),
    })
    if (!result.verified) return 'invalid'
  } catch {
    return 'invalid'
  }
  // Single use: the first submission with this challenge wins, later ones are replays.
  const expiresAt = decoded.challenge.parameters.expiresAt ?? 0
  const fresh = await claimOnce(
    db,
    `pow:${sha256(decoded.challenge.signature)}`,
    new Date(expiresAt * 1000),
  )
  return fresh ? 'ok' : 'replayed'
}
