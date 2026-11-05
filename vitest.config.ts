import { defineConfig } from "vitest/config";

// Chaque workspace est un projet Vitest (sa propre config s'il en a une).
export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
    passWithNoTests: true,
  },
});
