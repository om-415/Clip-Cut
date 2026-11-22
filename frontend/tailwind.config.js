/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        background: '#000000',
        surface: {
          primary: '#050505',
          secondary: '#0B0B0B',
          tertiary: '#121212',
          elevated: '#1A1A1A',
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.08)',
          strong: 'rgba(255, 255, 255, 0.16)',
        },
        accent: {
          DEFAULT: '#6366F1',
          hover: '#4F46E5',
          subtle: 'rgba(99, 102, 241, 0.12)',
        }
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
      },
      boxShadow: {
        'studio': '0 0 0 1px rgba(255, 255, 255, 0.08), 0 20px 40px -15px rgba(0, 0, 0, 0.6)',
        'studio-sm': '0 0 0 1px rgba(255, 255, 255, 0.06), 0 8px 20px -8px rgba(0, 0, 0, 0.5)',
        'accent-glow': '0 0 24px -4px rgba(99, 102, 241, 0.35)',
      }
    },
  },
  plugins: [],
}
