'use client'

// Phase 21, second revision — the Moove sheet: who's in, and comments.
//
// Replaces the inline disclosure that shipped first. That version hid comments
// behind the same ▾ chevron as the roster, and a down chevron promises "this
// card grows" — so nobody could tell comments were in there at all.
//
// Two panes behind a segmented control, Venmo's anatomy: the thing you are
// commenting on restated at the top, a divider, the list, and the compose pill
// pinned to the bottom. Only the Comments pane has the pill, so the two panes
// never read as one screen with its contents swapped.
//
// WALL 3 — a viewer who has not joined never gets here with `canComment`, so
// the segmented control is not rendered at all. Not disabled, not hidden:
// absent. A greyed-out "Comments" tab would be the loudest hint in the app.
//
// Still NOT realtime. Loads when the sheet opens and on focus.

import { useCallback, useEffect, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import { posthog } from '@/lib/posthog'
import { planWhenLine, type Plan } from '@/lib/plans'
import {
  COMMENT_MAX,
  COMMENT_COUNTER_AT,
  commentTime,
  type PlanComment,
} from '@/lib/comments'

export type MoovePane = 'who' | 'comments'

interface MooveSheetProps {
  plan: Plan
  meId: string
  /** Which pane to land on — the card has a separate tap target for each. */
  initialPane: MoovePane
  onClose: () => void
  onJoin: () => void
  /** Bubble the new total up so the card's count stays honest without a refetch. */
  onCountChange: (planId: string, count: number) => void
}

interface Pending {
  key: string
  body: string
  failed: boolean
}

export default function MooveSheet({
  plan,
  meId,
  initialPane,
  onClose,
  onJoin,
  onCountChange,
}: MooveSheetProps) {
  // The author always has access, whether or not they are "in" their own Moove.
  const canComment = plan.isMine || plan.joinedByMe

  const [pane, setPane] = useState<MoovePane>(canComment ? initialPane : 'who')
  const [comments, setComments] = useState<PlanComment[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [acting, setActing] = useState<PlanComment | null>(null)
  const [editing, setEditing] = useState<PlanComment | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const load = useCallback(async () => {
    if (!canComment) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/plans/${plan.id}/comments`)
      if (!res.ok) {
        setError(true)
        return
      }
      const data = (await res.json()) as { comments: PlanComment[] }
      setComments(data.comments)
      onCountChange(plan.id, data.comments.length)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [plan.id, canComment, onCountChange])

  useEffect(() => {
    void load()
    posthog.capture('moove_sheet_opened', { pane: initialPane })
    function onFocus() {
      void load()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load, initialPane])

  async function send(body: string, key: string) {
    try {
      const res = await fetch(`/api/plans/${plan.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error('failed')
      posthog.capture('moove_comment_posted')
      setPending(p => p.filter(x => x.key !== key))
      await load()
    } catch {
      setPending(p => p.map(x => (x.key === key ? { ...x, failed: true } : x)))
    }
  }

  function handleSend() {
    const body = draft.trim()
    if (!body || body.length > COMMENT_MAX) return
    const key = `${Date.now()}-${Math.random()}`
    setPending(p => [...p, { key, body, failed: false }])
    setDraft('')
    void send(body, key)
  }

  async function saveEdit() {
    if (!editing) return
    const body = editDraft.trim()
    if (!body || body.length > COMMENT_MAX) return
    const id = editing.id
    setEditing(null)
    try {
      const res = await fetch(`/api/plans/${plan.id}/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.ok) {
        posthog.capture('moove_comment_edited')
        await load()
      }
    } catch {
      // next load reconciles
    }
  }

  async function remove(comment: PlanComment) {
    const mine = comment.authorId === meId
    setActing(null)
    try {
      const res = await fetch(`/api/plans/${plan.id}/comments/${comment.id}`, { method: 'DELETE' })
      if (res.ok) {
        posthog.capture(mine ? 'moove_comment_deleted' : 'moove_comment_removed_by_host')
        setComments(c => {
          const next = c.filter(x => x.id !== comment.id)
          onCountChange(plan.id, next.length)
          return next
        })
      }
    } catch {
      // next load reconciles
    }
  }

  const remaining = COMMENT_MAX - draft.length
  const roster = plan.isMine
    ? [{ id: plan.authorId, displayName: plan.authorName, avatarUrl: plan.authorAvatar }, ...plan.joiners]
    : [
        { id: plan.authorId, displayName: plan.authorName, avatarUrl: plan.authorAvatar },
        ...plan.joiners,
      ]

  return (
    <>
      <div className="fixed inset-0 bg-text-primary/45 z-40" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card-white rounded-t-[22px] flex flex-col max-h-[86%] h-[76%]"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-11 h-[5px] rounded-full bg-[#DDD8EC] mx-auto mt-2.5 shrink-0" />

        {/* The Moove, restated. Shared by both panes so switching never loses
            track of what you are looking at. */}
        <div className="px-[18px] pt-4 pb-3.5 shrink-0">
          <div className="flex mb-3">
            {[{ id: plan.authorId, name: plan.authorName, url: plan.authorAvatar }, ...plan.joiners.slice(0, 2).map(j => ({ id: j.id, name: j.displayName, url: j.avatarUrl }))].map(
              (p, i) => (
                <Avatar
                  key={p.id}
                  src={p.url}
                  name={p.name ?? '?'}
                  size={44}
                  className={`ring-[2.5px] ring-white ${i > 0 ? '-ml-3.5' : ''}`}
                />
              ),
            )}
          </div>
          <p className="font-sans text-[16px] leading-snug text-ink-900">
            <span className="font-bold">{plan.isMine ? 'You' : (plan.authorName ?? 'A friend')}</span>
            <span className="text-ink-500"> {plan.isMine ? 'are doing' : 'is doing'} </span>
            <span className="font-bold">{plan.title}</span>
          </p>
          <p className="font-sans text-[13px] text-ink-500 mt-1.5">
            {planWhenLine(new Date(plan.startAt), plan.hasTime, plan.locationText, new Date(), plan.timeMode)}
          </p>
        </div>

        {/* Wall 3: no tabs at all for someone who has not joined. */}
        {canComment && (
          <div className="mx-[18px] flex gap-1 bg-grey-100 rounded-full p-[3px] shrink-0">
            {(['who', 'comments'] as MoovePane[]).map(p => (
              <button
                key={p}
                onClick={() => setPane(p)}
                aria-pressed={pane === p}
                className={`flex-1 py-2 rounded-full font-sans text-[12.5px] font-bold ${
                  pane === p ? 'bg-card-white text-ink-900 shadow-sm' : 'text-ink-500'
                }`}
              >
                {p === 'who' ? "Who's in" : 'Comments'}
                {p === 'who' && <span className="font-bold opacity-55 ml-1">{roster.length}</span>}
                {p === 'comments' && comments.length > 0 && (
                  <span className="font-bold opacity-55 ml-1">{comments.length}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="h-px bg-[#E8E4F5] mx-[18px] mt-3.5 shrink-0" />

        <div className="flex-1 overflow-y-auto px-[18px] pt-3 pb-1.5">
          {pane === 'who' && (
            <ul>
              {roster.map(p => (
                <li key={p.id} className="flex items-center gap-3 py-1.5">
                  <Avatar src={p.avatarUrl} name={p.displayName ?? '?'} size={34} className="shrink-0" />
                  <span className="flex-1 min-w-0 font-sans text-[15px] text-ink-900 truncate">
                    {p.id === meId ? 'You' : (p.displayName ?? 'Someone')}
                  </span>
                  {p.id === plan.authorId && (
                    <span className="shrink-0 font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-ink-500">
                      Host
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {pane === 'comments' && (
            <>
              {loading && <p className="font-sans text-[13px] text-grey-300 py-2">Loading</p>}

              {error && !loading && (
                <button
                  onClick={() => void load()}
                  className="font-sans text-[13px] text-mooves-purple font-semibold py-2"
                >
                  Couldn&apos;t load comments. Try again
                </button>
              )}

              {!loading && !error && comments.length === 0 && pending.length === 0 && (
                <div className="flex items-center justify-center h-full pb-10">
                  <p className="font-sans text-[13.5px] text-grey-300">No comments yet.</p>
                </div>
              )}

              {comments.map(c => {
                const mine = c.authorId === meId
                return (
                  <div key={c.id} className="flex gap-2.5 py-2 items-start">
                    <Avatar
                      src={c.authorAvatar}
                      name={c.authorName ?? '?'}
                      size={32}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={`font-sans text-[13.5px] font-bold ${
                            mine ? 'text-purple-700' : 'text-ink-900'
                          }`}
                        >
                          {mine ? 'You' : (c.authorName ?? 'Someone')}
                        </span>
                        <span className="font-sans text-[11.5px] text-grey-300">
                          {commentTime(c.createdAt)}
                        </span>
                        {c.editedAt && (
                          <span className="font-sans text-[11.5px] italic text-grey-300">edited</span>
                        )}
                      </div>
                      <p className="font-sans text-[14px] leading-relaxed text-ink-900 break-words">
                        {c.body}
                      </p>
                    </div>
                    {(mine || plan.isMine) && (
                      <button
                        onClick={() => setActing(c)}
                        aria-label={mine ? 'Comment options' : 'Remove comment'}
                        className="shrink-0 w-[26px] h-[26px] rounded-full text-grey-300 flex items-center justify-center mt-0.5"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="5" cy="12" r="1.8" />
                          <circle cx="12" cy="12" r="1.8" />
                          <circle cx="19" cy="12" r="1.8" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}

              {pending.map(p => (
                <div
                  key={p.key}
                  className={`flex gap-2.5 py-2 items-start ${p.failed ? '' : 'opacity-45'}`}
                >
                  <div className="w-8 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-sans text-[13.5px] font-bold text-purple-700">You</span>
                    <p className="font-sans text-[14px] leading-relaxed text-ink-900 break-words">
                      {p.body}
                    </p>
                    {p.failed ? (
                      <p className="font-sans text-[11.5px] font-semibold text-[#E8405A] mt-0.5">
                        Didn&apos;t send
                        <button
                          onClick={() => {
                            setPending(x => x.map(y => (y.key === p.key ? { ...y, failed: false } : y)))
                            void send(p.body, p.key)
                          }}
                          className="ml-1.5 font-bold text-mooves-purple"
                        >
                          Try again
                        </button>
                      </p>
                    ) : (
                      <p className="font-sans text-[11.5px] font-semibold text-ink-500 mt-0.5">
                        Sending
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Compose lives ONLY on the comments pane. */}
        {pane === 'comments' && canComment && (
          <>
            <div className="shrink-0 px-4 pt-2.5 pb-[18px] flex gap-2.5 items-end bg-card-white">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value.slice(0, COMMENT_MAX))}
                placeholder="Add a comment"
                rows={1}
                className={`flex-1 min-h-[44px] max-h-36 bg-grey-100 px-[17px] py-3 font-sans text-[14.5px] leading-snug text-ink-900 placeholder:text-grey-300 focus:outline-none focus:bg-card-white resize-none ${
                  draft.length > 0
                    ? 'rounded-[22px] ring-[1.5px] ring-purple-500'
                    : 'rounded-full'
                }`}
              />
              <button
                onClick={handleSend}
                disabled={draft.trim().length === 0}
                aria-label="Post comment"
                className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  draft.trim().length === 0 ? 'bg-grey-300' : 'bg-purple-500'
                }`}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
            {remaining <= COMMENT_COUNTER_AT && (
              <p className="shrink-0 text-right font-sans text-[10.5px] font-semibold text-ink-500 px-[18px] pb-2">
                {remaining} left
              </p>
            )}
          </>
        )}

        {/* A non-joiner gets the way in, not a locked door. */}
        {!canComment && (
          <div className="shrink-0 px-4 pt-2 pb-5">
            <button
              onClick={onJoin}
              className="w-full py-3.5 rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[15px]"
            >
              I&apos;m in
            </button>
          </div>
        )}
      </div>

      {acting && (
        <>
          <div
            className="fixed inset-0 bg-text-primary/50 z-[60]"
            onClick={() => setActing(null)}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 left-0 right-0 z-[61] px-2 [--safe-pb-base:1.625rem] flex flex-col gap-2 safe-area-pb">
            <div className="rounded-2xl overflow-hidden border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl">
              <p className="font-sans text-[12px] font-medium text-text-secondary text-center px-4 pt-3 pb-2 border-b border-[#E8E4F5] leading-snug">
                {acting.authorId === meId
                  ? `Your comment, “${acting.body}”`
                  : `${acting.authorName ?? 'Their'} comment on your Moove`}
              </p>
              {acting.authorId === meId && (
                <button
                  onClick={() => {
                    setEditing(acting)
                    setEditDraft(acting.body)
                    setActing(null)
                  }}
                  className="w-full py-4 font-sans text-[17px] font-semibold text-mooves-purple"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => void remove(acting)}
                className="w-full py-4 font-sans text-[17px] font-semibold text-[#E8405A] border-t border-[#E8E4F5]"
              >
                {acting.authorId === meId ? 'Delete' : 'Remove comment'}
              </button>
            </div>
            <button
              onClick={() => setActing(null)}
              className="w-full py-4 rounded-2xl border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl font-sans text-[17px] font-bold text-text-primary"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {editing && (
        <>
          <div
            className="fixed inset-0 bg-text-primary/50 z-[60]"
            onClick={() => setEditing(null)}
            aria-hidden="true"
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[61] bg-card-white rounded-t-3xl px-5 pt-3 [--safe-pb-base:1.875rem] safe-area-pb"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-9 h-1 rounded-full bg-[#E8E4F5] mx-auto mb-4" />
            <h2 className="font-display font-extrabold text-[18px] text-text-primary tracking-tight mb-3">
              Edit your comment
            </h2>
            <textarea
              value={editDraft}
              onChange={e => setEditDraft(e.target.value.slice(0, COMMENT_MAX))}
              rows={3}
              className="w-full rounded-xl border-[1.5px] border-[#E8E4F5] bg-surface-bg px-3 py-2 font-sans text-[14px] leading-snug text-ink-900 focus:border-purple-500 focus:bg-card-white focus:outline-none resize-none mb-4"
            />
            <button
              onClick={() => void saveEdit()}
              disabled={editDraft.trim().length === 0}
              className="w-full py-3.5 rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[15px] mb-2 disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(null)}
              className="w-full py-3.5 rounded-2xl bg-surface-bg text-text-secondary font-sans font-semibold text-[15px]"
            >
              Never mind
            </button>
          </div>
        </>
      )}
    </>
  )
}
