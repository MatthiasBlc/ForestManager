import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En dev, /api part vers l'API (service `api` dans Docker, localhost sinon) :
// meme origine que la prod (nginx), donc cookies et CSRF identiques.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    proxy: { "/api": { target: apiTarget, changeOrigin: false } },
  },
});
