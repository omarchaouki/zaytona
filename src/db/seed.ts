import { env } from '~/lib/env'
import { createDb } from './client'
import { seed } from './seed-run'

async function main() {
  const e = env()
  const db = createDb(e.DATABASE_URL, 1)
  if (e.NODE_ENV === 'production' && e.SEED_WHATSAPP_NUMBER) {
    throw new Error('SEED_WHATSAPP_NUMBER is for development only.')
  }
  await seed(db, {
    adminEmail: e.ADMIN_EMAIL,
    adminPassword: e.ADMIN_PASSWORD,
    whatsappNumber: e.SEED_WHATSAPP_NUMBER,
    log: (m) => console.log(`  ${m}`),
  })
  console.log('Seed complete. Demo rows are flagged in the admin until replaced.')
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
