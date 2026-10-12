import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '~/db/client'
import * as schema from '~/db/schema'
import { seed } from '~/db/seed-run'
import { notifyNewOrder } from '~/server/notify'
import type { CreatedOrder } from '~/server/orders'

const pg = new PGlite()
const db = drizzle(pg, { schema }) as unknown as Database
const received: unknown[] = []
let server: Server
let url = ''

const order: CreatedOrder = {
  id: '00000000-0000-0000-0000-000000000001',
  reference: 'OL-2026-000042',
  customerName: 'Amina',
  phoneE164: '+212612345678',
  city: 'Marrakech',
  address: null,
  note: null,
  locale: 'fr',
  items: [{ name: 'Huile — 1 litre', quantity: 2 }],
  subtotal: '180.00',
  deliveryFee: null,
  total: '180.00',
}

beforeAll(async () => {
  await migrate(drizzle(pg), { migrationsFolder: './drizzle' })
  await seed(db)
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => {
      body += c
    })
    req.on('end', () => {
      received.push(JSON.parse(body))
      res.writeHead(204).end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`
})

afterAll(async () => {
  server.close()
  await pg.close()
})

describe('notifyNewOrder', () => {
  it('does nothing when no channel is configured', async () => {
    await notifyNewOrder(db, order)
    expect(received).toHaveLength(0)
  })

  it('posts the order to the webhook from Settings', async () => {
    await db
      .update(schema.settings)
      .set({ value: { email: null, webhookUrl: url } })
      .where(eq(schema.settings.key, 'notifications'))
    await notifyNewOrder(db, order)
    expect(received).toEqual([{ event: 'order.created', order }])
  })

  it('never throws when the webhook is down', async () => {
    server.close()
    await expect(notifyNewOrder(db, order)).resolves.toBeUndefined()
  })
})
