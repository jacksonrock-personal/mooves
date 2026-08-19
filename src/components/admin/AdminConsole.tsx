'use client'

// Phase 13 surface 2 — internal admin & moderation console (desktop).
// Mockup: mooves-phase13-admin.html. Author moves + moderate submissions.
//
// R27 — THIS SCREEN IS TWO LISTS NOW, AND THE SPLIT IS THE WHOLE FIX.
//
// It used to be one "Moderation" queue holding everything pending, which was
// honest while everything pending was genuinely blocked on a human. Once the
// seeding routine started filling it at ~25 rows a day, that stopped being true
// in a way the screen could not express: the list grew to 386 cards, 289 of them
// for events that had already happened, sorted newest-ingested-first, with one
// approve button per card. Opening it was a twenty-minute job with no obvious
// end, so it stopped being opened, and because seeded moves could not publish
// without it, all four metros went dark for fifteen days.
//
//   Needs approval — the real gate. Sponsor-authored moves that must not go
//                    live without a person. Blocking, and normally empty.
//   Spot check     — already live, nobody has looked. NOT blocking. Clearing it
//                    is optional, which is what makes it survivable to skip.
//
// Two things follow from that split and both matter more than they look:
//
// · Expired rows are gone from both lists. A card for last Tuesday is not work,
//   it is a reason to close the tab.
// · Both lists are SOONEST FIRST and support bulk. The expected outcome of a
//   spot check is "these are all fine", and a UI that makes the expected
//   outcome expensive is a UI that gets abandoned — which is the actual root
//   cause of the outage this release fixes.

import { useCallback, useEffect, useState } from 'react'
import { interestLabel } from '@/lib/interests'
import CowIllustration from '@/components/ui/CowIllustration'
import MoveForm, { type MoveFormValues } from './MoveForm'
import RejectModal from './RejectModal'
import { movePayloadFields, splitStartAt } from '@/lib/movetime'

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
  startAt: string | null
  locationText: string | null
  status: string
  rejectReason: string | null
  sponsorId: string | null
  reviewedAt: string | null
  origin: string
  sourceUrl: string | null
  neighborhood: string | null
  impressions: number
  clicks: number
  interestedCount: number
  broughtOverCount: number
  createdAt: string
}

type View = 'review' | 'gate' | 'all' | 'new' | 'edit'

