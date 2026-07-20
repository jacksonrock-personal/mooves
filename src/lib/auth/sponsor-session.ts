import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

// Sponsor session (Phase 13 surface 3). Separate realm from the consumer
// mooves-token: same signing secret, but a distinct `typ: 'sponsor'` claim and
// cookie name (mooves-sponsor-token), so a business session can never be
// interchanged with a consumer session.

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30 // 30 days

export interface SponsorSessionPayload extends JWTPayload {
  sub: string
  typ: 'sponsor'
  phone: string
}

function signingKey() {
  return new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
}

export async function signSponsorToken(sponsorId: string, phone: string): Promise<string> {
  return new SignJWT({ sub: sponsorId, typ: 'sponsor' as const, phone })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(signingKey())
}

export async function verifySponsorToken(token: string): Promise<SponsorSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey())
    if (payload.typ !== 'sponsor') return null
    return payload as SponsorSessionPayload
  } catch {
    return null
  }
}

export const SPONSOR_COOKIE = 'mooves-sponsor-token'
export const SPONSOR_SESSION_SECONDS = SESSION_DURATION_SECONDS
