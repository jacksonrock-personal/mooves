'use client'

// R36 — comments under a photo in the album viewer.
//
// A mirror of MooveSheet's Comments pane (Phase 21 + R8), kept as its own
// component rather than refactoring the shipped one: same rows, same heart (a
// zero renders no number), same "···" for your own or — as the Moove's
// creator — anyone's, same pending/"Didn't send" state, same compose pill and
// count-DOWN counter at 50 left, same 500 cap.
//
// Two deliberate differences, both from the spec:
//   • ⚠ wall 4 is amended for photo comments only — they live as long as the
//     photo, so there is no expiry here;
//   • the mention picker is the ROSTER ONLY (R8). R11's "friends who can see
//     this" does not apply: an album is only for the people who were there,
//     and a tag cannot point an outsider at something they cannot open.
//
// Not realtime. Loads when the photo is shown and on focus.

import { useCallback, useEffect, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import { posthog } from '@/lib/posthog'
import {
  COMMENT_MAX,
  COMMENT_COUNTER_AT,
  commentTime,
  splitMentions,
  type PlanComment,
} from '@/lib/comments'
import type { AlbumPerson } from '@/lib/photos'

interface PhotoCommentsProps {
  planId: string
  photoId: string
  meId: string
  /** The Moove's creator may remove any comment, never edit one. */
  isCreator: boolean
  authorId: string
  roster: AlbumPerson[]
}

interface Pending {
  key: string
  body: string
  failed: boolean
}

export default function PhotoComments({
  planId,
  photoId,
  meId,
  isCreator,
  authorId,
  roster,
}: PhotoCommentsProps) {
  const [comments, setComments] = useState<PlanComment[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [acting, setActing] = useState<PlanComment | null>(null)
  const [editing, setEditing] = useState<PlanComment | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)

  const base = `/api/plans/${planId}/photos/${photoId}/comments`

  const load = useCallback(async () => {
    try {
      const res = await fetch(base)
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
  }, [base])

  // A new photo is a new thread: reset everything that belonged to the last.
  useEffect(() => {
    setComments([])
    setPending([])
    setLoading(true)
    setError(false)
    setActing(null)
    setEditing(null)
    void load()
    function onFocus() {
      void load()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  async function toggleLike(comment: PlanComment) {
    const liking = !comment.likedByMe
    setComments(cs =>
      cs.map(c =>
        c.id === comment.id
          ? { ...c, likedByMe: liking, likeCount: c.likeCount + (liking ? 1 : -1) }
          : c,
      ),
    )
    posthog.capture(liking ? 'album_photo_comment_liked' : 'album_photo_comment_unliked')
    try {
      const res = await fetch(`${base}/${comment.id}/like`, { method: liking ? 'POST' : 'DELETE' })
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as { likeCount: number; likedByMe: boolean }
      setComments(cs =>
        cs.map(c =>
          c.id === comment.id ? { ...c, likedByMe: data.likedByMe, likeCount: data.likeCount } : c,
        ),
      )
    } catch {
      setComments(cs =>
        cs.map(c =>
          c.id === comment.id
            ? { ...c, likedByMe: comment.likedByMe, likeCount: comment.likeCount }
            : c,
        ),
      )
    }
  }

  function mentionedIds(body: string): string[] {
    return roster.filter(r => r.displayName && body.includes(`@${r.displayName}`)).map(r => r.id)
  }

  async function send(body: string, key: string) {
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, mentions: mentionedIds(body) }),
      })
      if (!res.ok) throw new Error('failed')
      posthog.capture('album_photo_comment_posted')
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
    setMentionQuery(null)
    void send(body, key)
  }

  async function saveEdit() {
    if (!editing) return
    const body = editDraft.trim()
    if (!body || body.length > COMMENT_MAX) return
    const id = editing.id
    setEditing(null)
    try {
      const res = await fetch(`${base}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.ok) {
        posthog.capture('album_photo_comment_edited')
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
      const res = await fetch(`${base}/${comment.id}`, { method: 'DELETE' })
      if (res.ok) {
        posthog.capture(mine ? 'album_photo_comment_deleted' : 'album_photo_comment_removed_by_creator')
        setComments(c => c.filter(x => x.id !== comment.id))
      }
    } catch {
      // next load reconciles
    }
  }

  function onDraftChange(value: string) {
    setDraft(value)
    const at = value.lastIndexOf('@')
    if (at === -1) {
      setMentionQuery(null)
      return
    }
    const frag = value.slice(at + 1)
    setMentionQuery(frag.length <= 24 && !frag.includes('\n') ? frag : null)
  }

  function applyMention(name: string) {
    const at = draft.lastIndexOf('@')
    if (at === -1) return
    setDraft(`${draft.slice(0, at)}@${name} `)
    setMentionQuery(null)
    posthog.capture('comment_mention_added', { surface: 'album' })
  }

  const remaining = COMMENT_MAX - draft.length

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto px-[18px] pt-1.5 pb-1.5">
        {loading && <p className="font-sans text-[13px] text-grey-300 py-2">Loading</p>}

        {error && !loading && (
          <button
            onClick={() => void load()}
            className="font-sans text-[13px] text-purple-500 font-semibold py-2"
          >
            Couldn&apos;t load comments. Try again
          </button>
        )}

        {!loading && !error && comments.length === 0 && pending.length === 0 && (
          <p className="font-sans text-[13.5px] text-grey-300 py-4 text-center">No comments yet.</p>
        )}

        {comments.map(c => {
          const mine = c.authorId === meId
          return (
            <div key={c.id} className="flex gap-2.5 py-2 items-start">
              <Avatar src={c.authorAvatar} name={c.authorName ?? '?'} size={32} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`font-sans text-[13.5px] font-bold ${mine ? 'text-purple-700' : 'text-ink-900'}`}
                  >
                    {mine ? 'You' : (c.authorName ?? 'Someone')}
                  </span>
                  <span className="font-sans text-[11.5px] text-grey-300">{commentTime(c.createdAt)}</span>
                  {c.editedAt && (
                    <span className="font-sans text-[11.5px] italic text-grey-300">edited</span>
                  )}
                </div>
                <p className="font-sans text-[14px] leading-relaxed text-ink-900 break-words">
                  {splitMentions(c.body, roster).map((run, i) =>
                    run.mention ? (
                      <span key={i} className="font-bold text-purple-700">
                        {run.text}
                      </span>
                    ) : (
                      <span key={i}>{run.text}</span>
                    ),
                  )}
                </p>
              </div>
              <button
                onClick={() => void toggleLike(c)}
                aria-label={c.likedByMe ? 'Unlike' : 'Like'}
                aria-pressed={c.likedByMe}
                className="shrink-0 flex flex-col items-center gap-px pt-0.5 w-[26px]"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill={c.likedByMe ? '#E8405A' : 'none'}
                  stroke={c.likedByMe ? '#E8405A' : '#BDB5D4'}
                  strokeWidth="2"
                >
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21.2l7.7-7.8 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
                </svg>
                {c.likeCount > 0 && (
                  <span
                    className={`font-sans text-[10.5px] font-bold leading-none ${
                      c.likedByMe ? 'text-red-500' : 'text-grey-300'
                    }`}
                  >
                    {c.likeCount}
                  </span>
                )}
              </button>
              {(mine || isCreator) && (
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
          <div key={p.key} className={`flex gap-2.5 py-2 items-start ${p.failed ? '' : 'opacity-45'}`}>
            <div className="w-8 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-sans text-[13.5px] font-bold text-purple-700">You</span>
              <p className="font-sans text-[14px] leading-relaxed text-ink-900 break-words">{p.body}</p>
              {p.failed ? (
                <p className="font-sans text-[11.5px] font-semibold text-red-500 mt-0.5">
                  Didn&apos;t send
                  <button
                    onClick={() => {
                      setPending(x => x.map(y => (y.key === p.key ? { ...y, failed: false } : y)))
                      void send(p.body, p.key)
                    }}
                    className="ml-1.5 font-bold text-purple-500"
                  >
                    Try again
                  </button>
                </p>
              ) : (
                <p className="font-sans text-[11.5px] font-semibold text-ink-500 mt-0.5">Sending</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {mentionQuery !== null &&
        (() => {
          const q = mentionQuery.toLowerCase()
          const hits = roster
            .filter(r => r.id !== meId && !!r.displayName && r.displayName.toLowerCase().startsWith(q))
            .slice(0, 5)
          if (hits.length === 0) return null
          return (
            <div className="shrink-0 mx-4 mb-1 rounded-2xl border-[1.5px] border-[#E8E4F5] bg-white overflow-hidden shadow-[0_-8px_22px_rgba(28,23,48,0.12)]">
              <p className="font-sans text-[9.5px] font-bold uppercase tracking-[0.09em] text-grey-300 px-3.5 pt-2.5 pb-1.5">
                People who were there
              </p>
              {hits.map(r => (
                <button
                  key={r.id}
                  onClick={() => applyMention(r.displayName ?? '')}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 border-t border-[#E8E4F5] text-left"
                >
                  <Avatar src={r.avatarUrl} name={r.displayName ?? '?'} size={26} className="shrink-0" />
                  <span className="font-sans text-[13.5px] font-semibold text-ink-900">{r.displayName}</span>
                  {r.id === authorId && (
                    <span className="ml-auto font-sans text-[10px] font-bold uppercase tracking-[0.05em] text-grey-300">
                      Host
                    </span>
                  )}
                </button>
              ))}
            </div>
          )
        })()}

      <div className="shrink-0 px-4 pt-2.5 pb-[18px] flex gap-2.5 items-end bg-white">
        <textarea
          value={draft}
          onChange={e => onDraftChange(e.target.value.slice(0, COMMENT_MAX))}
          placeholder="Add a comment"
          rows={1}
          className={`flex-1 min-h-[44px] max-h-36 bg-grey-100 px-[17px] py-3 font-sans text-[16px] leading-snug text-ink-900 placeholder:text-grey-300 focus:outline-none focus:bg-white resize-none ${
            draft.length > 0 ? 'rounded-[22px] ring-[1.5px] ring-purple-500' : 'rounded-full'
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

      {acting && (
        <>
          <div
            className="fixed inset-0 bg-ink-900/50 z-[80]"
            onClick={() => setActing(null)}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 left-0 right-0 z-[81] px-2 [--safe-pb-base:1.625rem] flex flex-col gap-2 safe-area-pb">
            <div className="rounded-2xl overflow-hidden border border-[#E8E4F5] bg-purple-50/95 backdrop-blur-xl">
              <p className="font-sans text-[12px] font-medium text-ink-500 text-center px-4 pt-3 pb-2 border-b border-[#E8E4F5] leading-snug">
                {acting.authorId === meId
                  ? `Your comment, “${acting.body}”`
                  : `${acting.authorName ?? 'Their'} comment on your Moove's album`}
              </p>
              {acting.authorId === meId && (
                <button
                  onClick={() => {
                    setEditing(acting)
                    setEditDraft(acting.body)
                    setActing(null)
                  }}
                  className="w-full py-4 font-sans text-[17px] font-semibold text-purple-500"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => void remove(acting)}
                className="w-full py-4 font-sans text-[17px] font-semibold text-red-500 border-t border-[#E8E4F5]"
              >
                {acting.authorId === meId ? 'Delete' : 'Remove comment'}
              </button>
            </div>
            <button
              onClick={() => setActing(null)}
              className="w-full py-4 rounded-2xl border border-[#E8E4F5] bg-purple-50/95 backdrop-blur-xl font-sans text-[17px] font-bold text-ink-900"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {editing && (
        <>
          <div
            className="fixed inset-0 bg-ink-900/50 z-[80]"
            onClick={() => setEditing(null)}
            aria-hidden="true"
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[81] bg-white rounded-t-3xl px-5 pt-3 [--safe-pb-base:1.875rem] safe-area-pb"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-9 h-1 rounded-full bg-[#E8E4F5] mx-auto mb-4" />
            <h2 className="font-display font-extrabold text-[18px] text-ink-900 tracking-tight mb-3">
              Edit your comment
            </h2>
            <textarea
              value={editDraft}
              onChange={e => setEditDraft(e.target.value.slice(0, COMMENT_MAX))}
              rows={3}
              className="w-full rounded-xl border-[1.5px] border-[#E8E4F5] bg-purple-50 px-3 py-2 font-sans text-[16px] leading-snug text-ink-900 focus:border-purple-500 focus:bg-white focus:outline-none resize-none mb-4"
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
              className="w-full py-3.5 rounded-2xl bg-purple-50 text-ink-500 font-sans font-semibold text-[15px]"
            >
              Never mind
            </button>
          </div>
        </>
      )}
    </>
  )
}
