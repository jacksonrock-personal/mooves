'use client'

// Phase 21 — comments on a Moove.
//
// Rendered ONLY through WhosIn's footer slot, from PlanCard, so it inherits the
// single disclosure: one arrow opens who is going, then what they said about
// getting there. There is no second expand control on the card and there is no
// comment count anywhere, for anyone.
//
// Loads when the disclosure opens and on focus. NOT realtime, deliberately —
// live appearing messages are what make a surface feel like chat, and the whole
// point of the amendment is that this is logistics, not chat.

import { useCallback, useEffect, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import { posthog } from '@/lib/posthog'
import {
  COMMENT_MAX,
  COMMENT_COUNTER_AT,
  commentTime,
  type PlanComment,
} from '@/lib/comments'

interface PlanCommentsProps {
  planId: string
  meId: string
  /** The Moove's author can remove anyone's comment on their own Moove. */
  isHost: boolean
}

/** A comment that has been written but not yet confirmed by the server. */
interface Pending {
  key: string
  body: string
  failed: boolean
}

export default function PlanComments({ planId, meId, isHost }: PlanCommentsProps) {
  const [comments, setComments] = useState<PlanComment[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [acting, setActing] = useState<PlanComment | null>(null)
  const [editing, setEditing] = useState<PlanComment | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/plans/${planId}/comments`)
      if (!res.ok) {
        setError(true)
        return
      }
      const data = (await res.json()) as { comments: PlanComment[] }
      setComments(data.comments)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [planId])

  // On open, and again on focus — the two moments the spec allows.
  useEffect(() => {
    void load()
    posthog.capture('moove_comment_area_viewed')
    function onFocus() {
      void load()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  async function send(body: string, key: string) {
    try {
      const res = await fetch(`/api/plans/${planId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error('failed')
      posthog.capture('moove_comment_posted')
      setPending(p => p.filter(x => x.key !== key))
      await load()
    } catch {
      // The text is never thrown away, so a retry costs nothing.
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

  function retry(item: Pending) {
    setPending(p => p.map(x => (x.key === item.key ? { ...x, failed: false } : x)))
    void send(item.body, item.key)
  }

  async function saveEdit() {
    if (!editing) return
    const body = editDraft.trim()
    if (!body || body.length > COMMENT_MAX) return
    const id = editing.id
    setEditing(null)
    try {
      const res = await fetch(`/api/plans/${planId}/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.ok) {
        posthog.capture('moove_comment_edited')
        await load()
      }
    } catch {
      // Leave the list as it was; the next load reconciles.
    }
  }

  async function remove(comment: PlanComment) {
    const mine = comment.authorId === meId
    setActing(null)
    try {
      const res = await fetch(`/api/plans/${planId}/comments/${comment.id}`, { method: 'DELETE' })
      if (res.ok) {
        posthog.capture(mine ? 'moove_comment_deleted' : 'moove_comment_removed_by_host')
        setComments(c => c.filter(x => x.id !== comment.id))
      }
    } catch {
      // Leave the list as it was; the next load reconciles.
    }
  }

  const remaining = COMMENT_MAX - draft.length
  const nothingYet = !loading && comments.length === 0 && pending.length === 0

  return (
    <div className="mt-3 pt-2.5 border-t border-grey-100">
      {/* The label appears only when there is something under it. With nothing
          written the section is the field alone — no explanatory copy, no
          empty-state line, nothing that reads as a nudge to post. */}
      {!nothingYet && !loading && (
        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-grey-300 mb-1">
          Comments
        </p>
      )}

      {loading && (
        <p className="font-sans text-[12px] text-grey-300 py-1">Loading</p>
      )}

      {error && !loading && (
        <button
          onClick={() => void load()}
          className="font-sans text-[12px] text-mooves-purple font-semibold py-1"
        >
          Couldn&apos;t load comments. Try again
        </button>
      )}

      {comments.map(c => {
        const mine = c.authorId === meId
        return (
          <div key={c.id} className="flex gap-2 py-1.5 items-start">
            <Avatar
              src={c.authorAvatar}
              name={c.authorName ?? '?'}
              size={24}
              className="shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`font-sans text-[12px] font-bold ${
                    mine ? 'text-purple-700' : 'text-ink-900'
                  }`}
                >
                  {mine ? 'You' : (c.authorName ?? 'Someone')}
                </span>
                <span className="font-sans text-[10.5px] text-grey-300">
                  {commentTime(c.createdAt)}
                </span>
                {c.editedAt && (
                  <span className="font-sans text-[10.5px] italic text-grey-300">edited</span>
                )}
              </div>
              <p className="font-sans text-[13px] leading-snug text-ink-900 break-words">
                {c.body}
              </p>
            </div>

            {/* Visible control, never a long press. Yours on your own comment,
                and on every comment of a Moove you host. */}
            {(mine || isHost) && (
              <button
                onClick={() => setActing(c)}
                aria-label={mine ? 'Comment options' : 'Remove comment'}
                className="shrink-0 w-6 h-6 rounded-full text-grey-300 flex items-center justify-center mt-0.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
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
        <div key={p.key} className={`flex gap-2 py-1.5 items-start ${p.failed ? '' : 'opacity-45'}`}>
          <div className="w-6 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-sans text-[12px] font-bold text-purple-700">You</span>
            <p className="font-sans text-[13px] leading-snug text-ink-900 break-words">{p.body}</p>
            {p.failed ? (
              <p className="font-sans text-[10.5px] font-semibold text-[#E8405A] mt-0.5">
                Didn&apos;t send
                <button
                  onClick={() => retry(p)}
                  className="ml-1.5 font-bold text-mooves-purple"
                >
                  Try again
                </button>
              </p>
            ) : (
              <p className="font-sans text-[10.5px] font-semibold text-ink-500 mt-0.5">Sending</p>
            )}
          </div>
        </div>
      ))}

      <div className="flex gap-2 items-end mt-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value.slice(0, COMMENT_MAX))}
          placeholder="Add a comment"
          rows={1}
          className="flex-1 min-h-[38px] max-h-32 rounded-xl border-[1.5px] border-[#E8E4F5] bg-surface-bg px-3 py-2 font-sans text-[13.5px] leading-snug text-ink-900 placeholder:text-grey-300 focus:border-purple-500 focus:bg-card-white focus:outline-none resize-none"
        />
        <button
          onClick={handleSend}
          disabled={draft.trim().length === 0}
          aria-label="Post comment"
          className={`shrink-0 w-[34px] h-[34px] rounded-full flex items-center justify-center ${
            draft.trim().length === 0 ? 'bg-grey-300' : 'bg-purple-500'
          }`}
        >
          <svg
            width="15"
            height="15"
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

      {/* Counts DOWN, and only near the end. A number that watches you type is
          its own small pressure, and one counting up would read as a score. */}
      {remaining <= COMMENT_COUNTER_AT && (
        <p className="text-right font-sans text-[10.5px] font-semibold text-ink-500 mt-1.5">
          {remaining} left
        </p>
      )}

      {acting && (
        <>
          <div
            className="fixed inset-0 bg-text-primary/50 z-40"
            onClick={() => setActing(null)}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 px-2 [--safe-pb-base:1.625rem] flex flex-col gap-2 safe-area-pb">
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
            className="fixed inset-0 bg-text-primary/50 z-40"
            onClick={() => setEditing(null)}
            aria-hidden="true"
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-card-white rounded-t-3xl px-5 pt-3 [--safe-pb-base:1.875rem] safe-area-pb"
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
    </div>
  )
}
