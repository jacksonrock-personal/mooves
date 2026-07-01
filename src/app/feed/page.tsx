// Screen 4: Home Feed
// Mockup: mooves-screen4-feed.html

import { Suspense } from 'react'
import FeedScreen from '@/components/feed/FeedScreen'

export default function FeedPage() {
  return (
    <Suspense>
      <FeedScreen />
    </Suspense>
  )
}
