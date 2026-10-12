import { inArray } from 'drizzle-orm'
import type { Database } from '~/db/client'
import { contentBlocks, settings } from '~/db/schema'
import type { Locale } from '~/i18n/config'
import { type Content, type ContentKey, parseContent } from '~/lib/content'
import { parseSetting, type Settings, type SettingsKey, settingsSchemas } from '~/lib/settings'

/** All settings, each parsed against its schema with defaults filled in. */
export async function getSettings(db: Database): Promise<Settings> {
  const rows = await db.select().from(settings)
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  return Object.fromEntries(
    (Object.keys(settingsSchemas) as SettingsKey[]).map((k) => [k, parseSetting(k, byKey.get(k))]),
  ) as Settings
}

export async function getContent<K extends ContentKey>(
  db: Database,
  keys: K[],
  locale: Locale,
): Promise<{ [P in K]: Content<P> }> {
  const rows = await db.select().from(contentBlocks).where(inArray(contentBlocks.key, keys))
  const byKey = new Map(rows.map((r) => [r.key, locale === 'ar' ? r.valueAr : r.valueFr]))
  return Object.fromEntries(keys.map((k) => [k, parseContent(k, byKey.get(k))])) as {
    [P in K]: Content<P>
  }
}
