import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '~/db/client'
import { whatsappClicks } from '~/db/schema'
import { LOCALES } from '~/i18n/config'
import { WHATSAPP_PLACEMENTS } from '~/lib/whatsapp-placements'
import { hashIp } from '~/server/crypto'
import { consumeRateLimit } from '~/server/rate-limit'
import { clientIp } from '~/server/request'

const Body = z.object({ placement: z.enum(WHATSAPP_PLACEMENTS), locale: z.enum(LOCALES) })

/** Anonymous WhatsApp click counter (placement + locale + time only). */
export const Route = createFileRoute('/api/wa-click')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return new Response(null, { status: 400 })

        const ipHash = hashIp(clientIp()) ?? 'unknown'
        if (await consumeRateLimit(db(), `wa-click:${ipHash}`, 30, 3600)) {
          await db().insert(whatsappClicks).values(parsed.data)
        }
        return new Response(null, { status: 204 })
      },
    },
  },
})
