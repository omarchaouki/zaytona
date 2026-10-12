import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '~/lib/env'
import * as schema from './schema'

/**
 * Driver-agnostic handle: postgres-js in the app, PGlite in integration tests.
 * Server modules take a `Database` so they can be tested without Docker.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export function createDb(url: string, max = 10): Database {
  const client = postgres(url, { max, idle_timeout: 20, prepare: true })
  return drizzle(client, { schema })
}

// Reuse one pool across dev hot reloads.
const globalForDb = globalThis as unknown as { __oliveDb?: Database }

export function db(): Database {
  globalForDb.__oliveDb ??= createDb(env().DATABASE_URL, env().DATABASE_POOL_MAX)
  return globalForDb.__oliveDb
}
