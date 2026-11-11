// Parcours E2E [D77, D195, D197] : Chromium seul, contre le front en image de
// production (nginx) et une API en NODE_ENV=test. Lancer par `npm run e2e`
// depuis la racine (docker/compose.e2e.yml), jamais sur l'hote.
import { defineConfig } from "@playwright/test";

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./journeys",
  outputDir: "./test-results",
  // Une seule base, videe avant chaque parcours : pas de parallelisme.
  fullyParallel: false,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "./playwright-report", open: "never" }]],
  use: {
    // Le conteneur Playwright partage le reseau du nginx : `localhost` est une
    // origine sure, le service worker s'enregistre comme en production.
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost",
    browserName: "chromium",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      // Projet par defaut : tous les parcours.
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      // Seulement les parcours marques (D) dans 15-Plan-Tests.md S4 (tag @desktop).
      name: "desktop",
      grep: /@desktop/,
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
});
