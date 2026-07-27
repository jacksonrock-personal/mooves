'use client'

// Phase 20.3 / 20.9 — a planned Moove in the feed.
//
// Card anatomy deliberately mirrors the green card: same frame, same padding,
// same title baseline, same button position. The ONE structural difference is
// the lead element — a round avatar means a person is free, a square tile means
// a scheduled thing. That is what lets greens and Mooves read as one design
// language instead of two, which an earlier interleaved draft failed at badly.
//
// No green anywhere: a Moove is not availability, so the tile is purple.

import Avatar from '@/components/ui/Avatar'
import { posthog } from '@/lib/posthog'
import { planTile, planWhenLine, type Plan } from '@/lib/plans'
import WhosIn from './WhosIn'
import GroupLabel from './GroupLabel'

interface PlanCardProps {
  plan: Plan
  meId: string
  onToggleJoin: (planId: string, joined: boolean) => void
  onBlast: (plan: Plan) => void
  onActions: (plan: Plan) => void
}

export default function PlanCard({ plan, meId, onToggleJoin, onBlast, onActions }: PlanCardProps) {
  const start = new Date(plan.startAt)
  const tile = planTile(start, plan.hasTime)
  const when = planWhenLine(start, plan.hasTime, plan.locationText)

  // Same 2+ gate as a green: never blast into silence (Phase 9).
  const canBlast = plan.isMine && plan.joiners.length >= 2

  function handleJoin() {
    posthog.capture(plan.joinedByMe ? 'plan_join_removed' : 'plan_join_added')
    onToggleJoin(plan.id, plan.joinedByMe)
  }

  return (
    <div
      className={`rounded-2xl border-[1.5px] bg-card-white px-3 py-3 mb-2 ${
        plan.isMine ? 'border-purple-500/40' : 'border-[#E8E4F5]'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Lead tile: time when there is one, otherwise the date. A date-only
            Moove should read as deliberate, not as a Moove missing its time. */}
        <div className="w-[46px] h-[46px] shrink-0 rounded-[13px] bg-purple-100 flex flex-col items-center justify-center gap-px">
          <span className="font-display font-extrabold text-[14px] leading-none tracking-tight text-purple-700">
            {tile.top}
          </span>
          <span className="font-sans text-[9px] font-bold tracking-[0.08em] leading-none text-purple-700/75">
            {tile.bottom}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-[15px] leading-tight tracking-tight text-ink-900 truncate">
            {plan.title}
          </p>
          <p className="font-sans text-[12.5px] leading-snug text-ink-500 mt-0.5 truncate">{when}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="font-sans text-[10.5px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">
              {plan.isMine ? 'Your Moove' : (plan.authorName ?? 'A friend')}
            </span>
            <GroupLabel groups={plan.visibleGroups} />
          </div>
        </div>

        {plan.isMine ? (
          <button
            onClick={() => onActions(plan)}
            aria-label="Moove options"
            className="shrink-0 w-7 h-7 rounded-full bg-surface-bg border border-[#E8E4F5] text-ink-500 flex items-center justify-center"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleJoin}
            aria-pressed={plan.joinedByMe}
            className={`shrink-0 px-3.5 py-2 rounded-full font-sans font-bold text-[12.5px] text-white ${
              plan.joinedByMe ? 'bg-green-700' : 'bg-purple-500'
            }`}
          >
            {plan.joinedByMe ? "You're in ✓" : "I'm in"}
          </button>
        )}
      </div>

      {plan.note && (
        <p className="font-sans text-[12.5px] leading-snug text-ink-500 mt-2.5">{plan.note}</p>
      )}

      {/* 13.8 guardrail — a Moove brought over from Discover stays disclosed to
          the friends seeing it. User-initiated is not the same as unmarked. */}
      {plan.sponsorBrand && (
        <p className="font-sans text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mt-2">
          Sponsored · {plan.sponsorBrand}
        </p>
      )}

      <WhosIn
        people={plan.joiners}
        meId={meId}
        hostId={plan.authorId}
        hostLabel="Host"
      />

      {canBlast && (
        <button
          onClick={() => onBlast(plan)}
          className="w-full mt-2.5 py-2.5 rounded-[13px] bg-purple-500 text-white font-display font-extrabold text-[14px] tracking-tight flex items-center justify-center gap-2"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          Start a group text
        </button>
      )}
    </div>
  )
}

/** The author's avatar, used by the rail-free empty states. */
export function PlanAuthorAvatar({ plan }: { plan: Plan }) {
  return <Avatar src={plan.authorAvatar} name={plan.authorName} size={26} />
}
