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
        // Mooves brand palette (locked)
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
      borderRadius: {
        phone: '44px',
      },
    },
  },
  plugins: [],
}

export default config
