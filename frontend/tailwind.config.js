/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const plugin = require("tailwindcss/plugin");

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [
    require("daisyui"),
    plugin(function ({ addVariant }) {
      // pointer-fine: mouse/trackpad (desktop)
      addVariant("pointer-fine", "@media (pointer: fine)");
      // pointer-coarse: touch screen (mobile/tablet)
      addVariant("pointer-coarse", "@media (pointer: coarse)");
    }),
  ],
  daisyui: {
    themes: ["forest", "winter"],
  },
};
