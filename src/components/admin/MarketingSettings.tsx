import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { CheckCircle2, Megaphone } from 'lucide-react'
import { useId, useState } from 'react'
import { type MessageKey, useT } from '~/i18n'
import { cn } from '~/lib/cn'
import { adminGetMarketingSettings, adminSaveMarketingSettings } from '~/server/functions/settings'
import { Button } from '../ui/button'

export const marketingQuery = {
  queryKey: ['admin', 'marketing-settings'] as const,
  queryFn: () => adminGetMarketingSettings(),
}

/**
 * Admin → Settings → Marketing: the Meta Pixel for Facebook / Instagram ads.
 * Off by default; when on, every page sends PageView and every order a Lead
 * (with its value in MAD). Optional visitor consent before anything loads.
 */
export function MarketingSettings({ editable }: { editable: boolean }) {
  const t = useT()
  const id = useId()
  const queryClient = useQueryClient()
  const save = useServerFn(adminSaveMarketingSettings)
  const { data } = useQuery(marketingQuery)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<MessageKey | null>(null)
  const [busy, setBusy] = useState(false)

  if (!data) return null
  const on = enabled ?? data.pixelEnabled

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    setState('idle')
    setError(null)
    try {
      const res = await save({
        data: {
          pixelEnabled: on,
          pixelId: String(fd.get('pixelId') ?? ''),
          requireConsent: fd.get('requireConsent') === 'on',
        },
      })
      if (!res.ok) {
        setError(
          res.error === 'missing_id' ? 'admin.marketing.missingId' : 'admin.marketing.invalidId',
        )
        return
      }
      setState('saved')
      setEnabled(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'marketing-settings'] })
    } catch {
      setState('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      aria-labelledby={`${id}-title`}
      className="mt-g3 rounded-card bg-white p-g3 shadow-lift ring-1 ring-sand-deep/50"
    >
      <div className="flex items-center gap-g1">
        <span className="flex size-10 items-center justify-center rounded-full bg-olive-950 text-oil-bright">
          <Megaphone className="size-5" aria-hidden="true" />
        </span>
        <h2 id={`${id}-title`} className="min-w-0 flex-1 text-h3">
          {t('admin.marketing.title')}
        </h2>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-bold',
            data.pixelEnabled && data.pixelId
              ? 'bg-olive-600/15 text-olive-700'
              : 'bg-sand text-ink-soft',
          )}
        >
          {data.pixelEnabled && data.pixelId
            ? t('admin.marketing.active')
            : t('admin.marketing.off')}
        </span>
      </div>
      <p className="mt-g1 text-sm text-ink-soft">{t('admin.marketing.intro')}</p>

      <fieldset disabled={!editable || busy} className="mt-g2 grid gap-g2">
        <legend className="sr-only">{t('admin.marketing.title')}</legend>

        {/* On/off switch */}
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => setEnabled(!on)}
          className="tap flex items-center justify-between gap-g2 rounded-field border border-sand-deep px-3 text-start"
        >
          <span className="font-bold text-olive">{t('admin.marketing.enable')}</span>
          <span
            aria-hidden="true"
            className={cn(
              'relative h-7 w-12 shrink-0 rounded-full transition-colors',
              on ? 'bg-olive-600' : 'bg-sand-deep',
            )}
          >
            <span
              className={cn(
                'absolute top-1 size-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-200',
                on ? 'start-6' : 'start-1',
              )}
            />
          </span>
        </button>

        <div>
          <label htmlFor={`${id}-pixel`} className="mb-1.5 block font-medium text-olive">
            {t('admin.marketing.pixelId')}
          </label>
          <input
            id={`${id}-pixel`}
            name="pixelId"
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            defaultValue={data.pixelId ?? ''}
            placeholder="123456789012345"
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-hint`}
            className="field-input min-h-11 tabular-nums"
          />
          {error ? <p className="mt-1.5 text-sm font-medium text-danger">{t(error)}</p> : null}
          <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-soft">
            {t('admin.marketing.pixelHint')}
          </p>
        </div>

        <label className="flex min-h-11 cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            name="requireConsent"
            defaultChecked={data.requireConsent}
            className="mt-1 size-5 shrink-0 accent-olive"
          />
          <span>
            <span className="block font-medium">{t('admin.marketing.consent')}</span>
            <span className="block text-sm text-ink-soft">{t('admin.marketing.consentHint')}</span>
          </span>
        </label>

        <ul className="space-y-1 rounded-field bg-olive-600/[0.07] p-3 text-sm text-olive">
          <li>• {t('admin.marketing.eventPageView')}</li>
          <li>• {t('admin.marketing.eventLead')}</li>
          <li>• {t('admin.marketing.testHint')}</li>
        </ul>
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
                {t('admin.settings.saved')}
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
