import { redirect } from 'next/navigation'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>
}) {
  const params = await searchParams
  if (params.reset === 'success') {
    redirect('/?login=1&reset=success')
  }
  redirect('/?login=1')
}
