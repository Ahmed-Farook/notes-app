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
          yellow: '#213A50', // Kyoto Deep Indigo Blue
          yellowHover: '#172A3C', // Deep Indigo Hover
          yellowLight: '#E8F1F7', // Soft Kyoto Blue Tint
          sidebarBg: '#EFE7D8', // Warm parchment sidebar
          sidebarDark: '#101720', // Kyoto midnight slate
          listBg: '#F6EFE4', // Parchment list
          listDark: '#16202A', // Kyoto twilight list
          editorBg: '#FAF6EF', // Stationery cream
          editorDark: '#131B24', // Kyoto night canvas
          border: '#DFD3C0', // Warm washi border
          borderDark: '#223344', // Slate border
          textMuted: '#6E7E8E', // Slate muted text
          selected: '#E5DCCB', // Parchment selected
          selectedDark: '#233242' // Slate selected
        },
        kyoto: {
          indigo: '#213A50',
          indigoHover: '#172A3C',
          slate: '#395060',
          slateLight: '#4B708B',
          cream: '#FAF6EF',
          creamDark: '#EFE7D8',
          border: '#DFD3C0',
          lantern: '#D4A359',
          night: '#131B24',
          nightCard: '#1C2733',
          nightBorder: '#223344',
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

