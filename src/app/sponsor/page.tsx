'use client'

// Phase 13 surface 3 — sponsor portal entry. Its own auth realm: shows the
// phone-OTP auth if there's no sponsor session, the dashboard if there is.
// Mockup: mooves-phase13-sponsor.html.

import { useCallback, useEffect, useState } from 'react'
import SponsorAuth from '@/components/sponsor/SponsorAuth'
import SponsorDashboard from '@/components/sponsor/SponsorDashboard'

interface Sponsor {
  id: string
  phone: string
  businessName: string | null
}

export default function SponsorPage() {
  const [state, setState] = useState<'loading' | 'auth' | 'ok'>('loading')
  const [sponsor, setSponsor] = useState<Sponsor | null>(null)

  const loadSponsor = useCallback(async () => {
    try {
      const res = await fetch('/api/sponsor/me')
      if (res.ok) {
        setSponsor((await res.json()) as Sponsor)
        setState('ok')
      } else {
        setState('auth')
      }
    } catch {
      setState('auth')
    }
  }, [])

  useEffect(() => { void loadSponsor() }, [loadSponsor])

  async function handleLogout() {
    await fetch('/api/sponsor/auth/logout', { method: 'POST' })
    setSponsor(null)
    setState('auth')
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50">
        <div className="w-7 h-7 rounded-full border-[3px] border-purple-100 border-t-purple-500 animate-spin" />
      </div>
    )
  }

  if (state === 'auth' || !sponsor) {
    return <SponsorAuth onAuthed={() => { setState('loading'); void loadSponsor() }} />
  }

  return <SponsorDashboard sponsor={sponsor} onLogout={() => void handleLogout()} />
}
