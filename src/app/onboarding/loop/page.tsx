'use client'

// Screen 3 (revised) — The Mooves Loop finale route (/onboarding/loop).
// Thin wrapper; all behaviour lives in the MoovesLoop component.

import { Suspense } from 'react'
import MoovesLoop from '@/components/onboarding/MoovesLoop'

export default function OnboardingLoopPage() {
  return (
    <Suspense>
      <MoovesLoop />
    </Suspense>
  )
}
