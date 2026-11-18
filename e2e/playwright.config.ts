// Parcours E2E [D77, D197, D227] : Chromium (mobile et desktop), et WebKit
// (iPhone, informatif) a part, contre le front en image de production (nginx)
// et une API en NODE_ENV=test. Lancer par `npm run e2e` (Chromium) ou
// `npm run e2e:webkit` depuis la racine (docker/compose.e2e.yml), jamais sur l'hote.
import { defineConfig, devices } from "@playwright/test";

const ci = Boolean(process.env.CI);
/** Pose par `npm run e2e:webkit` : le projet WebKit n'existe que la [D227]. */
const webkit = Boolean(process.env.E2E_WEBKIT);

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
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    // Animations coupees (le design system suit `prefers-reduced-motion`) : axe
    // mesurerait sinon le contraste d'une feuille en plein fondu.
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      // Projet par defaut : tous les parcours.
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      // Seulement les parcours marques (D) dans Reference/Plan-Tests.md S4 (tag @desktop).
      name: "desktop",
      grep: /@desktop/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
    // Safari iOS [D227] : tous les parcours, iPhone (agent Safari, tactile),
    // viewport du projet mobile pour comparer a l'identique. Les parties
    // desktop se reperent par `isMobile` (parcours 14). Informatif, a part.
    ...(webkit
      ? [
          {
            name: "webkit",
            use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
          },
        ]
      : []),
  ],
});
