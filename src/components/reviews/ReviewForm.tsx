import { useServerFn } from '@tanstack/react-start'
import { Camera, CheckCircle2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { type MessageKey, useLocale, useT } from '~/i18n'
import { REVIEW_COMMENT_MAX, REVIEW_PHOTO_MAX_MB, reviewFields } from '~/lib/reviews'
import { submitReviewFn } from '~/server/functions/reviews'
import { Button } from '../ui/button'
import { useProofOfWork } from '../useProofOfWork'
import { StarInput } from './Stars'

type Errors = Partial<
  Record<'name' | 'rating' | 'comment' | 'city' | 'phone' | 'photo' | 'form', MessageKey>
>

const PHOTO_ERRORS: Record<string, MessageKey> = {
  too_large: 'reviews.errors.photoTooLarge',
  not_image: 'reviews.errors.photoInvalid',
  too_small: 'reviews.errors.photoTooSmall',
}

/** Public review form. Multipart so the optional photo travels with the text. */
export function ReviewForm({ formToken, onDone }: { formToken: string; onDone: () => void }) {
  const t = useT()
  const locale = useLocale()
  const submit = useServerFn(submitReviewFn)
  const ids = { name: useId(), city: useId(), comment: useId(), phone: useId(), photo: useId() }
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const pow = useProofOfWork(formRef)

  useEffect(() => {
    if (!photo) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  function pickPhoto(file: File | undefined) {
    setErrors((e) => ({ ...e, photo: undefined }))
    if (!file) return
    if (file.size > REVIEW_PHOTO_MAX_MB * 1024 * 1024) {
      setErrors((e) => ({ ...e, photo: 'reviews.errors.photoTooLarge' }))
      return
    }
    if (!file.type.startsWith('image/')) {
      setErrors((e) => ({ ...e, photo: 'reviews.errors.photoInvalid' }))
      return
    }
    setPhoto(file)
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const next: Errors = {}
    const check = (key: keyof typeof reviewFields, value: unknown) => {
      const r = reviewFields[key].safeParse(value)
      if (!r.success)
        next[key] = (r.error.issues[0]?.message ?? 'reviews.errors.generic') as MessageKey
    }
    check('name', fd.get('name'))
    check('rating', rating)
    check('comment', comment)
    check('city', fd.get('city') ?? '')
    check('phone', fd.get('phone') ?? '')
    setErrors(next)
    if (Object.keys(next).length) {
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"] input, [aria-invalid="true"]')
          ?.focus(),
      )
      return
    }
    fd.set('rating', String(rating))
    fd.set('locale', locale)
    fd.set('formToken', formToken)
    fd.delete('photo')
    if (photo) fd.set('photo', photo)

    setBusy(true)
    try {
      fd.set('altcha', (await pow.take()) ?? '')
      const result = await submit({ data: fd })
      if (result.status === 'ok') setSent(true)
      else if (result.status === 'photo_error')
        setErrors({ photo: PHOTO_ERRORS[result.code] ?? 'reviews.errors.photoInvalid' })
      else if (result.status === 'rate_limited') setErrors({ form: 'reviews.errors.rateLimited' })
      else if (result.status === 'invalid')
        setErrors(
          Object.fromEntries(
            Object.entries(result.fieldErrors).map(([k, v]) => [k, v as MessageKey]),
          ) as Errors,
        )
      else setErrors({ form: 'reviews.errors.generic' })
    } catch {
      setErrors({ form: 'reviews.errors.generic' })
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="py-g4 text-center" role="status">
        <CheckCircle2
          className="mx-auto size-14 text-olive-600"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <p className="mt-g2 font-display text-h3 text-olive">{t('reviews.form.thanksTitle')}</p>
        <p className="mx-auto mt-g1 max-w-[24rem] text-ink-soft">{t('reviews.form.thanks')}</p>
        <Button className="mt-g3" onClick={onDone}>
          {t('reviews.close')}
        </Button>
      </div>
    )
  }

  const err = (key: keyof Errors) => (errors[key] ? t(errors[key] as MessageKey) : null)
  const errorText = (key: keyof Errors, id: string) =>
    errors[key] ? (
      <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-danger">
        {err(key)}
      </p>
    ) : null

  return (
    <form method="post" ref={formRef} onSubmit={onSubmit} noValidate className="space-y-g3">
      <p className="text-ink-soft">{t('reviews.form.intro')}</p>

      <div>
        <StarInput
          name="rating-input"
          value={rating}
          onChange={(r) => {
            setRating(r)
            setErrors((e) => ({ ...e, rating: undefined }))
          }}
          invalid={Boolean(errors.rating)}
          describedBy={errors.rating ? 'rating-error' : undefined}
          legend={t('reviews.form.rating')}
        />
        {errorText('rating', 'rating')}
      </div>

      <div className="grid gap-g3 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.name} className="mb-1.5 block font-medium text-olive">
            {t('reviews.form.name')}
          </label>
          <input
            id={ids.name}
            name="name"
            autoComplete="name"
            maxLength={60}
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={`${ids.name}-hint${errors.name ? ` ${ids.name}-error` : ''}`}
            className="field-input"
          />
          {errorText('name', ids.name)}
          <p id={`${ids.name}-hint`} className="mt-1.5 text-xs text-ink-soft">
            {t('reviews.form.nameHint')}
          </p>
        </div>
        <div>
          <label htmlFor={ids.city} className="mb-1.5 block font-medium text-olive">
            {t('reviews.form.city')}{' '}
            <span className="text-sm font-normal text-ink-soft">({t('orderForm.optional')})</span>
          </label>
          <input
            id={ids.city}
            name="city"
            autoComplete="address-level2"
            maxLength={80}
            className="field-input"
          />
          {errorText('city', ids.city)}
        </div>
      </div>

      <div>
        <label htmlFor={ids.comment} className="mb-1.5 block font-medium text-olive">
          {t('reviews.form.comment')}
        </label>
        <textarea
          id={ids.comment}
          name="comment"
          rows={4}
          maxLength={REVIEW_COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('reviews.form.commentPlaceholder')}
          aria-invalid={Boolean(errors.comment) || undefined}
          aria-describedby={`${ids.comment}-count${errors.comment ? ` ${ids.comment}-error` : ''}`}
          className="field-input py-3"
        />
        <div className="mt-1 flex justify-between gap-3">
          {errorText('comment', ids.comment) ?? <span />}
          <span
            id={`${ids.comment}-count`}
            className="text-xs text-ink-soft tabular-nums"
            dir="ltr"
          >
            {comment.trim().length}/{REVIEW_COMMENT_MAX}
          </span>
        </div>
      </div>

      {/* Photo: small square preview, like a marketplace review. */}
      <div>
        <span className="mb-1.5 block font-medium text-olive">
          {t('reviews.form.photo')}{' '}
          <span className="text-sm font-normal text-ink-soft">({t('orderForm.optional')})</span>
        </span>
        <div className="flex items-center gap-g2">
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt=""
                className="size-20 rounded-field object-cover ring-1 ring-sand-deep"
              />
              <button
                type="button"
                onClick={() => {
                  setPhoto(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
                aria-label={t('reviews.form.removePhoto')}
                className="absolute -end-2 -top-2 inline-flex size-8 items-center justify-center rounded-full bg-ink text-limewash shadow-lift"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <label
            htmlFor={ids.photo}
            className="tap inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-olive/40 px-4 py-2 text-sm font-medium text-olive hover:bg-olive/5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-oil"
          >
            <Camera className="size-5" aria-hidden="true" />
            {t('reviews.form.photo')}
            <input
              ref={fileRef}
              id={ids.photo}
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
              className="sr-only"
              aria-describedby={`${ids.photo}-hint`}
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
          </label>
        </div>
        {errorText('photo', ids.photo)}
        <p id={`${ids.photo}-hint`} className="mt-1.5 text-xs text-ink-soft">
          {t('reviews.form.photoHint')}
        </p>
      </div>

      <div>
        <label htmlFor={ids.phone} className="mb-1.5 block font-medium text-olive">
          {t('reviews.form.phone')}{' '}
          <span className="text-sm font-normal text-ink-soft">({t('orderForm.optional')})</span>
        </label>
        <input
          id={ids.phone}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          placeholder="06 12 34 56 78"
          aria-invalid={Boolean(errors.phone) || undefined}
          aria-describedby={`${ids.phone}-hint`}
          className="field-input text-start rtl:text-end"
        />
        {errorText('phone', ids.phone)}
        <p id={`${ids.phone}-hint`} className="mt-1.5 text-xs text-ink-soft">
          {t('reviews.form.phoneHint')}
        </p>
      </div>

      {/* Honeypot */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
        <label>
          {t('orderForm.honeypot')}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {errors.form ? (
        <p role="alert" className="font-medium text-danger">
          {t(errors.form)}
        </p>
      ) : null}

      <div className="flex gap-g2">
        <Button type="button" variant="outline" size="lg" onClick={onDone}>
          {t('reviews.form.cancel')}
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={busy}
          className="flex-1 bg-oil text-olive-950 hover:bg-oil-bright"
        >
          {busy ? t('reviews.form.submitting') : t('reviews.form.submit')}
        </Button>
      </div>
    </form>
  )
}
