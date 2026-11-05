import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// En dev, /api part vers l'API (service `api` dans Docker, localhost sinon) :
// meme origine que la prod (nginx), donc cookies et CSRF identiques.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3001";

export default defineConfig({
  // Hors de l'arbre dans les conteneurs (VITE_CACHE_DIR), pour ne rien y ecrire en root.
  cacheDir: process.env.VITE_CACHE_DIR ?? "node_modules/.vite",
  plugins: [
    react(),
    tailwindcss(),
    // PWA [D35, D74] : coquille en precache, mise a jour proposee (pas forcee),
    // aucune reponse de l'API en cache (le hors ligne des donnees passe par TanStack Query).
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "Forest Manager",
        short_name: "Forest",
        description: "Recettes, repas et courses partagés avec tes proches.",
        lang: "fr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#16181b",
        theme_color: "#16181b",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
        // Polices : alphabet latin seulement en precache (francais) ; les autres se chargent a la demande.
        globIgnores: ["**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    proxy: { "/api": { target: apiTarget, changeOrigin: false } },
  },
});
