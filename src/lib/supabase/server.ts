// Supabase server-side clients.
//
// We use Firebase Auth (not Supabase Auth), so we manage our own JWT cookie.
// The `createClient` function reads `mooves-token` from cookies and passes it
// as the Authorization header — this is how auth.uid() resolves in RLS policies.
//
// `createServiceClient` bypasses RLS entirely (service role key).
// Use it only in trusted server code: /api/auth/verify, /api/friendships,
// /api/sms/inbound, account deletion.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

// Use in Server Components and Route Handlers where the user's session matters
export async function createClient() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mooves-token')?.value

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      auth: { persistSession: false },
    }
  )
}

// Use in trusted server routes that need to bypass RLS
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
