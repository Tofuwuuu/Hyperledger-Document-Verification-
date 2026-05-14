/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          600: '#047857',
        },
        'cvsu-green': '#38a389',
        'cvsu-green-dark': '#2f7d6d',
        'cvsu-yellow': '#ffc107',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} 
