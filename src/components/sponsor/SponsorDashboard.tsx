'use client'

// Phase 13 surface 3 — sponsor dashboard (desktop). My moves, authoring
// (→ moderation queue), and per-move aggregate analytics.
// Mockup: mooves-phase13-sponsor.html.

import { useCallback, useEffect, useState } from 'react'
import { interestLabel } from '@/lib/interests'
import MoveForm, { type MoveFormValues } from '@/components/admin/MoveForm'

interface Sponsor {
  id: string
  phone: string
  businessName: string | null
}

interface SponsorMove {
  id: string
  title: string
  description: string
  category: string
  brand: string | null
  areaZip: string
  radiusMiles: number
  linkUrl: string | null
  imageUrl: string | null
  timeText: string | null
  status: string
  rejectReason: string | null
  createdAt: string
  impressions: number | null
  interested: number | null
  clicks: number | null
  broughtOver: number | null
}

type View = 'moves' | 'new' | 'edit' | 'analytics' | 'billing'

const STATUS: Record<string, { cls: string; dot: string; label: string }> = {
  pending: { cls: 'bg-purple-100 text-purple-700', dot: '#5F3FC4', label: 'In review' },
  approved: { cls: 'bg-green-100 text-green-700', dot: '#167A43', label: 'Live' },
  rejected: { cls: 'bg-red-tint text-red-500', dot: '#E8405A', label: 'Rejected' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.pending
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}

function fmt(n: number | null): string {
  return n === null ? '<5' : n.toLocaleString()
}

export default function SponsorDashboard({ sponsor, onLogout }: { sponsor: Sponsor; onLogout: () => void }) {
  const [view, setView] = useState<View>('moves')
  const [moves, setMoves] = useState<SponsorMove[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<SponsorMove | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = (await fetch('/api/sponsor/moves').then(r => r.json())) as { moves: SponsorMove[] }
    setMoves(data.moves ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function createMove(values: MoveFormValues) {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/sponsor/moves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, radiusMiles: Number(values.radiusMiles) || 25 }),
      })
      if (!res.ok) throw new Error()
      await load()
      setView('moves')
    } catch { setError('Could not submit the move, check the fields and try again.') } finally { setBusy(false) }
  }

  async function saveEdit(values: MoveFormValues) {
    if (!editing) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/sponsor/moves/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, radiusMiles: Number(values.radiusMiles) || 25 }),
      })
      if (!res.ok) throw new Error()
      await load()
      setEditing(null)
      setView('moves')
    } catch { setError('Could not save changes, try again.') } finally { setBusy(false) }
  }

  const viewingMove = moves.find(m => m.id === viewingId) ?? null
  const businessName = sponsor.businessName ?? 'Your business'

  const titles: Record<View, { t: string; s: string }> = {
    moves: { t: 'My moves', s: "Your sponsored moves and how they're doing" },
    new: { t: 'New move', s: 'Tell people nearby what’s happening' },
    edit: { t: 'Edit move', s: editing?.title ?? '' },
    analytics: { t: 'Analytics', s: viewingMove?.title ?? '' },
    billing: { t: 'Billing', s: 'Set up how you pay for published moves' },
  }

  const navItem = (v: View, label: string, icon: React.ReactNode) => (
    <button onClick={() => setView(v)}
      className={`flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-[10px] text-[13.5px] font-semibold ${
        view === v || (v === 'moves' && view === 'edit') || (v === 'analytics' && view === 'analytics')
          ? 'bg-purple-100 text-purple-700' : 'text-ink-500 hover:bg-purple-50'
      }`}>
      {icon}{label}
    </button>
  )

  const tile = (label: string, value: string, flywheel = false) => (
    <div className={`border rounded-[14px] p-4 ${flywheel ? 'bg-purple-50 border-[#D8CEF5]' : 'bg-white border-[#E8E4F5]'}`}>
      <div className={`font-display font-extrabold text-[26px] ${flywheel ? 'text-purple-700' : 'text-ink-900'}`}>{value}</div>
      <div className="text-[12px] text-ink-500 mt-0.5">{label}</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-purple-50 flex">
      {/* Sidebar */}
      <div className="w-[210px] bg-white border-r border-[#E8E4F5] shrink-0 p-4 flex flex-col">
        <div className="px-2 pb-4">
          <div className="font-display font-extrabold text-[16px] text-ink-900">M<span className="text-purple-500">oo</span>ves</div>
          <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-grey-300">for Business</div>
        </div>
        <div className="flex flex-col gap-1">
          {navItem('moves', 'My moves', <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="14" y="3" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="14" y="12" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="3" y="16" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" /></svg>)}
          {navItem('new', 'New move', <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>)}
          {navItem('billing', 'Billing', <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M3 10h18" stroke="currentColor" strokeWidth="2" /></svg>)}
        </div>
        <div className="mt-auto pt-3 border-t border-[#E8E4F5]">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-[30px] h-[30px] rounded-[9px] bg-gradient-to-br from-[#F0A6C0] to-[#E0789E] flex items-center justify-center text-white font-bold text-[12px]">{businessName.charAt(0).toUpperCase()}</div>
            <div className="text-[12px] font-semibold text-ink-900 leading-tight truncate">{businessName}<span className="block font-medium text-ink-500 text-[11px]">Sponsor</span></div>
          </div>
          <button onClick={onLogout} className="text-[12px] font-semibold text-ink-500 hover:text-purple-700 px-1">Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-5 border-b border-[#E8E4F5] bg-white flex items-center justify-between">
          <div>
            <h1 className="font-display font-extrabold text-[22px] text-ink-900">{titles[view].t}</h1>
            <div className="text-[13px] text-ink-500 mt-0.5">{titles[view].s}</div>
          </div>
          {view === 'moves' && <button onClick={() => setView('new')} className="bg-purple-500 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5">+ New move</button>}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <div className="text-[13px] text-red-500 mb-3">{error}</div>}

          {loading && view === 'moves' ? (
            <div className="flex justify-center pt-16"><div className="w-7 h-7 rounded-full border-[3px] border-purple-100 border-t-purple-500 animate-spin" /></div>
          ) : view === 'moves' ? (
            moves.length === 0 ? (
              <div className="flex flex-col items-center text-center pt-14">
                <div className="w-[76px] h-[76px] rounded-[20px] bg-purple-100 flex items-center justify-center mb-4">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#7C5CDB" strokeWidth="2" /><path d="M12 8v8M8 12h8" stroke="#7C5CDB" strokeWidth="2" strokeLinecap="round" /></svg>
                </div>
                <h3 className="font-display font-extrabold text-[19px] text-ink-900 mb-1.5">Post your first move</h3>
                <p className="text-[13.5px] text-ink-500 max-w-[320px] leading-relaxed mb-4">Tell people nearby what&apos;s happening at your place. We&apos;ll review it, then it shows up in the area feed for folks who opted into your kind of thing.</p>
                <button onClick={() => setView('new')} className="bg-purple-500 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5">+ New move</button>
              </div>
            ) : (
              moves.map(m => (
                <div key={m.id} className="bg-white border border-[#E8E4F5] rounded-[14px] p-4 mb-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-purple-100 text-purple-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold">{interestLabel(m.category)}</span>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="font-display font-extrabold text-[16px] text-ink-900">{m.title}</div>
                  <div className="text-[12.5px] text-ink-500 mt-0.5">{[m.areaZip, `${m.radiusMiles} mi`, m.timeText].filter(Boolean).join(' · ')}</div>

                  {m.status === 'approved' && (
                    <div className="flex gap-6 mt-3">
                      <div><div className="font-display font-extrabold text-[18px] text-ink-900">{fmt(m.impressions)}</div><div className="text-[11px] text-ink-500">Feeds reached</div></div>
                      <div><div className="font-display font-extrabold text-[18px] text-ink-900">{fmt(m.interested)}</div><div className="text-[11px] text-ink-500">Interested</div></div>
                      <div><div className="font-display font-extrabold text-[18px] text-ink-900">{fmt(m.clicks)}</div><div className="text-[11px] text-ink-500">Clicks</div></div>
                      <div><div className="font-display font-extrabold text-[18px] text-ink-900">{fmt(m.broughtOver)}</div><div className="text-[11px] text-ink-500">Brought to feeds</div></div>
                    </div>
                  )}
                  {m.status === 'pending' && <div className="text-[12.5px] text-ink-500 mt-2">Mooves usually reviews within a day.</div>}
                  {m.status === 'rejected' && m.rejectReason && (
                    <div className="bg-red-tint text-red-500 text-[12.5px] rounded-[10px] px-3 py-2.5 mt-2.5 leading-relaxed">{m.rejectReason}</div>
                  )}

                  <div className="flex gap-2 items-center mt-3.5">
                    {m.status === 'approved' && <button onClick={() => { setViewingId(m.id); setView('analytics') }} className="bg-white border border-[#E8E4F5] text-ink-900 font-semibold text-[13px] rounded-[10px] px-4 py-2">View analytics</button>}
                    {m.status === 'rejected' && <button onClick={() => { setEditing(m); setView('edit') }} className="bg-purple-500 text-white font-semibold text-[13px] rounded-[10px] px-4 py-2">Edit &amp; resubmit</button>}
                    {m.status !== 'rejected' && <button onClick={() => { setEditing(m); setView('edit') }} className="text-purple-700 font-semibold text-[12.5px]">Edit</button>}
                  </div>
                </div>
              ))
            )
          ) : view === 'new' ? (
            <MoveForm mode="edit" submitting={busy} submitLabel="Submit for review"
              footnote="Submitting sends this to Mooves for review. Once approved, it goes live and your payment method on file is billed per your plan. You're not charged for anything under review or rejected."
              onSubmit={createMove} onCancel={() => setView('moves')} />
          ) : view === 'edit' && editing ? (
            <MoveForm mode="edit" submitting={busy} submitLabel="Save & resubmit"
              footnote="Saving sends this back to Mooves for review."
              initial={{
                title: editing.title, description: editing.description, category: editing.category,
                brand: editing.brand ?? '', areaZip: editing.areaZip, radiusMiles: String(editing.radiusMiles),
                linkUrl: editing.linkUrl ?? '', imageUrl: editing.imageUrl ?? '', timeText: editing.timeText ?? '',
              }}
              onSubmit={saveEdit} onCancel={() => { setEditing(null); setView('moves') }} />
          ) : view === 'analytics' && viewingMove ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-purple-100 text-purple-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold">{interestLabel(viewingMove.category)}</span>
                <StatusBadge status={viewingMove.status} />
                <span className="font-display font-extrabold text-[16px] text-ink-900 ml-1">{viewingMove.title}</span>
              </div>
              <div className="grid grid-cols-4 gap-3.5 mb-5">
                {tile('Feeds reached', fmt(viewingMove.impressions))}
                {tile('Interested', fmt(viewingMove.interested))}
                {tile('Link clicks', fmt(viewingMove.clicks))}
                {tile('Brought to friend feeds', fmt(viewingMove.broughtOver), true)}
              </div>
              <div className="bg-white border border-[#E8E4F5] rounded-[14px] p-[18px]">
                <h4 className="font-display font-extrabold text-[15px] text-ink-900 mb-2.5">Details</h4>
                <div className="flex justify-between text-[13px] py-1.5 border-b border-[#E8E4F5]"><span className="text-ink-500">Area</span><span className="text-ink-900 font-semibold">{viewingMove.areaZip} + within {viewingMove.radiusMiles} miles</span></div>
                <div className="flex justify-between text-[13px] py-1.5 border-b border-[#E8E4F5]"><span className="text-ink-500">Category</span><span className="text-ink-900 font-semibold">{interestLabel(viewingMove.category)}</span></div>
                <div className="flex justify-between text-[13px] py-1.5"><span className="text-ink-500">Link</span><span className="text-ink-900 font-semibold">{viewingMove.linkUrl?.replace(/^https?:\/\//, '') ?? '—'}</span></div>
              </div>
              <div className="text-[11.5px] text-grey-300 mt-3.5 leading-relaxed">All counts are aggregate. Mooves never shares who saw, tapped, or brought your move. Counts under 5 are hidden to protect people.</div>
              <button onClick={() => setView('moves')} className="text-purple-700 font-semibold text-[13px] mt-4">‹ Back to my moves</button>
            </>
          ) : view === 'billing' ? (
            <div className="max-w-[520px]">
              <div className="bg-white border border-[#E8E4F5] rounded-[14px] p-5">
                <h4 className="font-display font-extrabold text-[15px] text-ink-900 mb-1.5">Payment method</h4>
                <p className="text-[13px] text-ink-500 leading-relaxed mb-3">Add a card once. When a move is approved and goes live, you&apos;re billed automatically per your plan. You&apos;re never charged for moves under review or rejected.</p>
                <div className="text-[12.5px] text-grey-300">Billing setup is coming soon.</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
