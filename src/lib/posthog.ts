'use client'

import posthog from 'posthog-js'

// Call once in the root layout's client wrapper
export function initPostHog() {
  if (typeof window === 'undefined') return
  if (posthog.__loaded) return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: false, // we'll fire page views manually
    capture_pageleave: true,
    person_profiles: 'identified_only',
  })
}

export { posthog }
