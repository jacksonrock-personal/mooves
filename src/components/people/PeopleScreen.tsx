'use client'

// People tab shell (Screens 8 + 9). A shared header + Friends|Groups sub-tabs.
// The create-group action lives in GroupsPanel's sticky bottom bar (amended
// 2026-07-22), not the header. Renders the active panel and the bottom nav.
// Mockup: mooves-screen9-groups.html

import { useState } from 'react'
import BottomNav from '@/components/ui/BottomNav'
import Wordmark from '@/components/ui/Wordmark'
import FriendsPanel from './FriendsPanel'
import GroupsPanel from './GroupsPanel'

type Tab = 'friends' | 'groups'

export default function PeopleScreen() {
  const [tab, setTab] = useState<Tab>('groups')

  return (
    <div className="min-h-screen flex flex-col bg-purple-50">
      {/* Header */}
      <header className="bg-white px-5 pt-14 border-b border-[#E8E4F5] shrink-0">
        <div className="flex justify-center mb-3">
          <Wordmark withCow />
        </div>
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
