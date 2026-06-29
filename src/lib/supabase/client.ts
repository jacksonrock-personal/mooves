'use client'

// Client-side Supabase instance.
//
// The mooves-token cookie is httpOnly, so JS can't read it directly.
// Instead we use Supabase's custom fetch to let the browser automatically
// send cookies on same-origin requests — Supabase then picks up the
// Authorization header we set in a thin API proxy, OR we can use a
// a session fetcher pattern.
//
// Simpler approach for client components: pass the token via a data attribute
// set by the Server Component that renders the page, or fetch it from
// /api/auth/session (a lightweight endpoint that reads the httpOnly cookie
// server-side and returns the token for client use).
//
// For MVP, most data fetching happens in Server Components (no client needed).
// The main client-side Supabase use case is Realtime subscriptions on the feed.
// That's handled in the feed page component which receives the token as a prop
// from the server.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Call this with the token from /api/auth/session (passed as a prop by the server)
export function createClient(accessToken?: string) {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      },
      auth: { persistSession: false },
    }
  )
}
