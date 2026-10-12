import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { CheckCircle2, EyeOff, Plus, ShieldCheck } from 'lucide-react'
import { useId, useState } from 'react'
import { Picture } from '~/components/Picture'
import { Button } from '~/components/ui/button'
import { type MessageKey, useT } from '~/i18n'
import { cn } from '~/lib/cn'
import {
  adminDeleteCertification,
  adminGetCertifications,
  adminSaveCertification,
} from '~/server/functions/trust'

const certsQuery = {
  queryKey: ['admin', 'certifications'] as const,
  queryFn: () => adminGetCertifications(),
}

export const Route = createFileRoute('/admin/trust')({
  loader: ({ context }) => context.queryClient.ensureQueryData(certsQuery),
  component: TrustAdmin,
})

type Cert = Awaited<ReturnType<typeof adminGetCertifications>>[number]

const TYPES: Array<{ value: Cert['type']; label: MessageKey }> = [
  { value: 'onssa', label: 'admin.trust.typeOnssa' },
  { value: 'organic', label: 'admin.trust.typeOrganic' },
  { value: 'igp', label: 'admin.trust.typeIgp' },
  { value: 'iso', label: 'admin.trust.typeIso' },
  { value: 'other', label: 'admin.trust.typeOther' },
]

function TrustAdmin() {
  const t = useT()
  const { admin } = Route.useRouteContext()
  const { data } = useQuery({ ...certsQuery, initialData: Route.useLoaderData() })
  const [adding, setAdding] = useState(false)
  const isOwner = admin.role === 'owner'

  return (
    <div className="max-w-3xl">
      <h1 className="text-h2">{t('admin.trust.title')}</h1>
      <p className="mt-g1 text-ink-soft">{t('admin.trust.intro')}</p>
      {!isOwner ? (
        <p className="mt-g1 text-sm font-medium text-oil-deep">{t('admin.trust.ownerOnly')}</p>
      ) : null}

      <ul className="mt-g3 space-y-g2">
        {data.length === 0 && !adding ? (
          <li className="rounded-card border-2 border-dashed border-sand-deep p-g4 text-center text-ink-soft">
            {t('admin.trust.empty')}
          </li>
        ) : null}
        {data.map((c) => (
          <CertCard key={c.id} cert={c} editable={isOwner} />
        ))}
        {adding ? <CertForm onDone={() => setAdding(false)} /> : null}
      </ul>

      {isOwner && !adding ? (
        <Button className="mt-g3" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" />
          {t('admin.trust.add')}
        </Button>
      ) : null}
    </div>
  )
}

