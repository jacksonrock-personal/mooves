/**
 * Mooves — Tailwind theme.extend block.
 * Merge into tailwind.config.ts under `theme.extend`.
 */
module.exports = {
  colors: {
    green:  { 100: '#E3F9EC', 500: '#2ECC71', 700: '#167A43' }, // 500 = decorative only (fails AA for text)
    purple: { 50: '#F8F6FF', 100: '#EDE9FF', 500: '#7C5CDB', 700: '#5F3FC4' },
    ink:    { 900: '#1C1730', 500: '#6B628A' },
    grey:   { 100: '#F1EEFA', 300: '#BDB5D4' },
    red:    { tint: '#FFF0F2', 500: '#E8405A' },
  },
  fontFamily: {
    display: ['"Plus Jakarta Sans"', 'sans-serif'],
    sans: ['Inter', 'sans-serif'],
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
  // spacing: keep Tailwind's default 4px scale — already matches (4,8,12,16,20,24,32,40...)
  borderRadius: { sm: '12px', md: '16px', lg: '20px', xl: '28px', pill: '9999px' },
  boxShadow: {
    sm: '0 1px 2px rgba(28,23,48,0.06)',
    md: '0 8px 24px rgba(28,23,48,0.14)',
    'glow-green': '0 4px 24px rgba(46,204,113,0.4)',
  },
};
