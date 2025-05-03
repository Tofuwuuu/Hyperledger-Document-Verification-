/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cvsu-green': '#38a389',
        'cvsu-yellow': '#ffc107',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} 