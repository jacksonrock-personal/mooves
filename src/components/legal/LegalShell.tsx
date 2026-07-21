// Shared chrome for the legal pages (Privacy Policy, Terms of Use).
// Matches the Phase 14.2 landing design system (CowMark + wordmark, purple-50
// canvas, DS type/color tokens). Static server component — no client JS.
import Link from 'next/link'
import CowMark from '@/components/ui/CowMark'

export default function LegalShell({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-purple-50 text-ink-900">
      <div className="mx-auto max-w-[720px] px-6">
        {/* HEADER */}
        <header className="flex items-center justify-between py-6">
          <Link href="/" className="flex items-center gap-2">
            <CowMark size={26} />
            <span className="font-display text-[18px] font-extrabold tracking-[-0.02em] text-ink-900">
              Mooves
            </span>
          </Link>
          <Link
            href="/"
            className="text-[13px] font-medium text-purple-500 transition-colors hover:text-purple-700"
          >
            ← Back to home
          </Link>
        </header>

        {/* TITLE */}
        <div className="border-b border-purple-100 pb-6 pt-4">
          <h1 className="font-display text-[32px] font-extrabold tracking-[-0.02em] text-ink-900">
            {title}
          </h1>
          <p className="mt-2 text-[13.5px] text-ink-500">Last updated: {lastUpdated}</p>
        </div>

        {/* BODY */}
        <div className="legal-prose py-8 text-[15px] leading-[1.65] text-ink-500">
          {children}
        </div>

        {/* FOOTER */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-purple-100 py-7 text-[12.5px] text-ink-500">
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-ink-900">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink-900">
              Terms
            </Link>
          </div>
          <div>© 2026 Mooves · makemooves.app</div>
        </footer>
      </div>
    </div>
  )
}
