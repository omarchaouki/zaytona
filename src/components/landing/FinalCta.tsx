import { useT } from '~/i18n'
import { cn } from '~/lib/cn'
import { ArchWindow } from '../ArchWindow'
import { WhatsappIcon } from '../icons'
import { Picture } from '../Picture'
import { useSite } from '../SiteContext'
import { Button, buttonVariants } from '../ui/button'
import { WhatsappLink } from '../WhatsappLink'

export function FinalCta() {
  const t = useT()
  const { whatsappNumber } = useSite()
  return (
    <section aria-labelledby="final-cta-title" className="container-page pb-g5 md:pb-g6">
      <div
        data-reveal
        className="glow-olive relative isolate grid items-center gap-10 overflow-hidden rounded-[28px] px-g2 py-g4 text-limewash sm:px-g3 sm:py-g5 shadow-[0_30px_80px_-40px_rgb(20_27_12/0.8)] md:grid-cols-[1.618fr_1fr] md:px-g5 md:py-g5"
      >
        {/* The grove path, slowly drifting under a deep olive veil. */}
        <div aria-hidden="true" className="kenburns-alt absolute inset-0 -z-20">
          <Picture
            image="grove-path"
            alt=""
            sizes="(min-width: 72rem) 72rem, 100vw"
            className="block h-full w-full"
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-t from-olive-950 via-olive-950/85 to-olive-950/55 md:bg-gradient-to-r md:from-olive-950 md:via-olive-950/80 md:to-olive-950/40 rtl:md:bg-gradient-to-l"
        />
        <div className="min-w-0">
          <h2 id="final-cta-title" className="max-w-[30rem] text-h2 text-limewash">
            {t('finalCta.title')}
          </h2>
          {whatsappNumber ? <p className="mt-3 text-limewash/75">{t('finalCta.body')}</p> : null}
          {/* Side by side only where the text column is wide enough (not in the tablet 2-column grid). */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-oil text-center whitespace-normal text-olive-950 hover:bg-oil-bright"
            >
              <a href="#order">{t('finalCta.order')}</a>
            </Button>
            <WhatsappLink
              placement="final_cta"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'border-limewash/30 text-center whitespace-normal text-limewash hover:border-limewash hover:bg-limewash/10',
              )}
            >
              <WhatsappIcon className="text-whatsapp" />
              {t('finalCta.whatsapp')}
            </WhatsappLink>
          </div>
        </div>
        <ArchWindow
          slides={[
            { image: 'oil-pour', alt: '' },
            { image: 'olives-harvest', alt: '' },
          ]}
          sizes="14rem"
          traceColor="var(--color-oil-bright)"
          className="mx-auto hidden w-56 md:block"
        />
      </div>
    </section>
  )
}
