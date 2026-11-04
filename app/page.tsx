import MarketingHome from '@/components/marketing/MarketingHome'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ login?: string; reset?: string }>
}) {
  const params = await searchParams
  const passwordResetOk = params.reset === 'success'
  const initialLoginOpen = params.login === '1' || passwordResetOk

  return <MarketingHome initialLoginOpen={initialLoginOpen} passwordResetOk={passwordResetOk} />
}
