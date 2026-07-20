'use client'

// Phase 13 surface 2 — internal admin & moderation console (desktop).
// Mockup: mooves-phase13-admin.html. Author moves + moderate submissions.

import { useCallback, useEffect, useState } from 'react'
import { interestLabel } from '@/lib/interests'
import CowIllustration from '@/components/ui/CowIllustration'
import MoveForm, { type MoveFormValues } from './MoveForm'
import RejectModal from './RejectModal'

interface AdminMove {
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
  sponsorId: string | null
  impressions: number
  clicks: number
  interestedCount: number
  broughtOverCount: number
  createdAt: string
}

type View = 'queue' | 'all' | 'new' | 'edit'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; dot: string; label: string }> = {
    pending: { cls: 'bg-purple-100 text-purple-700', dot: '#5F3FC4', label: 'Pending' },
    approved: { cls: 'bg-green-100 text-green-700', dot: '#167A43', label: 'Approved' },
    rejected: { cls: 'bg-red-tint text-red-500', dot: '#E8405A', label: 'Rejected' },
  }
  const s = map[status] ?? map.pending
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}

export default function AdminConsole() {
  const [view, setView] = useState<View>('queue')
  const [moves, setMoves] = useState<AdminMove[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState<AdminMove | null>(null)
  const [editing, setEditing] = useState<AdminMove | null>(null)
  const [error, setError] = useState<string | null>(null)

  const listStatus = view === 'all' ? 'all' : 'pending'

  const load = useCallback(async (status: string) => {
    const data = (await fetch(`/api/admin/moves?status=${status}`).then(r => r.json())) as {
      moves: AdminMove[]
      pendingCount: number
    }
    setMoves(data.moves ?? [])
    setPendingCount(data.pendingCount ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (view === 'queue' || view === 'all') void load(listStatus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  async function approve(id: string) {
    setBusy(true)
    try {
      await fetch(`/api/admin/moves/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      await load(listStatus)
    } finally {
      setBusy(false)
    }
  }

  async function doReject(reason: string) {
    if (!rejecting) return
    setBusy(true)
    try {
      await fetch(`/api/admin/moves/${rejecting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectReason: reason }),
      })
      setRejecting(null)
      await load(listStatus)
    } finally {
      setBusy(false)
    }
  }

  async function createMove(values: MoveFormValues, publish: boolean) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/moves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          category: values.category,
          brand: values.brand,
          areaZip: values.areaZip,
          radiusMiles: Number(values.radiusMiles) || 25,
          linkUrl: values.linkUrl,
          imageUrl: values.imageUrl,
          timeText: values.timeText,
          publish,
        }),
      })
      if (!res.ok) throw new Error('create failed')
      setView(publish ? 'all' : 'queue')
    } catch {
      setError('Could not save the move, check the fields and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(values: MoveFormValues) {
    if (!editing) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/moves/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          category: values.category,
          brand: values.brand,
          areaZip: values.areaZip,
          radiusMiles: Number(values.radiusMiles) || 25,
          linkUrl: values.linkUrl,
          imageUrl: values.imageUrl,
          timeText: values.timeText,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      const back: View = editing.status === 'pending' ? 'queue' : 'all'
      setEditing(null)
      setView(back)
    } catch {
      setError('Could not save changes, try again.')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(m: AdminMove) {
    setEditing(m)
    setView('edit')
  }

  const titles: Record<View, { title: string; sub: string }> = {
    queue: { title: 'Moderation queue', sub: `${pendingCount} ${pendingCount === 1 ? 'move' : 'moves'} waiting for review` },
    all: { title: 'All moves', sub: 'Every sponsored move and its status' },
    new: { title: 'New move', sub: 'Author a move directly (concierge seeding)' },
    edit: { title: 'Edit move', sub: editing?.title ?? '' },
  }

  const navItem = (v: View, label: string, icon: React.ReactNode, count?: number) => (
    <button
      onClick={() => setView(v)}
      className={`flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-[10px] text-[13.5px] font-semibold ${
        (view === v || (v === 'queue' && view === 'edit' && editing?.status === 'pending'))
          ? 'bg-purple-100 text-purple-700'
          : 'text-ink-500 hover:bg-purple-50'
      }`}
    >
      {icon}
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-auto bg-purple-500 text-white text-[11px] font-bold rounded-full px-2 py-0.5">{count}</span>
      )}
    </button>
  )

  return (
    <div className="min-h-screen bg-ink-900/95 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-[1040px] h-[calc(100vh-64px)] max-h-[720px] bg-purple-50 rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.4)] flex">
        {/* Sidebar */}
        <div className="w-[210px] bg-white border-r border-[#E8E4F5] shrink-0 p-4 flex flex-col">
          <div className="flex items-center gap-2 px-2 pb-4">
            <span className="font-display font-extrabold text-[16px] text-ink-900">M<span className="text-purple-500">oo</span>ves</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-grey-300">Admin</span>
          </div>
          <div className="flex flex-col gap-1">
            {navItem('queue', 'Moderation',
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
              pendingCount)}
            {navItem('all', 'All moves',
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="3" y="10" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="3" y="16" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="2" /></svg>)}
            {navItem('new', 'New move',
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>)}
          </div>
          <div className="mt-auto flex items-center gap-2.5 pt-3 border-t border-[#E8E4F5]">
            <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#9B7FE8] to-purple-500 flex items-center justify-center text-white font-bold text-[12px]">O</div>
            <div className="text-[12px] font-semibold text-ink-900 leading-tight">Ops<span className="block font-medium text-ink-500 text-[11px]">Mooves staff</span></div>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-6 py-5 border-b border-[#E8E4F5] bg-white flex items-center justify-between">
            <div>
              <h1 className="font-display font-extrabold text-[22px] text-ink-900">{titles[view].title}</h1>
              <div className="text-[13px] text-ink-500 mt-0.5">{titles[view].sub}</div>
            </div>
            {(view === 'queue' || view === 'all') && (
              <button onClick={() => setView('new')} className="bg-purple-500 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5">
                + New move
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error && <div className="text-[13px] text-red-500 mb-3">{error}</div>}

            {loading && (view === 'queue' || view === 'all') ? (
              <div className="flex justify-center pt-16">
                <div className="w-7 h-7 rounded-full border-[3px] border-purple-100 border-t-purple-500 animate-spin" />
              </div>
            ) : view === 'queue' ? (
              moves.length === 0 ? (
                <div className="flex flex-col items-center text-center pt-14">
                  <CowIllustration size={88} className="mb-4 opacity-90" />
                  <h3 className="font-display font-extrabold text-[19px] text-ink-900 mb-1.5">You&apos;re all caught up</h3>
                  <p className="text-[13.5px] text-ink-500 max-w-[300px] leading-relaxed">
                    No moves waiting for review. New submissions land here as sponsors send them.
                  </p>
                </div>
              ) : (
                moves.map(m => (
                  <div key={m.id} className="bg-white border border-[#E8E4F5] rounded-[14px] p-4 mb-3.5 flex gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="bg-purple-100 text-purple-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold">{interestLabel(m.category)}</span>
                        <StatusBadge status={m.status} />
                      </div>
                      <div className="font-display font-extrabold text-[16px] text-ink-900">{m.title}</div>
                      <div className="text-[12.5px] text-ink-500 mt-0.5">
                        {[m.brand, m.areaZip, m.timeText].filter(Boolean).join(' · ')}
                      </div>
                      <div className="text-[13px] text-ink-500 leading-relaxed mt-2">{m.description}</div>
                      <div className="text-[11.5px] text-grey-300 mt-2">
                        {m.sponsorId ? 'Sponsor submission' : 'Mooves authored'}
                        {m.linkUrl ? ` · ${m.linkUrl.replace(/^https?:\/\//, '')}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 justify-center shrink-0">
                      <button disabled={busy} onClick={() => void approve(m.id)} className="bg-green-700 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 disabled:opacity-50">✓ Approve</button>
                      <button disabled={busy} onClick={() => setRejecting(m)} className="bg-white border-[1.5px] border-red-500 text-red-500 font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 disabled:opacity-50">Reject</button>
                      <button onClick={() => startEdit(m)} className="text-purple-700 font-semibold text-[12.5px]">Edit</button>
                    </div>
                  </div>
                ))
              )
            ) : view === 'all' ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-white border border-[#E8E4F5] rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-purple-50">
                      {['Move', 'Category', 'Area', 'Status', 'Impr.', 'Interested', 'Clicks', 'Brought over', ''].map((h, i) => (
                        <th key={i} className={`text-left text-[11px] font-bold uppercase tracking-[0.04em] text-ink-500 px-3.5 py-3 border-b border-[#E8E4F5] ${i >= 4 && i <= 7 ? 'text-right' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {moves.length === 0 ? (
                      <tr><td colSpan={9} className="px-3.5 py-8 text-center text-[13px] text-ink-500">No moves yet. Author one from “New move.”</td></tr>
                    ) : moves.map(m => (
                      <tr key={m.id} className="hover:bg-purple-50">
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px]"><div className="font-bold text-ink-900">{m.title}</div><div className="text-[11.5px] text-ink-500">{m.brand ?? '—'}</div></td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px]"><span className="bg-purple-100 text-purple-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold">{interestLabel(m.category)}</span></td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px] text-ink-900">{m.areaZip}<div className="text-[11.5px] text-ink-500">{m.radiusMiles} mi</div></td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5]"><StatusBadge status={m.status} /></td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px] text-right text-ink-900">{m.status === 'approved' ? m.impressions.toLocaleString() : '—'}</td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px] text-right text-ink-900">{m.status === 'approved' ? m.interestedCount : '—'}</td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px] text-right text-ink-900">{m.status === 'approved' ? m.clicks : '—'}</td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px] text-right text-ink-900">{m.status === 'approved' ? m.broughtOverCount : '—'}</td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-right"><button onClick={() => startEdit(m)} className="text-purple-700 font-semibold text-[12.5px]">{m.status === 'pending' ? 'Review' : 'Edit'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-[11.5px] text-grey-300 mt-3">Aggregate counts only, never tied to a person. Small-N suppressed on anything sponsor-facing.</div>
              </div>
            ) : view === 'new' ? (
              <MoveForm mode="new" submitting={busy} onSubmit={createMove} onCancel={() => setView('queue')} />
            ) : editing ? (
              <>
                {editing.rejectReason && (
                  <div className="text-[12.5px] text-red-500 bg-red-tint rounded-[10px] px-3 py-2.5 mb-4">
                    Previously rejected: {editing.rejectReason}
                  </div>
                )}
                <MoveForm
                  mode="edit"
                  submitting={busy}
                  initial={{
                    title: editing.title,
                    description: editing.description,
                    category: editing.category,
                    brand: editing.brand ?? '',
                    areaZip: editing.areaZip,
                    radiusMiles: String(editing.radiusMiles),
                    linkUrl: editing.linkUrl ?? '',
                    imageUrl: editing.imageUrl ?? '',
                    timeText: editing.timeText ?? '',
                  }}
                  onSubmit={saveEdit}
                  onCancel={() => { setEditing(null); setView(editing.status === 'pending' ? 'queue' : 'all') }}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <RejectModal
        open={rejecting !== null}
        moveTitle={rejecting?.title ?? ''}
        submitting={busy}
        onReject={doReject}
        onCancel={() => setRejecting(null)}
      />
    </div>
  )
}
