import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Design System v1 scale (canonical — adopted 2026-07-16) ──
        // See docs/design-system.md. NOTE: green-500 is DECORATIVE ONLY — white text
        // on it fails WCAG AA (2.1:1). Use green-700 for any text/icon/CTA fill.
        green:  { 100: '#E3F9EC', 500: '#2ECC71', 700: '#167A43' },
        purple: { 50: '#F8F6FF', 100: '#EDE9FF', 500: '#7C5CDB', 700: '#5F3FC4' },
        ink:    { 900: '#1C1730', 500: '#6B628A' },
        grey:   { 100: '#F1EEFA', 300: '#BDB5D4' },
        red:    { tint: '#FFF0F2', 500: '#E8405A' },
        // ── Legacy aliases (pre-DS names) — kept during the opportunistic migration.
        //    Same hexes as the scale above; retire each per-screen as it's rebuilt. ──
        'mooves-purple':  '#7C5CDB',
        'status-green':   '#2ECC71',
        'status-grey':    '#BDB5D4',
        'surface-bg':     '#F8F6FF',
        'card-white':     '#FFFFFF',
        'purple-tint':    '#EDE9FF',
        'text-primary':   '#1C1730',
        'text-secondary': '#6B628A',
      },
      fontFamily: {
        sans:    ['Inter', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      fontSize: {
        'display-2xl': ['32px', { lineHeight: '1.15', fontWeight: '800' }],
        'display-xl':  ['26px', { lineHeight: '1.15', fontWeight: '800' }],
        'display-lg':  ['20px', { lineHeight: '1.2',  fontWeight: '800' }],
        'body-lg':     ['17px', { lineHeight: '1.5' }],
        'body-md':     ['15px', { lineHeight: '1.5' }],
        'body-sm':     ['13px', { lineHeight: '1.4' }],
        'label-xs':    ['11px', { lineHeight: '1.3', letterSpacing: '0.08em' }],
      },
      borderRadius: {
        phone: '44px',
        // DS radius scale (sm 12 / md 16 / lg 20 / xl 28 / pill) intentionally NOT added
        // yet — those keys collide with Tailwind defaults that shipped screens use
        // (e.g. rounded-xl). Reconcile during the redesign build. Values in docs/design-system.md.
      },
      boxShadow: {
        // DS 'sm'/'md' omitted (collide with Tailwind defaults in use). glow-green is new.
        'glow-green': '0 4px 24px rgba(46,204,113,0.4)',
      },
    },
  },
  plugins: [],
}

export default config
