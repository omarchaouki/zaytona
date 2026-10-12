import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import { db } from '~/db/client'
import { LOCALES } from '~/i18n/config'
import { env } from '~/lib/env'
import { loadChrome } from '../chrome'
import { issueFormToken } from '../form-token'
import { loadLanding } from '../landing'
import { issuePowChallenge } from '../pow'
import { sanitizeRichText } from '../sanitize'
import { getContent, getSettings } from '../settings'

const localeInput = z.object({ locale: z.enum(LOCALES) })

/** Added to the privacy page while the Meta Pixel is enabled. */
const PIXEL_NOTICE = {
  ar: '<h2>قياس الإعلانات (Meta)</h2><p>نستعمل أداة Meta Pixel لقياس فعالية إعلاناتنا على فيسبوك وإنستغرام: تسجّل زيارة الصفحات وإرسال الطلب (دون الاسم أو الهاتف أو العنوان)، وتضع ملفات تعريف من Meta في متصفحك. يمكنك رفضها في الشريط الذي يظهر عند أول زيارة، أو حذفها من إعدادات متصفحك.</p>',
  fr: '<h2>Mesure des publicités (Meta)</h2><p>Nous utilisons le Meta Pixel pour mesurer nos publicités sur Facebook et Instagram : il enregistre les pages visitées et l’envoi d’une commande (sans nom, téléphone ni adresse) et dépose des cookies de Meta dans votre navigateur. Vous pouvez les refuser dans le bandeau affiché lors de votre première visite, ou les supprimer dans les réglages de votre navigateur.</p>',
} as const

export const getLandingData = createServerFn({ method: 'GET' })
  .inputValidator(localeInput)
  .handler(async ({ data }) => ({
    ...(await loadLanding(db(), data.locale)),
    order: {
      formToken: issueFormToken(),
      turnstileSiteKey: env().TURNSTILE_SITE_KEY ?? null,
    },
  }))

export const getPolicyPage = createServerFn({ method: 'GET' })
  .inputValidator(localeInput.extend({ page: z.enum(['privacy', 'terms']) }))
  .handler(async ({ data }) => {
    const key = data.page === 'privacy' ? 'page_privacy' : 'page_terms'
    const content = await getContent(db(), [key], data.locale)
    const page = content[key]
    let html = page.html ? sanitizeRichText(page.html) : null
    // The draft says the site uses no tracking cookies: true until the Meta Pixel is on.
    const { marketing } = await getSettings(db())
    if (data.page === 'privacy' && marketing.pixelEnabled && marketing.pixelId) {
      html = `${html ?? ''}${PIXEL_NOTICE[data.locale]}`
    }
    return { title: page.title ?? null, html }
  })

export const getSiteChrome = createServerFn({ method: 'GET' })
  .inputValidator(localeInput)
  .handler(({ data }) => loadChrome(db(), data.locale))

/** For the confirmation page: the customer → cooperative WhatsApp template in the visitor's language. */
export const getConfirmationSettings = createServerFn({ method: 'GET' })
  .inputValidator(localeInput)
  .handler(async ({ data }) => {
    const { templates } = await getSettings(db())
    return { template: data.locale === 'ar' ? templates.orderAr : templates.orderFr }
  })

/** A fresh proof-of-work challenge for the order and review forms (solved in the browser). */
export const getPowChallenge = createServerFn({ method: 'GET' }).handler(() => {
  setResponseHeader('cache-control', 'no-store')
  return issuePowChallenge()
})
