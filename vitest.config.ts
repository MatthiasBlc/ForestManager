import { defineConfig } from "vitest/config";

// Chaque workspace est un projet Vitest (sa propre config s'il en a une).
// Couverture [D78] : `npm run test:coverage` (CI) ; seuils par zone de
// `15-Plan-Tests.md` S7, ecarts mesures notes au meme endroit.
export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
      // Hors de l'arbre monte : le conteneur de tests tourne en root.
      reportsDirectory: "/tmp/coverage",
      include: ["apps/api/src/**", "apps/web/src/**", "packages/shared/src/**"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "apps/api/src/generated/**",
        "apps/api/src/scripts/**",
        "apps/web/src/test/**",
      ],
      // Seuils par zone, bloquants (mesure du 2026-11-11 : shared 99,7 / 92,
      // api 95,8 / 83,1, web 91,4 / 80,8 en lignes / branches).
      thresholds: {
        "packages/shared/src/**": { lines: 90, branches: 85 },
        "apps/api/src/**": { lines: 80, branches: 70 },
        "apps/web/src/**": { lines: 60, branches: 50 },
      },
    },
  },
});
