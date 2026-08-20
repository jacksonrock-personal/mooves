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
import GroupLabel from './GroupLabel'
import type { MoovePane } from './MooveSheet'

interface PlanCardProps {
  plan: Plan
  meId: string
  onToggleJoin: (planId: string, joined: boolean) => void
  onBlast: (plan: Plan) => void
  onActions: (plan: Plan) => void
  /** Opens the Moove sheet on a specific pane — the row has a target for each. */
  onOpenSheet: (plan: Plan, pane: MoovePane) => void
  /** R29 — the vouch chip was tapped on a one-hop-out Moove. */
  onVia: (plan: Plan) => void
}

export default function PlanCard({
  plan,
  meId,
  onToggleJoin,
  onBlast,
  onActions,
  onOpenSheet,
  onVia,
}: PlanCardProps) {
  const start = new Date(plan.startAt)
  const tile = planTile(start, plan.hasTime, plan.timeMode)
  const when = planWhenLine(start, plan.hasTime, plan.locationText, new Date(), plan.timeMode)

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
        {/* R30 — the tile and the two text lines are ONE button, opening the
            sheet on "Who's in". The card previously had no body tap target at
            all: every affordance on it was a small control, and the largest
            region was inert. The chips are lifted out of this button rather
            than left inside it because the R29 vouch chip is itself a button,
            and a button inside a button is invalid. */}
        <button
          onClick={() => onOpenSheet(plan, 'who')}
          aria-label={`${plan.title}. ${when}. Open details.`}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          {/* Lead tile: time when there is one, otherwise the date. A date-only
              Moove should read as deliberate, not as a Moove missing its time. */}
          <div className="w-[46px] h-[46px] shrink-0 rounded-[13px] bg-purple-100 flex flex-col items-center justify-center gap-px px-0.5">
            <span className="font-display font-extrabold text-[13px] leading-none tracking-tight text-purple-700">
              {tile.top}
            </span>
            <span className="font-sans text-[8.5px] font-bold tracking-[0.04em] leading-none text-purple-700/75 text-center">
              {tile.bottom}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            {/* R30 — WRAPS, up to two lines. It was `truncate`, so a Moove
                called anything longer than about 22 characters was unreadable
                in the feed and there was nowhere to go to read it. GroupLabel
                already settled this argument for the group pill — "names are
                never truncated, the card grows to fit" — and the Moove's own
                title has a better claim to that than the label does.
                Two lines rather than unbounded: 80 chars is the write-side cap
                and clamping keeps a pathological title from owning the feed. */}
            <p className="font-display font-bold text-[15px] leading-tight tracking-tight text-ink-900 line-clamp-2">
              {plan.title}
            </p>
            <p className="font-sans text-[12.5px] leading-snug text-ink-500 mt-0.5 line-clamp-2">{when}</p>
          </div>
        </button>

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

      {/* R30 — the chips get their own row. They used to sit inside the middle
          column, which is now a button, and the R29 vouch chip is itself a
          button. pl-[58px] is the tile (46) plus the row gap (12), so the row
          lands on the same left edge the title sits on and nothing moved
          visually. flex-wrap because a long group name plus a vouch can exceed
          one line, and GroupLabel's rule is that names never truncate. */}
      <div className="flex items-center gap-1.5 flex-wrap mt-1.5 pl-[58px]">
          <span className="font-sans text-[10.5px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">
            {plan.isMine ? 'Your Moove' : (plan.authorName ?? 'A friend')}
          </span>
          {/* R29 — the vouch, and also the only way to reach Hide.
              Drawn in GroupLabel's shape on purpose: it sits in the same row
              as that label and the author pill, and a third visual language
              here would make the row read as three unrelated things.
              It is a BUTTON because the mockup found there is nowhere else for
              Hide to live — on someone else's card the right-hand slot holds
              "I'm in", and Hide must not displace the primary action. The chip
              renders only on one-hop-out Mooves, so the affordance exists
              exactly where the thing it manages does. */}
          {plan.viaName && (
            <button
              onClick={() => onVia(plan)}
              aria-label={`${plan.authorName ?? 'They'} are connected to you through ${plan.viaName}. Options.`}
              className="inline-flex items-start gap-1.5 max-w-full min-w-0 rounded-[13px] border border-[#E8E4F5] bg-white pl-[7px] pr-2.5 py-[3px]"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 mt-[3px] text-grey-300"
                aria-hidden="true"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              </svg>
              <span className="font-sans text-[11px] font-semibold text-ink-500 leading-[1.4] break-words min-w-0">
                through {plan.viaName}
              </span>
            </button>
          )}
        <GroupLabel groups={plan.visibleGroups} />
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

      {/* Phase 21, second revision — the action row. Venmo's shape, one line.
          Venmo carries bubble/heart/emoji; we have neither likes nor reactions,
          so the roster shares the line with comments rather than leaving a lone
          bubble on a row of its own.

          Both halves open the same sheet on different panes. Neither is an
          expand/collapse control, which is what made the inline version
          unreadable — a ▾ promises the card will grow.

          WALL 3: the bubble is rendered only for people who are in. A viewer
          who has not joined sees the faces and a count of them, and nothing
          whatsoever about comments. `commentCount` is 0 for them anyway —
          get_plans refuses to send the real number — so this is belt and
          braces, not the only guard. */}
      <div className="flex items-center mt-2.5 pt-2.5 border-t border-grey-100">
        <button
          onClick={() => onOpenSheet(plan, 'who')}
          aria-label="Who's in"
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <div className="flex shrink-0">
            {[
              { id: plan.authorId, name: plan.authorName, url: plan.authorAvatar },
              ...plan.joiners.slice(0, 2).map(j => ({ id: j.id, name: j.displayName, url: j.avatarUrl })),
            ].map((p, i) => (
              <Avatar
                key={p.id}
                src={p.url}
                name={p.name ?? '?'}
                size={23}
                className={`ring-2 ring-white ${i > 0 ? '-ml-2' : ''}`}
              />
            ))}
          </div>
          <span className="font-sans text-[11.5px] font-semibold text-ink-500">
            {plan.joiners.length + 1} in
          </span>
        </button>

        {(plan.isMine || plan.joinedByMe) && (
          <button
            onClick={() => onOpenSheet(plan, 'comments')}
            aria-label="Comments"
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-grey-100"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-ink-500"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            {/* Zero shows the bubble alone. A "0" is a small accusation that
                nobody has said anything, and the one number here that could
                read as a nudge. */}
            {plan.commentCount > 0 && (
              <span className="font-sans text-[12px] font-bold text-ink-500">
                {plan.commentCount}
              </span>
            )}
          </button>
        )}
      </div>

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
