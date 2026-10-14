import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { CheckCircle2, MapPin, Phone, Store } from 'lucide-react'
import { useId, useState } from 'react'
import { DeliverySettings, deliveryQuery } from '~/components/admin/DeliverySettings'
import { MarketingSettings, marketingQuery } from '~/components/admin/MarketingSettings'
import { WhatsappIcon } from '~/components/icons'
import { Button } from '~/components/ui/button'
import { useT } from '~/i18n'
import { formatPhoneDisplay } from '~/lib/phone'
import { whatsappLink } from '~/lib/whatsapp'
import { adminGetContactSettings, adminSaveContactSettings } from '~/server/functions/settings'

const contactQuery = {
  queryKey: ['admin', 'contact-settings'] as const,
  queryFn: () => adminGetContactSettings(),
}

export const Route = createFileRoute('/admin/settings')({
  loader: async ({ context }) => {
    const [contact] = await Promise.all([
      context.queryClient.ensureQueryData(contactQuery),
      context.queryClient.ensureQueryData(deliveryQuery),
      context.queryClient.ensureQueryData(marketingQuery),
    ])
    return contact
  },
  component: SettingsPage,
})

function SettingsPage() {
  const t = useT()
  const { admin } = Route.useRouteContext()
  const { data } = useQuery({ ...contactQuery, initialData: Route.useLoaderData() })
  const save = useServerFn(adminSaveContactSettings)
  const queryClient = useQueryClient()
  const ids = {
    wa: useId(),
    phone: useId(),
    nameAr: useId(),
    nameFr: useId(),
    addressAr: useId(),
    addressFr: useId(),
  }
  const [errors, setErrors] = useState<{
    whatsapp?: boolean
    phone?: boolean
    nameAr?: boolean
    nameFr?: boolean
    form?: boolean
  }>({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const isOwner = admin.role === 'owner'

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    setSaved(false)
    setErrors({})
    try {
      const field = (name: string) => String(fd.get(name) ?? '')
      const res = await save({
        data: {
          whatsapp: field('whatsapp'),
          phone: field('phone'),
          nameAr: field('nameAr'),
          nameFr: field('nameFr'),
          addressAr: field('addressAr'),
          addressFr: field('addressFr'),
        },
      })
      if (!res.ok) {
        setErrors({
          whatsapp: Boolean(res.errors.whatsapp),
          phone: Boolean(res.errors.phone),
          nameAr: Boolean(res.errors.nameAr),
          nameFr: Boolean(res.errors.nameFr),
        })
        return
      }
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
    } catch {
      setErrors({ form: true })
    } finally {
      setBusy(false)
    }
  }

  const label = 'mb-1.5 flex items-center gap-2 font-medium text-olive'
  return (
    <div className="max-w-2xl">
      <h1 className="text-h2">{t('admin.settings.title')}</h1>
      <p className="mt-g1 text-ink-soft">{t('admin.settings.intro')}</p>
      {!isOwner ? (
        <p className="mt-g1 text-sm font-medium text-oil-deep">{t('admin.settings.ownerOnly')}</p>
      ) : null}

      <form
        method="post"
        onSubmit={onSubmit}
        className="mt-g3 rounded-card bg-white p-g3 shadow-lift ring-1 ring-sand-deep/50"
      >
        <fieldset disabled={!isOwner || busy} className="grid gap-g3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-olive">
            <Store className="size-5 text-olive-600" aria-hidden="true" />
            {t('admin.settings.identityTitle')}
          </h2>
          <div className="grid gap-g2 sm:grid-cols-2">
            <div>
              <label htmlFor={ids.nameAr} className={label}>
                {t('admin.settings.nameAr')}
              </label>
              <input
                id={ids.nameAr}
                name="nameAr"
                required
                maxLength={120}
                dir="rtl"
                lang="ar"
                defaultValue={data.nameAr}
                aria-invalid={errors.nameAr || undefined}
                className="field-input"
              />
              {errors.nameAr ? (
                <p className="mt-1.5 text-sm font-medium text-danger">
                  {t('admin.settings.required')}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor={ids.nameFr} className={label}>
                {t('admin.settings.nameFr')}
              </label>
              <input
                id={ids.nameFr}
                name="nameFr"
                required
                maxLength={120}
                dir="ltr"
                lang="fr"
                defaultValue={data.nameFr}
                aria-invalid={errors.nameFr || undefined}
                className="field-input"
              />
              {errors.nameFr ? (
                <p className="mt-1.5 text-sm font-medium text-danger">
                  {t('admin.settings.required')}
                </p>
              ) : null}
            </div>
            <p className="-mt-g1 text-sm text-ink-soft sm:col-span-2">
              {t('admin.settings.nameHint')}
            </p>
          </div>
          <div className="grid gap-g2 sm:grid-cols-2">
            <div>
              <label htmlFor={ids.addressAr} className={label}>
                <MapPin className="size-5 text-olive-600" aria-hidden="true" />
                {t('admin.settings.addressAr')}
              </label>
              <textarea
                id={ids.addressAr}
                name="addressAr"
                rows={2}
                maxLength={300}
                dir="rtl"
                lang="ar"
                defaultValue={data.addressAr ?? ''}
                className="field-input py-3"
              />
            </div>
            <div>
              <label htmlFor={ids.addressFr} className={label}>
                <MapPin className="size-5 text-olive-600" aria-hidden="true" />
                {t('admin.settings.addressFr')}
              </label>
              <textarea
                id={ids.addressFr}
                name="addressFr"
                rows={2}
                maxLength={300}
                dir="ltr"
                lang="fr"
                defaultValue={data.addressFr ?? ''}
                className="field-input py-3"
              />
            </div>
            <p className="-mt-g1 text-sm text-ink-soft sm:col-span-2">
              {t('admin.settings.addressHint')}
            </p>
          </div>

          <h2 className="mt-g1 flex items-center gap-2 border-t border-sand-deep/50 pt-g3 text-lg font-bold text-olive">
            <WhatsappIcon className="size-5 text-whatsapp-deep" />
            {t('admin.settings.contactTitle')}
          </h2>
          <div>
            <label htmlFor={ids.wa} className={label}>
              <WhatsappIcon className="size-5 text-whatsapp-deep" />
              {t('admin.settings.whatsapp')}
            </label>
            <input
              id={ids.wa}
              name="whatsapp"
              type="tel"
              inputMode="tel"
              dir="ltr"
              placeholder="06 12 34 56 78"
              defaultValue={data.whatsapp ? `+${data.whatsapp}` : ''}
              aria-invalid={errors.whatsapp || undefined}
              aria-describedby={`${ids.wa}-hint`}
              className="field-input text-start rtl:text-end"
            />
            {errors.whatsapp ? (
              <p className="mt-1.5 text-sm font-medium text-danger">
                {t('admin.settings.invalid')}
              </p>
            ) : null}
            <p id={`${ids.wa}-hint`} className="mt-1.5 text-sm text-ink-soft">
              {t('admin.settings.whatsappHint')}
            </p>
            {data.whatsapp ? (
              <a
                href={whatsappLink(data.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="tap mt-1 inline-flex items-center text-sm font-medium text-olive-600 underline underline-offset-4"
              >
                {t('admin.settings.test')}
              </a>
            ) : null}
          </div>

          <div>
            <label htmlFor={ids.phone} className={label}>
              <Phone className="size-5 text-olive-600" aria-hidden="true" />
              {t('admin.settings.phone')}
            </label>
            <input
              id={ids.phone}
              name="phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              placeholder="05 24 00 00 00"
              defaultValue={data.phone ? formatPhoneDisplay(data.phone) : ''}
              aria-invalid={errors.phone || undefined}
              aria-describedby={`${ids.phone}-hint`}
              className="field-input text-start rtl:text-end"
            />
            {errors.phone ? (
              <p className="mt-1.5 text-sm font-medium text-danger">
                {t('admin.settings.invalid')}
              </p>
            ) : null}
            <p id={`${ids.phone}-hint`} className="mt-1.5 text-sm text-ink-soft">
              {t('admin.settings.phoneHint')}
            </p>
          </div>
        </fieldset>

        {isOwner ? (
          <div className="mt-g3 flex flex-wrap items-center gap-g2">
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {t('admin.settings.save')}
            </Button>
            <p role="status" className="text-sm font-medium">
              {saved ? (
                <span className="inline-flex items-center gap-1.5 text-olive-600">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {t('admin.settings.saved')}
                </span>
              ) : errors.form ? (
                <span className="text-danger">{t('admin.settings.error')}</span>
              ) : null}
            </p>
          </div>
        ) : null}
      </form>

      <DeliverySettings editable={isOwner} />
      <MarketingSettings editable={isOwner} />
    </div>
  )
}
