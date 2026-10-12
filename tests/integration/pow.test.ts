import { PGlite } from '@electric-sql/pglite'
import { solveChallenge } from 'altcha-lib'
import { deriveKey } from 'altcha-lib/algorithms/sha'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '~/db/client'
import * as schema from '~/db/schema'
import { checkPow, issuePowChallenge } from '~/server/pow'

const pg = new PGlite()
const db = drizzle(pg, { schema }) as unknown as Database
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64')

/** What the browser does: fetch a challenge, find the counter, send both back. */
async function solvedPow(maxCounter = 200) {
  const challenge = await issuePowChallenge({ maxCounter })
  const solution = await solveChallenge({ challenge, deriveKey })
  return { challenge, solution, payload: encode({ challenge, solution }) }
}

beforeAll(async () => {
  await migrate(drizzle(pg), { migrationsFolder: './drizzle' })
})
afterAll(async () => {
  await pg.close()
})

describe('proof of work', () => {
  it('accepts a solved challenge once, then treats it as a replay', async () => {
    const { payload } = await solvedPow()
    expect(await checkPow(db, payload)).toBe('ok')
    expect(await checkPow(db, payload)).toBe('replayed')
  })

  it('rejects missing, garbled and forged answers', async () => {
    expect(await checkPow(db, undefined)).toBe('missing')
    expect(await checkPow(db, 'not base64 json')).toBe('invalid')

    const { challenge, solution } = await solvedPow()
    // Wrong counter.
    expect(
      await checkPow(
        db,
        encode({ challenge, solution: { ...solution, derivedKey: '00'.repeat(32) } }),
      ),
    ).toBe('invalid')
    // Easier challenge made up by the client (signature no longer matches).
    expect(
      await checkPow(
        db,
        encode({
          challenge: { ...challenge, parameters: { ...challenge.parameters, keyPrefix: '00' } },
          solution,
        }),
      ),
    ).toBe('invalid')
  })

  it('rejects an expired challenge', async () => {
    const challenge = await issuePowChallenge({ maxCounter: 50, now: Date.now() - 3 * 3600_000 })
    const solution = await solveChallenge({ challenge, deriveKey })
    expect(await checkPow(db, encode({ challenge, solution }))).toBe('invalid')
  })
})
