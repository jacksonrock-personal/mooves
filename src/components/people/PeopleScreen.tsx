'use client'

// People tab shell (Screens 8 + 9). A shared header + Friends|Groups sub-tabs.
// The create-group action lives in GroupsPanel's sticky bottom bar (amended
// 2026-07-22), not the header. Renders the active panel and the bottom nav.
// Mockup: mooves-screen9-groups.html

import { useState } from 'react'
import BottomNav from '@/components/ui/BottomNav'
import FriendsPanel from './FriendsPanel'
import GroupsPanel from './GroupsPanel'

type Tab = 'friends' | 'groups'

export default function PeopleScreen() {
  const [tab, setTab] = useState<Tab>('groups')

  return (
    <div className="min-h-screen flex flex-col bg-purple-50">
      {/* R14 — the wordmark lockup is gone; "People" is the first thing here now
          and the bar clears the notch rather than a hardcoded pt-14. */}
      <header className="bg-white px-5 [--safe-pt-base:0.875rem] safe-area-pt border-b border-[#E8E4F5] shrink-0">
        <div className="flex items-center min-h-11 mb-1.5">
          <h1 className="font-display font-extrabold text-[24px] text-ink-900 tracking-tight">
            People
          </h1>
        </div>
        <div className="flex">
          {(['groups', 'friends'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 text-center font-sans text-[14px] font-semibold pb-2.5 border-b-2 ${
                tab === t
                  ? 'text-purple-500 border-purple-500'
                  : 'text-ink-500 border-transparent'
              }`}
            >
              {t === 'friends' ? 'Friends' : 'Groups'}
            </button>
          ))}
        </div>
      </header>

      {/* Active panel */}
      {tab === 'groups' ? <GroupsPanel /> : <FriendsPanel />}

      <BottomNav />
    </div>
  )
}
