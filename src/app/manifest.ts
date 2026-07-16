import type { MetadataRoute } from 'next'

// PWA manifest. `display: standalone` gives the full-screen, app-like launch when a
// user adds Mooves to their home screen (and is the prerequisite for iOS web push in
// Phase 15). Icons here + src/app/{icon.svg,apple-icon.png} fix the bare-"M" home-screen
// icon. NOTE: 192/512 maskable icons are still pending (only 180 exists today) — add in
// Phase 15 when the PWA/push work lands.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mooves',
    short_name: 'Mooves',
    description: "Signal you're free, see who's around, and make the plan over text.",
    start_url: '/',
    display: 'standalone',
    background_color: '#F8F6FF',
    theme_color: '#7C5CDB',
    icons: [
      { src: '/brand/icon-180.png', sizes: '180x180', type: 'image/png' },
      { src: '/brand/cow-icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
