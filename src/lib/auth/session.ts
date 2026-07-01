import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

// 30 days — matches the cookie Max-Age
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30

export interface SessionPayload extends JWTPayload {
  sub: string
  role: 'authenticated'
  phone: string
}

function signingKey() {
  return new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
}

// Signs a mooves-token. The token is a Supabase-compatible JWT so it also
// works as the Authorization header for RLS-gated Supabase queries.
export async function signSessionToken(
  userId: string,
  phone: string
): Promise<string> {
  return new SignJWT({ sub: userId, role: 'authenticated' as const, phone })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(signingKey())
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey())
    return payload as SessionPayload
  } catch {
    return null
  }
}
