// Root route — redirect based on auth state
// Middleware handles the actual routing logic; this is a fallback.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/feed')
  } else {
    redirect('/auth')
  }
}
