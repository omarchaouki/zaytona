import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

/*
 * Migration 0001 must move an existing database's order counter to 10001
 * without ever going backwards (which would collide with existing numbers).
 */
const sqlFile = (name: string) =>
  readFileSync(`./drizzle/${name}`, 'utf8')
    .split('--> statement-breakpoint')
    .filter((s) => s.trim())

async function run(pg: PGlite, statements: string[]) {
  for (const statement of statements) await pg.exec(statement)
}

const insertOrder = (pg: PGlite, ref: string) =>
  pg.query<{ number: number }>(
    `insert into orders (reference, customer_name, phone_e164, city, subtotal, total, locale)
     values ($1, 'T', '+212612345678', 'Rabat', 1, 1, 'fr') returning number`,
    [ref],
  )

let pg: PGlite | undefined
afterEach(async () => {
  await pg?.close()
})

describe('order number migration', () => {
  it('jumps an existing small counter to 10001', async () => {
    pg = new PGlite()
    await run(pg, sqlFile('0000_init.sql'))
    expect((await insertOrder(pg, 'A')).rows[0]?.number).toBe(1)
    await run(pg, sqlFile('0001_deposit_and_order_numbers.sql'))
    expect(Number((await insertOrder(pg, 'B')).rows[0]?.number)).toBe(10001)
  })

  it('never goes backwards past numbers already in use', async () => {
    pg = new PGlite()
    await run(pg, sqlFile('0000_init.sql'))
    await pg.exec(`select setval('order_number_seq', 20000)`)
    expect(Number((await insertOrder(pg, 'A')).rows[0]?.number)).toBe(20001)
    await run(pg, sqlFile('0001_deposit_and_order_numbers.sql'))
    expect(Number((await insertOrder(pg, 'B')).rows[0]?.number)).toBe(20002)
  })
})
