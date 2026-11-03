/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        apple: {
          yellow: '#E6A700',
          yellowHover: '#D19600',
          yellowLight: '#FFF8E1',
          sidebarBg: '#F6F6F6',
          sidebarDark: '#1E1E1E',
          listBg: '#FFFFFF',
          listDark: '#262626',
          editorBg: '#FFFFFF',
          editorDark: '#1E1E1E',
          border: '#E5E5E5',
          borderDark: '#333333',
          textMuted: '#8E8E93',
          selected: '#EAEAEA',
          selectedDark: '#3A3A3C'
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ]
      }
    },
  },
  plugins: [],
}
