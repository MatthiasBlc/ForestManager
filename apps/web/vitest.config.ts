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
    // Parcours d'editeur longs (saisie dans jsdom) : 5 s ne suffisent pas quand
    // l'API et le web tournent en parallele dans la suite complete.
    testTimeout: 15_000,
  },
});
