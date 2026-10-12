import { describe, expect, it } from 'vitest'
import { parseEnv } from '~/lib/env'

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  APP_SECRET: 'x'.repeat(40),
}

describe('parseEnv', () => {
  it('applies defaults', () => {
    const env = parseEnv(base)
    expect(env.NODE_ENV).toBe('development')
    expect(env.STORAGE_DRIVER).toBe('local')
    expect(env.MAX_UPLOAD_MB).toBe(8)
    expect(env.SMTP_URL).toBeUndefined()
  })

  it('treats empty optional values as unset', () => {
    const env = parseEnv({ ...base, SMTP_URL: '', ANALYTICS_PROVIDER: '' })
    expect(env.SMTP_URL).toBeUndefined()
    expect(env.ANALYTICS_PROVIDER).toBeUndefined()
  })

  it('lists every invalid variable', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://x', APP_SECRET: 'short' })).toThrow(
      /DATABASE_URL[\s\S]*APP_SECRET/,
    )
  })

  it('refuses the example secret in production', () => {
    expect(() =>
      parseEnv({ ...base, NODE_ENV: 'production', APP_SECRET: `change-me-${'x'.repeat(30)}` }),
    ).toThrow(/APP_SECRET/)
  })
})
