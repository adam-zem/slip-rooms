/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          brand: '#047857',
        },
        brand: {
          bg: '#000000',
          text: '#ffffff',
          muted: '#888888',
          border: 'rgba(4, 120, 87, 0.3)',
          tint: 'rgba(4, 120, 87, 0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
