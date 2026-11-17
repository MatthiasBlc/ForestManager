import { defineProject } from "vitest/config";

// Tests d'integration sur une vraie base PostgreSQL : les fichiers tournent
// l'un apres l'autre (la base est videe entre deux fichiers).
export default defineProject({
  test: {
    name: "@fm/api",
    environment: "node",
    fileParallelism: false,
    setupFiles: ["./test/setup.ts"],
  },
});
