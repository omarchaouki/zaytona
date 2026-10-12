import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { CheckCircle2, Eye, Truck } from 'lucide-react'
import { useId, useState } from 'react'
import { type MessageKey, useLocale, useT } from '~/i18n'
import { cn } from '~/lib/cn'
import { formatMad } from '~/lib/format'
import type { DeliveryChoice } from '~/lib/settings'
import { adminGetDeliverySettings, adminSaveDeliverySettings } from '~/server/functions/settings'
import { Button } from '../ui/button'

type Choice = DeliveryChoice

export const deliveryQuery = {
  queryKey: ['admin', 'delivery-settings'] as const,
  queryFn: () => adminGetDeliverySettings(),
}

const CHOICES: Array<{ value: Choice; label: MessageKey; hint: MessageKey }> = [
  { value: 'flat', label: 'admin.delivery.flat', hint: 'admin.delivery.flatHint' },
  { value: 'free_above', label: 'admin.delivery.freeAbove', hint: 'admin.delivery.freeAboveHint' },
  { value: 'free', label: 'admin.delivery.free', hint: 'admin.delivery.freeHint' },
  { value: 'confirm', label: 'admin.delivery.confirm', hint: 'admin.delivery.confirmHint' },
]

const num = (v: string) => {
  const n = Number.parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/**
 * Delivery fees (Admin → Settings). The order form adds the fee to the total
 * and the site describes it; orders already placed keep the fee they had.
 * A live line shows the sentence customers will read.
 */
export function DeliverySettings({ editable }: { editable: boolean }) {
  const t = useT()
  const locale = useLocale()
  const id = useId()
  const queryClient = useQueryClient()
  const save = useServerFn(adminSaveDeliverySettings)
  const { data } = useQuery(deliveryQuery)

  const initialChoice: Choice =
    data?.mode === 'flat' && data.fee === 0 ? 'free' : (data?.mode ?? 'confirm')
  const [choice, setChoice] = useState<Choice | null>(null)
  const [fee, setFee] = useState<string | null>(null)
  const [freeAbove, setFreeAbove] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [missing, setMissing] = useState<{ fee?: boolean; freeAbove?: boolean }>({})
  const [busy, setBusy] = useState(false)

  if (!data) return null
  const current = choice ?? initialChoice
  const feeText = fee ?? (data.fee && data.fee > 0 ? String(data.fee) : '')
  const aboveText = freeAbove ?? (data.freeAbove !== null ? String(data.freeAbove) : '')
  const feeN = num(feeText)
  const aboveN = num(aboveText)

  // What the customer reads on the site with these values.
  const preview =
    current === 'flat' && feeN !== undefined
      ? t('whyUs.deliveryFlat', { fee: formatMad(feeN, locale) })
      : current === 'free_above' && feeN !== undefined && aboveN !== undefined
        ? t('whyUs.deliveryFreeAbove', {
            fee: formatMad(feeN, locale),
            threshold: formatMad(aboveN, locale),
          })
        : current === 'free'
          ? t('whyUs.deliveryFree')
          : t('whyUs.deliveryConfirm')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    setState('idle')
    setMissing({})
    try {
      const res = await save({
        data: {
          choice: current,
          fee: current === 'flat' || current === 'free_above' ? feeN : undefined,
          freeAbove: current === 'free_above' ? aboveN : undefined,
          timeAr: String(fd.get('timeAr') ?? ''),
          timeFr: String(fd.get('timeFr') ?? ''),
        },
      })
      if (!res.ok) {
        setMissing({ fee: Boolean(res.errors.fee), freeAbove: Boolean(res.errors.freeAbove) })
        return
      }
      setState('saved')
      setChoice(null)
      setFee(null)
      setFreeAbove(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'delivery-settings'] })
    } catch {
      setState('error')
    } finally {
      setBusy(false)
    }
  }

  const fieldLabel = 'mb-1.5 block font-medium text-olive'
  return (
    <form
      method="post"
      onSubmit={onSubmit}
      aria-labelledby={`${id}-title`}
      className="mt-g3 rounded-card bg-white p-g3 shadow-lift ring-1 ring-sand-deep/50"
    >
      <div className="flex items-center gap-g1">
        <span className="flex size-10 items-center justify-center rounded-full bg-olive-950 text-oil-bright">
          <Truck className="size-5" aria-hidden="true" />
        </span>
        <h2 id={`${id}-title`} className="text-h3">
          {t('admin.delivery.title')}
        </h2>
      </div>
      <p className="mt-g1 text-sm text-ink-soft">{t('admin.delivery.intro')}</p>

      <fieldset disabled={!editable || busy} className="mt-g2 grid gap-g2">
        <legend className="sr-only">{t('admin.delivery.title')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHOICES.map((c) => (
            <label
              key={c.value}
              className={cn(
                'flex min-h-11 cursor-pointer items-start gap-2 rounded-field border-2 p-3 transition-colors',
                current === c.value
                  ? 'border-oil bg-oil/10'
                  : 'border-sand-deep hover:border-olive-600/40',
              )}
            >
              <input
                type="radio"
                name="choice"
                value={c.value}
                checked={current === c.value}
                onChange={() => setChoice(c.value)}
                className="mt-1 size-4 shrink-0 accent-olive"
              />
              <span className="min-w-0">
                <span className="block font-bold text-olive">{t(c.label)}</span>
                <span className="block text-sm text-ink-soft">{t(c.hint)}</span>
              </span>
            </label>
          ))}
        </div>

        {current === 'flat' || current === 'free_above' ? (
          <div className="grid gap-g2 sm:grid-cols-2">
            <MoneyInput
              id={`${id}-fee`}
              label={t('admin.delivery.fee')}
              value={feeText}
              onChange={setFee}
              invalid={missing.fee}
              error={t('admin.delivery.required')}
            />
            {current === 'free_above' ? (
              <MoneyInput
                id={`${id}-above`}
                label={t('admin.delivery.threshold')}
                value={aboveText}
                onChange={setFreeAbove}
                invalid={missing.freeAbove}
                error={t('admin.delivery.required')}
              />
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-g2 sm:grid-cols-2">
          <label className="block">
            <span className={fieldLabel}>{t('admin.delivery.timeAr')}</span>
            <input
              name="timeAr"
              dir="rtl"
              defaultValue={data.timeAr ?? ''}
              placeholder="مثلاً: من 2 إلى 4 أيام"
              className="field-input min-h-11"
            />
          </label>
          <label className="block">
            <span className={fieldLabel}>{t('admin.delivery.timeFr')}</span>
            <input
              name="timeFr"
              dir="ltr"
              defaultValue={data.timeFr ?? ''}
              placeholder="Ex. : 2 à 4 jours"
              className="field-input min-h-11"
            />
          </label>
        </div>

        <p className="flex items-start gap-2 rounded-field bg-olive-600/[0.07] p-3 text-sm text-olive">
          <Eye className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-bold">{t('admin.delivery.preview')}</span> {preview}
          </span>
        </p>
      </fieldset>

      {editable ? (
        <div className="mt-g3 flex flex-wrap items-center gap-g2">
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {t('admin.settings.save')}
          </Button>
          <p role="status" className="text-sm font-medium">
            {state === 'saved' ? (
              <span className="inline-flex items-center gap-1.5 text-olive-600">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {t('admin.delivery.saved')}
              </span>
            ) : state === 'error' ? (
              <span className="text-danger">{t('admin.settings.error')}</span>
            ) : null}
          </p>
        </div>
      ) : null}
    </form>
  )
}

function MoneyInput({
  id,
  label,
  value,
  onChange,
  invalid,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  error: string
}) {
  const t = useT()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-medium text-olive">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className="field-input min-h-11 pr-16 text-lg font-bold tabular-nums"
        />
        {/* Physical right: the amount is written left to right. */}
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-soft">
          {t('admin.delivery.currency')}
        </span>
      </div>
      {invalid ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
