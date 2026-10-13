import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Droplets, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '~/components/ui/button'
import { type MessageKey, useLocale, useT } from '~/i18n'
import { cn } from '~/lib/cn'
import { formatMad } from '~/lib/format'
import { litersPrice } from '~/lib/order'
import {
  adminDeleteOffer,
  adminGetOffers,
  adminSaveOffer,
  adminSavePricing,
} from '~/server/functions/offers'

const offersQuery = {
  queryKey: ['admin', 'offers'] as const,
  queryFn: () => adminGetOffers(),
}

export const Route = createFileRoute('/admin/offers')({
  loader: ({ context }) => context.queryClient.ensureQueryData(offersQuery),
  component: OffersAdmin,
})

type Data = Awaited<ReturnType<typeof adminGetOffers>>
type Offer = Data['offers'][number]

const fieldLabel = 'mb-1 block text-sm font-medium text-olive'
const num = (v: FormDataEntryValue | null) => Number.parseFloat(String(v ?? '').replace(',', '.'))

function OffersAdmin() {
  const t = useT()
  const { admin } = Route.useRouteContext()
  const { data } = useQuery({ ...offersQuery, initialData: Route.useLoaderData() })
  const [adding, setAdding] = useState(false)
  const isOwner = admin.role === 'owner'

  return (
    <div className="max-w-3xl">
      <h1 className="text-h2">{t('admin.offers.title')}</h1>
      <p className="mt-g1 text-ink-soft">{t('admin.offers.intro')}</p>
      {!isOwner ? (
        <p className="mt-g1 text-sm font-medium text-oil-deep">{t('admin.offers.ownerOnly')}</p>
      ) : null}

      <PricingCard pricing={data.pricing} editable={isOwner} />

      <h2 className="mt-g4 text-h3">{t('admin.offers.offersTitle')}</h2>
      <ul className="mt-g2 space-y-g2">
        {data.offers.length === 0 && !adding ? (
          <li className="rounded-card border-2 border-dashed border-sand-deep p-g4 text-center text-ink-soft">
            {t('admin.offers.empty')}
          </li>
        ) : null}
        {data.offers.map((o) => (
          <OfferCard
            key={o.id}
            offer={o}
            pricePerLiter={data.pricing.pricePerLiter}
            editable={isOwner}
          />
        ))}
        {adding ? (
          <OfferForm pricePerLiter={data.pricing.pricePerLiter} onDone={() => setAdding(false)} />
        ) : null}
      </ul>
      {isOwner && !adding ? (
        <Button className="mt-g3" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" />
          {t('admin.offers.add')}
        </Button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------ price per litre */

function PricingCard({ pricing, editable }: { pricing: Data['pricing']; editable: boolean }) {
  const t = useT()
  const id = useId()
  const save = useServerFn(adminSavePricing)
  const queryClient = useQueryClient()
  const [state, setState] = useState<{ kind: 'idle' | 'error' } | { kind: 'saved'; n: number }>({
    kind: 'idle',
  })
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    try {
      const res = await save({
        data: {
          pricePerLiter: num(fd.get('pricePerLiter')),
          customEnabled: fd.get('customEnabled') === 'on',
          customMinLiters: Math.round(num(fd.get('customMinLiters'))),
          customMaxLiters: Math.round(num(fd.get('customMaxLiters'))),
        },
      })
      setState({ kind: 'saved', n: res.repriced })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'offers'] })
    } catch {
      setState({ kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="mt-g3 rounded-card bg-white p-g3 shadow-lift ring-1 ring-sand-deep/50"
    >
      <div className="flex items-center gap-g1">
        <span className="flex size-10 items-center justify-center rounded-full bg-olive-950 text-oil-bright">
          <Droplets className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-h3">{t('admin.offers.pricingTitle')}</h2>
      </div>
      {pricing.isDemo ? (
        <p className="mt-g2 rounded-field bg-oil-soft/70 px-3 py-2 text-sm font-medium text-oil-deep">
          {t('admin.offers.demoPrice')}
        </p>
      ) : null}
      <fieldset disabled={!editable || busy} className="mt-g2 grid gap-g2 sm:grid-cols-3">
        <label className="block sm:col-span-3">
          <span className={fieldLabel}>{t('admin.offers.pricePerLiter')}</span>
          <div className="relative max-w-[14rem]">
            <input
              name="pricePerLiter"
              inputMode="decimal"
              required
              dir="ltr"
              defaultValue={pricing.pricePerLiter ?? ''}
              aria-describedby={`${id}-ppl`}
              className="field-input pr-20 text-lg font-bold tabular-nums"
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-soft">
              {t('admin.offers.madPerLiter')}
            </span>
          </div>
          <span id={`${id}-ppl`} className="mt-1 block text-xs text-ink-soft">
            {t('admin.offers.pricePerLiterHint')}
          </span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 sm:col-span-3">
          <input
            type="checkbox"
            name="customEnabled"
            defaultChecked={pricing.customEnabled}
            className="size-5 accent-olive"
          />
          <span className="font-medium">{t('admin.offers.customEnabled')}</span>
        </label>
        <label className="block">
          <span className={fieldLabel}>{t('admin.offers.customMin')}</span>
          <input
            name="customMinLiters"
            inputMode="numeric"
            required
            dir="ltr"
            defaultValue={pricing.customMinLiters}
            className="field-input min-h-11 tabular-nums"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>{t('admin.offers.customMax')}</span>
          <input
            name="customMaxLiters"
            inputMode="numeric"
            required
            dir="ltr"
            defaultValue={pricing.customMaxLiters}
            className="field-input min-h-11 tabular-nums"
          />
        </label>
      </fieldset>
      {editable ? (
        <div className="mt-g2 flex flex-wrap items-center gap-g2">
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {t('admin.offers.save')}
          </Button>
          <p role="status" className="text-sm font-medium">
            {state.kind === 'saved' ? (
              <span className="text-olive-600">{t('admin.offers.saved', { count: state.n })}</span>
            ) : state.kind === 'error' ? (
              <span className="text-danger">{t('admin.offers.error')}</span>
            ) : null}
          </p>
        </div>
      ) : null}
    </form>
  )
}

/* ---------------------------------------------------------------- offers */

function OfferCard({
  offer,
  pricePerLiter,
  editable,
}: {
  offer: Offer
  pricePerLiter: number | null
  editable: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const remove = useServerFn(adminDeleteOffer)
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <OfferForm offer={offer} pricePerLiter={pricePerLiter} onDone={() => setEditing(false)} />
    )
  }
  const name = locale === 'ar' ? offer.nameAr : offer.nameFr

  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-g2 rounded-card bg-white p-g2 shadow-lift ring-1 ring-sand-deep/50 sm:p-g3',
        !offer.isActive && 'opacity-70',
      )}
    >
      <span className="flex size-16 shrink-0 flex-col items-center justify-center rounded-card bg-olive-950 text-oil-bright">
        <span className="font-display text-xl leading-none font-bold tabular-nums">
          {offer.liters ?? '—'}
        </span>
        <span className="text-xs">{t('orderForm.litersUnit')}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-olive">{name}</p>
        <p className="mt-0.5 text-lg font-bold tabular-nums">{formatMad(offer.price, locale)}</p>
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-medium">
          <span className="rounded-full bg-olive/[0.08] px-2 py-0.5 text-olive-600">
            {offer.autoPrice ? t('admin.offers.priceAuto') : t('admin.offers.priceFixed')}
          </span>
          {!offer.isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-ink-soft">
              <EyeOff className="size-3" aria-hidden="true" />
              {t('admin.offers.hidden')}
            </span>
          ) : null}
          {offer.isDemo ? (
            <span className="rounded-full bg-ink/80 px-2 py-0.5 text-limewash">
              {t('admin.offers.demo')}
            </span>
          ) : null}
        </div>
      </div>
      {editable ? (
        // Stacked on phones so the name, price and badges keep the width.
        <div className="flex flex-col gap-1 sm:flex-row">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={t('admin.offers.editLabel', { name: `${offer.liters ?? ''} L` })}
            className="tap inline-flex items-center justify-center rounded-full text-olive hover:bg-sand"
          >
            <Pencil className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm(t('admin.offers.deleteConfirm'))) return
              await remove({ data: { id: offer.id } })
              await queryClient.invalidateQueries({ queryKey: ['admin', 'offers'] })
            }}
            aria-label={t('admin.offers.deleteLabel', { name: `${offer.liters ?? ''} L` })}
            className="tap inline-flex items-center justify-center rounded-full text-ink-soft hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="size-5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </li>
  )
}

