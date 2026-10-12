import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '~/db/client'
import {
  deleteOffer,
  listOffers,
  offerInput,
  pricingInput,
  saveOffer,
  savePricing,
} from '../admin/offers'
import { adminAuth, ownerOnly } from '../auth/middleware'

/* Offers and the price per litre: everyone in the panel can see them, owners change them. */

export const adminGetOffers = createServerFn({ method: 'GET' })
  .middleware([adminAuth])
  .handler(() => listOffers(db()))

export const adminSavePricing = createServerFn({ method: 'POST' })
  .middleware([ownerOnly])
  .inputValidator(pricingInput)
  .handler(({ data, context }) =>
    savePricing(db(), { adminId: context.session.admin.id, ip: context.ip }, data),
  )

export const adminSaveOffer = createServerFn({ method: 'POST' })
  .middleware([ownerOnly])
  .inputValidator(offerInput)
  .handler(({ data, context }) =>
    saveOffer(db(), { adminId: context.session.admin.id, ip: context.ip }, data),
  )

export const adminDeleteOffer = createServerFn({ method: 'POST' })
  .middleware([ownerOnly])
  .inputValidator(z.object({ id: z.uuid() }))
  .handler(({ data, context }) =>
    deleteOffer(db(), { adminId: context.session.admin.id, ip: context.ip }, data.id),
  )
