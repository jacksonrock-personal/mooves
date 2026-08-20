import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister'
import InstallNudge from '@/components/pwa/InstallNudge'
import NotificationOptIn from '@/components/pwa/NotificationOptIn'

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
  // Pinch-zoom is intentionally NOT disabled, and R32 kept it that way after
  // re-examining it. Three reasons, in order of how much they matter:
  //
  //   1. `userScalable: false` / `maximumScale: 1` fail WCAG 1.4.4, and in this
  //      app that is not a technicality. Mooves sets every size in px against a
  //      webfont, so iOS Dynamic Type does nothing here — pinch is the ONLY way
  //      anyone can make this text bigger. Taking it away leaves no route at all.
  //   2. Safari ignores both properties in a normal tab anyway (since iOS 10).
  //      Setting them would fix nothing for most users while reading, in the
  //      code, as though zoom had been dealt with.
  //   3. Pinch was never the actual complaint. Zoom was arriving by two other
  //      doors, and R32 shut both:
  //        · iOS auto-zoom when focusing an input under 16px — the real culprit,
  //          reported as "tapping around zooms me in and I can't get back".
  //          Every phone-surface input is now >= 16px, with a floor in
  //          globals.css for anything that does not set its own.
  //        · double-tap-to-zoom, now off via `touch-action: manipulation` on
  //          body, which leaves scrolling and pinch untouched.
  //
  // So: the two accidental doors are closed and the deliberate one is still
  // open. If pinch-zoom itself ever needs blocking, the honest way is a
  // `gesturestart` preventDefault, and it should be argued for on its own.
  themeColor: '#7C5CDB',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegister />
        <InstallNudge />
        <NotificationOptIn />
      </body>
    </html>
  )
}
