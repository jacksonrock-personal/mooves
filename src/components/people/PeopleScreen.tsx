'use client'

// People tab shell (Screens 8 + 9). A shared header + Friends|Groups sub-tabs,
// with a "+" that appears only on the Groups tab. Renders the active panel and
// the bottom nav. Mockup: mooves-screen9-groups.html

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { posthog } from '@/lib/posthog'
import BottomNav from '@/components/ui/BottomNav'
import Wordmark from '@/components/ui/Wordmark'
import FriendsPanel from './FriendsPanel'
import GroupsPanel from './GroupsPanel'

type Tab = 'friends' | 'groups'

export default function PeopleScreen() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('friends')

  function handleCreateGroup() {
    posthog.capture('group_create_started')
    router.push('/people/groups/new')
  }

  return (
    <div className="min-h-screen flex flex-col bg-purple-50">
      {/* Header */}
      <header className="bg-white px-5 pt-14 border-b border-[#E8E4F5] shrink-0">
        <div className="flex justify-center mb-3">
          <Wordmark withCow />
        </div>
        <div className="flex items-center justify-between min-h-11 mb-1.5">
          <h1 className="font-display font-extrabold text-[24px] text-ink-900 tracking-tight">
            People
          </h1>
          {tab === 'groups' && (
            <button
              onClick={handleCreateGroup}
              aria-label="Create group"
              className="inline-flex items-center gap-1.5 h-11 pl-3 pr-4 rounded-full bg-purple-500 text-white font-sans font-semibold text-[14px] tracking-[-0.01em] shadow-[0_2px_8px_rgba(124,92,219,0.3)]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New
            </button>
          )}
        </div>
        <div className="flex">
          {(['friends', 'groups'] as const).map(t => (
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
      {tab === 'friends' ? <FriendsPanel /> : <GroupsPanel />}

      <BottomNav />
    </div>
  )
}
