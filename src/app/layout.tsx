import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Mooves',
  description: 'See when your friends are free, without having to ask.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://makemooves.app'),
  openGraph: {
    siteName: 'Mooves',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // NOTE: pinch-zoom is intentionally NOT disabled — `maximumScale: 1` / `userScalable: false`
  // fail WCAG 1.4.4 (users must be able to zoom). The old lock also suppressed iOS's
  // auto-zoom-on-focus; that will now return for any text input < 16px (several are 13–15px).
  // Fix that during the redesign by bumping inputs to ≥16px (note: DS body-md is 15px — inputs
  // should use ≥16px / body-lg to avoid the zoom).
  themeColor: '#7C5CDB',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body>{children}</body>
    </html>
  )
}