/** Lists are sorted by this, so it leads with the day and stays scannable. */
function whenLabel(startAt: string | null): string {
  if (!startAt) return 'No date'
  const d = new Date(startAt)
  if (Number.isNaN(d.getTime())) return 'No date'
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; dot: string; label: string }> = {
    pending: { cls: 'bg-purple-100 text-purple-700', dot: '#5F3FC4', label: 'Pending' },
    approved: { cls: 'bg-green-100 text-green-700', dot: '#167A43', label: 'Live' },
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
  const [view, setView] = useState<View>('review')
  const [moves, setMoves] = useState<AdminMove[]>([])
  const [gateCount, setGateCount] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState<AdminMove | null>(null)
  // Non-null with an empty id set = a BULK pull awaiting its reason.
  const [bulkPulling, setBulkPulling] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<AdminMove | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isList = view === 'review' || view === 'gate' || view === 'all'

  const load = useCallback(async (v: View) => {
    const data = (await fetch(`/api/admin/moves?view=${v}`).then(r => r.json())) as {
      moves: AdminMove[]
      gateCount: number
      reviewCount: number
    }
    setMoves(data.moves ?? [])
    setGateCount(data.gateCount ?? 0)
    setReviewCount(data.reviewCount ?? 0)
    // Selection is per-list; carrying it across views would let a bulk pull hit
    // rows the person can no longer see.
    setSelected(new Set())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (view === 'review' || view === 'gate' || view === 'all') void load(view)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const currentList: View = view === 'edit' || view === 'new' ? 'review' : view

  async function patchOne(id: string, payload: Record<string, unknown>) {
    setBusy(true)
    try {
      await fetch(`/api/admin/moves/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await load(currentList)
    } finally {
      setBusy(false)
    }
  }

  async function patchBulk(action: 'reviewed' | 'pull', rejectReason?: string) {
    if (selected.size === 0) return
    setBusy(true)
    try {
      await fetch('/api/admin/moves', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected], action, rejectReason }),
      })
      await load(currentList)
    } finally {
      setBusy(false)
    }
  }

  async function doReject(reason: string) {
    if (bulkPulling) {
      await patchBulk('pull', reason)
      setBulkPulling(false)
      return
    }
    if (!rejecting) return
    // A pending move is rejected before anyone saw it; a live one is pulled off
    // the feed. Same row shape, different event, so the API keeps them apart.
    const action = rejecting.status === 'approved' ? 'pull' : 'reject'
    await patchOne(rejecting.id, { action, rejectReason: reason })
    setRejecting(null)
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev => (prev.size === moves.length ? new Set() : new Set(moves.map(m => m.id))))
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
          ...movePayloadFields(values),
          publish,
        }),
      })
      if (!res.ok) throw new Error('create failed')
      setView(publish ? 'all' : 'gate')
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
          ...movePayloadFields(values),
        }),
      })
      if (!res.ok) throw new Error('save failed')
      const back: View = editing.status === 'pending' ? 'gate' : 'review'
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
    review: {
      title: 'Spot check',
      sub: `${reviewCount} live ${reviewCount === 1 ? 'move' : 'moves'} nobody has looked at yet — nothing is blocked on this`,
    },
    gate: {
      title: 'Needs approval',
      sub: `${gateCount} ${gateCount === 1 ? 'move' : 'moves'} waiting to go live`,
    },
    all: { title: 'All moves', sub: 'Every sponsored move and its status' },
    new: { title: 'New move', sub: 'Author a move directly (concierge seeding)' },
    edit: { title: 'Edit move', sub: editing?.title ?? '' },
  }

  const navItem = (v: View, label: string, icon: React.ReactNode, count?: number) => (
    <button
      onClick={() => setView(v)}
      className={`flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-[10px] text-[13.5px] font-semibold ${
        view === v ? 'bg-purple-100 text-purple-700' : 'text-ink-500 hover:bg-purple-50'
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
            {navItem('gate', 'Needs approval',
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
              gateCount)}
            {navItem('review', 'Spot check',
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /></svg>,
              reviewCount)}
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
            {isList && (
              <button onClick={() => setView('new')} className="bg-purple-500 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5">
                + New move
              </button>
            )}
          </div>

          {/* Bulk bar. Only where a list has selectable rows. */}
          {(view === 'review' || view === 'gate') && moves.length > 0 && (
            <div className="px-6 py-2.5 bg-white border-b border-[#E8E4F5] flex items-center gap-3">
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size === moves.length && moves.length > 0}
                  onChange={toggleAll}
                  className="w-4 h-4 accent-[#7C5CDB]"
                />
                Select all {moves.length}
              </label>
              {selected.size > 0 && (
                <>
                  <span className="text-[12.5px] text-grey-300">{selected.size} selected</span>
                  <div className="ml-auto flex items-center gap-2">
                    {view === 'review' && (
                      <button
                        disabled={busy}
                        onClick={() => void patchBulk('reviewed')}
                        className="bg-green-700 text-white font-semibold text-[13px] rounded-[10px] px-3.5 py-2 disabled:opacity-50"
                      >
                        ✓ Looks good
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => setBulkPulling(true)}
                      className="bg-white border-[1.5px] border-red-500 text-red-500 font-semibold text-[13px] rounded-[10px] px-3.5 py-2 disabled:opacity-50"
                    >
                      {view === 'review' ? 'Pull from feed' : 'Reject'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error && <div className="text-[13px] text-red-500 mb-3">{error}</div>}

            {loading && isList ? (
              <div className="flex justify-center pt-16">
                <div className="w-7 h-7 rounded-full border-[3px] border-purple-100 border-t-purple-500 animate-spin" />
              </div>
            ) : view === 'review' || view === 'gate' ? (
              moves.length === 0 ? (
                <div className="flex flex-col items-center text-center pt-14">
                  <CowIllustration size={88} className="mb-4 opacity-90" />
                  <h3 className="font-display font-extrabold text-[19px] text-ink-900 mb-1.5">
                    {view === 'gate' ? 'Nothing is blocked' : "You're all caught up"}
                  </h3>
                  <p className="text-[13.5px] text-ink-500 max-w-[320px] leading-relaxed">
                    {view === 'gate'
                      ? 'No moves are waiting to go live. Sponsor submissions land here; community moves publish on their own.'
                      : 'Every live community move has been looked at. New ones appear here as the seeding routine finds them.'}
                  </p>
                </div>
              ) : (
                moves.map(m => (
                  <div key={m.id} className="bg-white border border-[#E8E4F5] rounded-[14px] p-4 mb-3.5 flex gap-4">
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggle(m.id)}
                        className="w-4 h-4 accent-[#7C5CDB]"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="bg-purple-100 text-purple-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold">{interestLabel(m.category)}</span>
                        <StatusBadge status={m.status} />
                        <span className="text-[11.5px] font-bold text-ink-900">{whenLabel(m.startAt)}</span>
                      </div>
                      <div className="font-display font-extrabold text-[16px] text-ink-900">{m.title}</div>
                      <div className="text-[12.5px] text-ink-500 mt-0.5">
                        {[m.locationText, m.neighborhood].filter(Boolean).join(' · ')}
                      </div>
                      <div className="text-[13px] text-ink-500 leading-relaxed mt-2">{m.description}</div>
                      <div className="text-[11.5px] text-grey-300 mt-2">
                        {m.sponsorId ? 'Sponsor submission' : m.origin === 'seeded' ? 'Found by the seeding routine' : 'Mooves authored'}
                        {' · '}
                        {m.areaZip}
                        {/* The source link is the whole review. Everything else on
                            this card came from the same model that wrote it. */}
                        {m.sourceUrl && (
                          <>
                            {' · '}
                            <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="text-purple-700 font-semibold underline">
                              source
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 justify-center shrink-0">
                      {view === 'gate' ? (
                        <button disabled={busy} onClick={() => void patchOne(m.id, { action: 'approve' })} className="bg-green-700 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 disabled:opacity-50">✓ Approve</button>
                      ) : (
                        <button disabled={busy} onClick={() => void patchOne(m.id, { action: 'reviewed' })} className="bg-green-700 text-white font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 disabled:opacity-50">✓ Looks good</button>
                      )}
                      <button disabled={busy} onClick={() => setRejecting(m)} className="bg-white border-[1.5px] border-red-500 text-red-500 font-semibold text-[13.5px] rounded-[10px] px-4 py-2.5 disabled:opacity-50">
                        {view === 'review' ? 'Pull' : 'Reject'}
                      </button>
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
                      {['Move', 'Category', 'Area', 'Status', 'Checked', 'Impr.', 'Interested', 'Clicks', ''].map((h, i) => (
                        <th key={i} className={`text-left text-[11px] font-bold uppercase tracking-[0.04em] text-ink-500 px-3.5 py-3 border-b border-[#E8E4F5] ${i >= 5 && i <= 7 ? 'text-right' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {moves.length === 0 ? (
                      <tr><td colSpan={9} className="px-3.5 py-8 text-center text-[13px] text-ink-500">No moves yet. Author one from “New move.”</td></tr>
                    ) : moves.map(m => (
                      <tr key={m.id} className="hover:bg-purple-50">
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px]"><div className="font-bold text-ink-900">{m.title}</div><div className="text-[11.5px] text-ink-500">{whenLabel(m.startAt)}</div></td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px]"><span className="bg-purple-100 text-purple-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold">{interestLabel(m.category)}</span></td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px] text-ink-900">{m.areaZip}<div className="text-[11.5px] text-ink-500">{m.radiusMiles} mi</div></td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5]"><StatusBadge status={m.status} /></td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px] text-ink-500">{m.reviewedAt ? '✓' : '—'}</td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px] text-right text-ink-900">{m.status === 'approved' ? m.impressions.toLocaleString() : '—'}</td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px] text-right text-ink-900">{m.status === 'approved' ? m.interestedCount : '—'}</td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-[13px] text-right text-ink-900">{m.status === 'approved' ? m.clicks : '—'}</td>
                        <td className="px-3.5 py-3 border-b border-[#E8E4F5] text-right"><button onClick={() => startEdit(m)} className="text-purple-700 font-semibold text-[12.5px]">{m.status === 'pending' ? 'Review' : 'Edit'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-[11.5px] text-grey-300 mt-3">Aggregate counts only, never tied to a person. Small-N suppressed on anything sponsor-facing.</div>
              </div>
            ) : view === 'new' ? (
              <MoveForm mode="new" submitting={busy} onSubmit={createMove} onCancel={() => setView('gate')} />
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
                    startDate: splitStartAt(editing.startAt).date,
                    startTime: splitStartAt(editing.startAt).time,
                    locationText: editing.locationText ?? '',
                  }}
                  onSubmit={saveEdit}
                  onCancel={() => { setEditing(null); setView(editing.status === 'pending' ? 'gate' : 'review') }}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <RejectModal
        open={rejecting !== null || bulkPulling}
        moveTitle={bulkPulling ? `${selected.size} selected moves` : rejecting?.title ?? ''}
        submitting={busy}
        onReject={doReject}
        onCancel={() => { setRejecting(null); setBulkPulling(false) }}
      />
    </div>
  )
}
