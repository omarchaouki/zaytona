import type { Database } from '~/db/client'
import * as schema from '~/db/schema'

/**
 * Fixed-price products for the order and admin tests (the seeded catalogue is
 * litre offers priced from Settings, which would make every expected total
 * depend on the demo price per litre).
 */
export async function addTestProducts(db: Database) {
  const rows = await db
    .insert(schema.products)
    .values([
      {
        slug: 'test-oil-1l',
        nameAr: 'زيت زيتون بكر ممتاز',
        nameFr: "Huile d'olive vierge extra",
        sizeLabelAr: '1 لتر',
        sizeLabelFr: '1 litre',
        priceMad: '90.00',
      },
      {
        slug: 'test-oil-5l',
        nameAr: 'زيت زيتون بكر ممتاز',
        nameFr: "Huile d'olive vierge extra",
        sizeLabelAr: '5 لترات',
        sizeLabelFr: '5 litres',
        priceMad: '420.00',
      },
      {
        slug: 'test-olives-1kg',
        nameAr: 'زيتون أخضر للمائدة',
        nameFr: 'Olives vertes de table',
        sizeLabelAr: '1 كلغ',
        sizeLabelFr: '1 kg',
        priceMad: '40.00',
      },
    ])
    .returning({ id: schema.products.id, slug: schema.products.slug })
  const id = (slug: string) => rows.find((r) => r.slug === slug)?.id ?? ''
  return { oil1l: id('test-oil-1l'), oil5l: id('test-oil-5l'), olives: id('test-olives-1kg') }
}
