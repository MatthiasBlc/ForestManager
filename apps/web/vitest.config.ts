import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

// Tests de composants [D157] : jsdom, Testing Library, MSW (src/test/setup.ts).
export default defineProject({
  plugins: [react()],
  test: {
    name: "@fm/web",
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
