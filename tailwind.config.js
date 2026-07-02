/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Status-Farben aus deinem Excel
        statusPlanned:   '#FACC15', // gelb  – gepl.
        statusEntered:   '#FFFFFF', // weiß  – eingetragen
        statusHalfday:   '#FDE68A', // hellgelb – halbtags
        statusSick:      '#FCA5A5', // rot   – krank
        statusVacation:  '#93C5FD', // blau  – urlaub
        statusFree:      '#E5E7EB', // grau  – frei
        statusManual:    '#C4B5FD', // lila  – manuel
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
