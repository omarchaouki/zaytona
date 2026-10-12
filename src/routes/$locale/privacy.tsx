import { createFileRoute } from '@tanstack/react-router'
import { PolicyPage } from '~/components/PolicyPage'
import { translate } from '~/i18n'
import { alternateLinks } from '~/lib/site'
import { getPolicyPage } from '~/server/functions/public'

export const Route = createFileRoute('/$locale/privacy')({
  loader: ({ params }) => getPolicyPage({ data: { locale: params.locale, page: 'privacy' } }),
  head: ({ params, loaderData }) => ({
    meta: [{ title: loaderData?.title ?? translate(params.locale, 'meta.privacyTitle') }],
    links: alternateLinks(params.locale, '/privacy'),
  }),
  component: Page,
})

function Page() {
  const { title, html } = Route.useLoaderData()
  const { locale } = Route.useParams()
  return <PolicyPage title={title ?? translate(locale, 'meta.privacyTitle')} html={html} />
}
