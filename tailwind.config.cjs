/** @type {import('tailwindcss').Config} */
const radixScale = (name) => Object.fromEntries(
  Array.from({ length: 12 }, (_, index) => [String(index + 1), `var(--${name}-${index + 1})`]),
);

module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        gray: radixScale('gray'),
        blue: radixScale('blue'),
        green: radixScale('green'),
        amber: radixScale('amber'),
        red: radixScale('red'),
      },
    },
  },
  plugins: [],
};
