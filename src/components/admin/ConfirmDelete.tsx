import { Trash2 } from 'lucide-react'
import { AlertDialog } from 'radix-ui'
import { useState } from 'react'
import { useT } from '~/i18n'
import { Button } from '../ui/button'

/**
 * Confirmation sheet before deleting orders: a bottom sheet on phones, a
 * centred dialog from tablets. Focus starts on "Cancel" (the safe choice).
 */
export function ConfirmDelete({
  open,
  onOpenChange,
  count,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  onConfirm: () => Promise<void>
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm" />
        <AlertDialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] bg-limewash p-g3 pb-[calc(1.618rem+env(safe-area-inset-bottom))] shadow-lift focus:outline-none sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[28rem] sm:rounded-[24px]">
          <span className="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
            <Trash2 className="size-6" aria-hidden="true" />
          </span>
          <AlertDialog.Title className="mt-g2 font-display text-h3 text-olive">
            {t('admin.orders.deleteTitle', { count })}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-g1 text-sm text-ink-soft">
            {t('admin.orders.deleteBody')}
          </AlertDialog.Description>
          <div className="mt-g3 flex flex-col-reverse gap-g1 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={busy}>
                {t('admin.orders.cancel')}
              </Button>
            </AlertDialog.Cancel>
            <Button
              disabled={busy}
              className="bg-danger text-white hover:bg-danger/90"
              onClick={async () => {
                setBusy(true)
                try {
                  await onConfirm()
                  onOpenChange(false)
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Trash2 aria-hidden="true" />
              {busy ? t('admin.orders.deleting') : t('admin.orders.deleteConfirm')}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
