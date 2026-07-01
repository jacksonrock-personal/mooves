import { SignJWT } from 'jose'

// Issues a short-lived Supabase-compatible JWT for client-side Realtime.
// Unlike mooves-token (30d, httpOnly), this is returned as JSON and held
// in memory by the client. Refresh before the 1-hour expiry.
export async function signSupabaseJwt(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  return new SignJWT({
    sub: userId,
    role: 'authenticated',
    aud: 'authenticated',
    iss: `${supabaseUrl}/auth/v1`,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}