function OfferForm({
  offer,
  pricePerLiter,
  onDone,
}: {
  offer?: Offer
  pricePerLiter: number | null
  onDone: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const save = useServerFn(adminSaveOffer)
  const queryClient = useQueryClient()
  const [liters, setLiters] = useState(String(offer?.liters ?? ''))
  const [auto, setAuto] = useState(offer?.autoPrice ?? true)
  const [error, setError] = useState<MessageKey | null>(null)
  const [busy, setBusy] = useState(false)
  const litersN = num(liters)
  const autoPreview =
    pricePerLiter !== null && litersN > 0 ? litersPrice(litersN, pricePerLiter) : null

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    try {
      const res = await save({
        data: {
          id: offer?.id,
          nameAr: String(fd.get('nameAr') ?? ''),
          nameFr: String(fd.get('nameFr') ?? ''),
          liters: litersN,
          autoPrice: auto,
          price: auto ? undefined : num(fd.get('price')),
          taglineAr: String(fd.get('taglineAr') ?? ''),
          taglineFr: String(fd.get('taglineFr') ?? ''),
          isActive: fd.get('isActive') === 'on',
          sortOrder: Math.round(num(fd.get('sortOrder'))) || 0,
        },
      })
      if (!res.ok) {
        setError(res.error === 'no_price' ? 'admin.offers.errorNoPrice' : 'admin.offers.error')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['admin', 'offers'] })
      onDone()
    } catch {
      setError('admin.offers.error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-card bg-white p-g3 shadow-lift ring-2 ring-oil">
      <form method="post" onSubmit={onSubmit} className="grid gap-g2 sm:grid-cols-2">
        <label className="block">
          <span className={fieldLabel}>{t('admin.offers.liters')}</span>
          <input
            name="liters"
            inputMode="decimal"
            required
            dir="ltr"
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
            className="field-input min-h-11 text-lg font-bold tabular-nums"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>{t('admin.offers.sortOrder')}</span>
          <input
            name="sortOrder"
            inputMode="numeric"
            dir="ltr"
            defaultValue={offer?.sortOrder ?? 0}
            className="field-input min-h-11 tabular-nums"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>{t('admin.offers.nameAr')}</span>
          <input
            name="nameAr"
            required
            dir="rtl"
            defaultValue={offer?.nameAr ?? 'زيت الزيتون البكر الممتاز'}
            className="field-input min-h-11"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>{t('admin.offers.nameFr')}</span>
          <input
            name="nameFr"
            required
            dir="ltr"
            defaultValue={offer?.nameFr ?? "Huile d'olive vierge extra"}
            className="field-input min-h-11"
          />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className={fieldLabel}>{t('admin.offers.priceMode')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-field border-2 p-3',
                auto ? 'border-oil bg-oil/10' : 'border-sand-deep',
              )}
            >
              <input
                type="radio"
                name="mode"
                checked={auto}
                onChange={() => setAuto(true)}
                className="mt-1 size-4 accent-olive"
              />
              <span>
                <span className="block font-medium">{t('admin.offers.priceAuto')}</span>
                <span className="block text-sm text-ink-soft tabular-nums">
                  {autoPreview !== null
                    ? t('admin.offers.autoPreview', {
                        liters: litersN,
                        perLiter: formatMad(pricePerLiter ?? 0, locale),
                        total: formatMad(autoPreview, locale),
                      })
                    : t('admin.offers.errorNoPrice')}
                </span>
              </span>
            </label>
            <label
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-field border-2 p-3',
                !auto ? 'border-oil bg-oil/10' : 'border-sand-deep',
              )}
            >
              <input
                type="radio"
                name="mode"
                checked={!auto}
                onChange={() => setAuto(false)}
                className="mt-1 size-4 accent-olive"
              />
              <span className="flex-1">
                <span className="block font-medium">{t('admin.offers.priceFixed')}</span>
                {!auto ? (
                  <input
                    name="price"
                    inputMode="decimal"
                    required
                    dir="ltr"
                    aria-label={t('admin.offers.price')}
                    defaultValue={offer && !offer.autoPrice ? offer.price : (autoPreview ?? '')}
                    className="field-input mt-2 min-h-11 tabular-nums"
                  />
                ) : null}
              </span>
            </label>
          </div>
        </fieldset>

        <label className="block">
          <span className={fieldLabel}>{t('admin.offers.taglineAr')}</span>
          <input
            name="taglineAr"
            dir="rtl"
            defaultValue={offer?.taglineAr ?? ''}
            className="field-input min-h-11"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>{t('admin.offers.taglineFr')}</span>
          <input
            name="taglineFr"
            dir="ltr"
            defaultValue={offer?.taglineFr ?? ''}
            className="field-input min-h-11"
          />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={offer?.isActive ?? true}
            className="size-5 accent-olive"
          />
          <span className="font-medium">{t('admin.offers.active')}</span>
        </label>
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger sm:col-span-2">
            {t(error)}
          </p>
        ) : null}
        <div className="flex gap-g1 sm:col-span-2">
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {t('admin.offers.save')}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            {t('admin.offers.cancel')}
          </Button>
        </div>
      </form>
    </li>
  )
}
