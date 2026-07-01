// Root: redirect to /auth. Middleware redirects authenticated users from /auth → /feed.
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/auth')
}