function CertCard({ cert, editable }: { cert: Cert; editable: boolean }) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const remove = useServerFn(adminDeleteCertification)
  const queryClient = useQueryClient()
  if (editing) return <CertForm cert={cert} onDone={() => setEditing(false)} />
  const live = cert.isPublic && Boolean(cert.number.trim()) && Boolean(cert.image)
  const typeLabel = TYPES.find((x) => x.value === cert.type)?.label ?? 'admin.trust.typeOther'

  return (
    <li className="flex flex-wrap items-start gap-g2 rounded-card bg-white p-g3 shadow-lift ring-1 ring-sand-deep/50">
      {cert.image ? (
        <a
          href={cert.image.fallback}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 overflow-hidden rounded-field ring-1 ring-sand-deep"
        >
          <Picture image={cert.image} alt="" sizes="7rem" className="block h-28 w-24" />
        </a>
      ) : (
        <span className="flex h-28 w-24 shrink-0 items-center justify-center rounded-field bg-sand text-ink-soft">
          <ShieldCheck className="size-8" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-bold text-olive">{t(typeLabel)}</p>
        <p className="font-display text-h3 tabular-nums" dir="ltr">
          {cert.number}
        </p>
        {cert.issuedAt ? (
          <p className="text-sm text-ink-soft">
            {t('admin.trust.issued')}: {cert.issuedAt}
          </p>
        ) : null}
        <p
          className={cn(
            'mt-g1 inline-flex items-center gap-1.5 text-sm font-medium',
            live ? 'text-olive-600' : 'text-oil-deep',
          )}
        >
          {live ? (
            <CheckCircle2 className="size-4" aria-hidden="true" />
          ) : (
            <EyeOff className="size-4" aria-hidden="true" />
          )}
          {live ? t('admin.trust.live') : t('admin.trust.hidden')}
        </p>
        {editable ? (
          <div className="mt-g2 flex gap-g1">
            <Button size="md" variant="outline" onClick={() => setEditing(true)}>
              {t('admin.trust.edit')}
            </Button>
            <Button
              size="md"
              variant="ghost"
              className="text-danger hover:bg-danger/5"
              onClick={async () => {
                if (!window.confirm(t('admin.trust.deleteConfirm'))) return
                await remove({ data: { id: cert.id } })
                await queryClient.invalidateQueries({ queryKey: ['admin'] })
              }}
            >
              {t('admin.trust.delete')}
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  )
}

function CertForm({ cert, onDone }: { cert?: Cert; onDone: () => void }) {
  const t = useT()
  const save = useServerFn(adminSaveCertification)
  const queryClient = useQueryClient()
  const id = useId()
  const [error, setError] = useState<MessageKey | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('isPublic', fd.get('isPublic') ? 'true' : 'false')
    if (cert) fd.set('id', cert.id)
    const scan = fd.get('scan')
    if (scan instanceof File && scan.size === 0) fd.delete('scan')
    setBusy(true)
    setError(null)
    try {
      const res = await save({ data: fd })
      if (!res.ok) {
        setError(res.error === 'invalid' ? 'admin.trust.errorInvalid' : 'admin.trust.errorImage')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
      onDone()
    } catch {
      setError('admin.order.error')
    } finally {
      setBusy(false)
    }
  }

  const field = 'mb-1 block text-sm font-medium text-olive'
  return (
    <li className="rounded-card bg-white p-g3 shadow-lift ring-2 ring-oil">
      <form method="post" onSubmit={onSubmit} className="grid gap-g2 sm:grid-cols-2">
        <label className="block">
          <span className={field}>{t('admin.trust.type')}</span>
          <select name="type" defaultValue={cert?.type ?? 'onssa'} className="field-input min-h-11">
            {TYPES.map((x) => (
              <option key={x.value} value={x.value}>
                {t(x.label)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={field}>{t('admin.trust.number')}</span>
          <input
            name="number"
            required
            defaultValue={cert?.number}
            dir="ltr"
            className="field-input min-h-11"
          />
        </label>
        <label className="block">
          <span className={field}>{t('admin.trust.issued')}</span>
          <input
            name="issuedAt"
            type="date"
            defaultValue={cert?.issuedAt ?? ''}
            className="field-input min-h-11"
          />
        </label>
        <label className="block">
          <span className={field}>{t('admin.trust.expires')}</span>
          <input
            name="expiresAt"
            type="date"
            defaultValue={cert?.expiresAt ?? ''}
            className="field-input min-h-11"
          />
        </label>
        <label className="block">
          <span className={field}>{t('admin.trust.labelAr')}</span>
          <input
            name="labelAr"
            defaultValue={cert?.labelAr ?? ''}
            dir="rtl"
            className="field-input min-h-11"
          />
        </label>
        <label className="block">
          <span className={field}>{t('admin.trust.labelFr')}</span>
          <input
            name="labelFr"
            defaultValue={cert?.labelFr ?? ''}
            dir="ltr"
            className="field-input min-h-11"
          />
        </label>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-scan`} className={field}>
            {t('admin.trust.scan')}
          </label>
          <input
            id={`${id}-scan`}
            name="scan"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            aria-describedby={`${id}-hint`}
            className="block w-full text-sm file:me-3 file:rounded-full file:border-0 file:bg-olive file:px-4 file:py-2 file:text-limewash"
          />
          <p id={`${id}-hint`} className="mt-1 text-xs text-ink-soft">
            {t('admin.trust.scanHint')}
          </p>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            name="isPublic"
            defaultChecked={cert?.isPublic ?? true}
            className="size-5 accent-olive"
          />
          <span className="font-medium">{t('admin.trust.public')}</span>
        </label>
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger sm:col-span-2">
            {t(error)}
          </p>
        ) : null}
        <div className="flex gap-g1 sm:col-span-2">
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {t('admin.trust.save')}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            {t('admin.trust.cancel')}
          </Button>
        </div>
      </form>
    </li>
  )
}
