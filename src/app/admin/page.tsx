'use client'

// Phase 13 surface 2 — internal admin console. Direct-URL only (not in the nav).
// Server routes enforce is_admin; this page gates the UI and redirects others.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminConsole from '@/components/admin/AdminConsole'

export default function AdminPage() {
  const router = useRouter()
  const [state, setState] = useState<'checking' | 'ok'>('checking')

  useEffect(() => {
    let cancelled = false
    fetch('/api/users/me')
      .then(r => r.json())
      .then((data: { isAdmin?: boolean }) => {
        if (cancelled) return
        if (data.isAdmin) setState('ok')
        else router.replace('/feed')
      })
      .catch(() => {
        if (!cancelled) router.replace('/feed')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  if (state === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50">
        <div className="w-7 h-7 rounded-full border-[3px] border-purple-100 border-t-purple-500 animate-spin" />
      </div>
    )
  }

  return <AdminConsole />
}
