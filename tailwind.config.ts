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
        gs: { primary: '#FFD700', secondary: '#C8102E' },
        fb: { primary: '#003DA5', secondary: '#FFD100' },
        bjk: { primary: '#000000', secondary: '#FFFFFF' },
        ts: { primary: '#6B0D0D', secondary: '#003DA5' },
      },
    },
  },
  plugins: [],
}
export default config
