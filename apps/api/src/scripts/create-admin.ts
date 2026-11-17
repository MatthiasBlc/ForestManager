// Creation d'un compte super admin, en ligne de commande dans le conteneur de l'API :
//   dev   : npm run admin:create
//   prod  : console du conteneur (Portainer), puis `npm run admin:create -w @fm/api`
// Pas de creation par l'API ni par le seed. La 2FA se configure a la premiere connexion.
// Dans src/ (et non apps/api/scripts) pour etre present dans l'image de prod.

import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

import { pino } from "pino";

import { createAdminUser } from "../core/admin/accounts.ts";
import { loadEnv } from "../core/config/env.ts";
import { createDb } from "../core/db/client.ts";
import { createContext } from "../core/http/app.ts";
import { AppError } from "../core/http/errors.ts";

/** Sortie muette pendant la saisie du mot de passe. */
let muted = false;
const output = new Writable({
  write(chunk: Buffer, _encoding, callback) {
    if (!muted) stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: stdin, output, terminal: stdin.isTTY });
// Lecture ligne par ligne : marche en interactif comme avec une entree redirigee.
const lines = rl[Symbol.asyncIterator]();

async function ask(question: string, hidden = false): Promise<string> {
  stdout.write(question);
  muted = hidden;
  const next: IteratorResult<string> = await lines.next();
  muted = false;
  if (hidden) stdout.write("\n");
  return next.done === true ? "" : next.value.trim();
}

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const ctx = createContext({ env, db, logger: pino({ level: "silent" }), modules: [] });

try {
  stdout.write("Forest Manager - creation d'un compte super admin\n\n");
  const username = await ask("Nom d'utilisateur : ");
  const email = await ask("Email : ");
  const password = await ask("Mot de passe (10 caracteres minimum) : ", true);
  const confirm = await ask("Confirmer le mot de passe : ", true);
  if (password !== confirm) throw new Error("Les mots de passe ne correspondent pas.");
  const admin = await createAdminUser(ctx, { username, email, password });
  stdout.write(`\nCompte admin cree : ${admin.username} (${admin.email}).\n`);
  stdout.write("A la premiere connexion sur /admin, configure la verification en deux etapes.\n");
} catch (error) {
  const message =
    error instanceof AppError
      ? error.message
      : error instanceof Error && error.name === "ZodError"
        ? "Nom d'utilisateur, email ou mot de passe invalide."
        : error instanceof Error
          ? error.message
          : String(error);
  stdout.write(`\nEchec : ${message}\n`);
  process.exitCode = 1;
} finally {
  rl.close();
  await db.$disconnect();
}
