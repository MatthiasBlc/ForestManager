# Spec : Nettoyage des dependances

## Contexte

Suite a un audit de securite (CVEs axios, mai 2026) et a une revue des dependances, plusieurs packages ont ete identifies comme inutiles, redondants, ou remplacables par du code natif / des dependances deja presentes. L'objectif est de reduire la surface d'attaque, la taille du bundle, et la dette de maintenance.

---

## Perimetre

### Frontend — 5 packages concernes

| Package              | Statut    | Raison                                                                       |
| -------------------- | --------- | ---------------------------------------------------------------------------- |
| `@dnd-kit/core`      | Garder    | Utilise dans `StepEditor.tsx` — liste triable avec support clavier et touch. |
| `@dnd-kit/sortable`  | Garder    | Idem.                                                                        |
| `@dnd-kit/utilities` | Garder    | Idem.                                                                        |
| `classnames`         | Supprimer | 1 seul usage dans `Modal.tsx`. Remplacable par une fonction inline.          |
| `usehooks-ts`        | Supprimer | 1 seul usage dans `Modal.tsx` (`useOnClickOutside`). Hook de ~10 lignes.     |
| `axios`              | Remplacer | Remplacable par `fetch` natif + wrapper. Elimine le risque CVE a la racine.  |

### Backend — 3 packages concernes

| Package         | Statut    | Raison                                                                              |
| --------------- | --------- | ----------------------------------------------------------------------------------- |
| `envalid`       | Supprimer | Redondant avec `zod` (deja dependance). `z.object().parse()` couvre le besoin.      |
| `read`          | Supprimer | Utilise uniquement dans un script CLI. Remplacable par `readline` (stdlib Node.js). |
| `@types/helmet` | Deplacer  | Package de types dans `dependencies`. Doit etre en `devDependencies`.               |

---

## Specifications techniques

### 1. Suppression `classnames`

**Usage actuel** (`Modal.tsx`) :

```tsx
// Appel avec OBJET (API classnames, pas juste des strings)
cn({ "modal modal-bottom sm:modal-middle": true, "modal-open": true });
// Appel avec strings
cn("modal-box", className);
```

**Point d'attention** : le premier appel utilise l'API objet de `classnames` (`{ "classe": condition }`). Une fonction `cn(...strings[])` ne couvre pas ce cas. Ici toutes les conditions sont `true` donc la replacement est une string constante directe — pas besoin d'utilitaire :

```tsx
// Avant
const modalClass = cn({ "modal modal-bottom sm:modal-middle": true, "modal-open": true });
// Apres
const modalClass = "modal modal-bottom sm:modal-middle modal-open";
```

Pour le second appel (`cn("modal-box", className)`), remplacer par un template literal :

```tsx
// Avant
<div className={cn("modal-box", className)}>
// Apres
<div className={`modal-box${className ? ` ${className}` : ""}`}>
```

Aucune creation de fichier utilitaire necessaire.

---

### 2. Suppression `usehooks-ts`

**Usage actuel** (`Modal.tsx`) :

```tsx
import { useOnClickOutside } from "usehooks-ts";
useOnClickOutside(ref, () => {
  onClose();
});
```

**Point d'attention** : `src/hooks/useClickOutside.ts` existe deja dans le projet et couvre le cas `mousedown`. Mais `usehooks-ts` ecoute egalement `touchstart` — fermeture du modal au tap sur mobile. Brancher sur le hook existant sans l'enrichir est une regression mobile silencieuse (les tests n'utilisent que `fireEvent.mouseDown`).

**Remplacement** : enrichir `src/hooks/useClickOutside.ts` avec `touchstart`, puis brancher `Modal.tsx` dessus :

```ts
// src/hooks/useClickOutside.ts — ajouter touchstart
document.addEventListener("mousedown", handleClickOutside);
document.addEventListener("touchstart", handleClickOutside);
return () => {
  document.removeEventListener("mousedown", handleClickOutside);
  document.removeEventListener("touchstart", handleClickOutside);
};
```

Les tests existants de `useClickOutside.test.ts` couvrent `mousedown`. Ajouter un test pour `touchstart` avant de modifier.

---

### 3. Remplacement `axios` → `fetch` natif

C'est le changement le plus consequent. Toute la logique est concentree dans deux fichiers :

- `src/network/apiClient.ts` — configuration centrale (baseURL, credentials, intercepteurs)
- `src/network/api.ts` — fonctions API metier (`AxiosError` type)
- `src/network/adminApi.ts` et `src/network/mealApi.ts` utilisent `API` et `handleApiError` depuis `apiClient.ts`

**Comportement a reproduire exactement :**

| Fonctionnalite axios                | Equivalent fetch                                           |
| ----------------------------------- | ---------------------------------------------------------- |
| `axios.create({ withCredentials })` | `credentials: "include"` dans chaque requete               |
| `baseURL`                           | Prefixer l'URL avec `VITE_BACKEND_URL`                     |
| Intercepteur Content-Type           | Header `"Content-Type": "application/json"` systematique   |
| Intercepteur CSRF (cookie → header) | Lire `XSRF-TOKEN` dans le cookie, injecter dans la requete |
| `AxiosError.response.status`        | `ApiError.status`                                          |
| `AxiosError.response.data.error`    | `await response.json()` puis `.error`                      |
| Rejet auto sur status >= 400        | A implementer manuellement (`if (!res.ok) throw ...`)      |

**Choix architectural : wrapper `{ data }` (Option A)**

`response.data` est utilise 110+ fois dans `api.ts`, `adminApi.ts`, `mealApi.ts`. Pour eviter de les modifier tous, `apiFetch` retourne un objet `{ data: T }` qui reproduit le shape axios :

```ts
async function apiFetch<T>(path: string, options?: RequestInit): Promise<{ data: T }> {
  const res = await fetch(`${API_URL}${path}`, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || `Request failed (${res.status})`);
  }
  // 204 No Content ou body vide : ne pas appeler .json()
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return { data: undefined as T };
  }
  const data = await res.json();
  return { data };
}
```

**Gestion du status 204 No Content**

8 endpoints backend retournent 204 avec un body vide (suppressions). Appeler `.json()` sur un body vide leve `SyntaxError`. Le `apiFetch` detecte ce cas via le status ou le header `content-length` avant d'appeler `.json()`.

**Cas special : `error.response?.status === 410` dans `removeMember`**

Dans `api.ts`, le handler inline de `removeMember` accede a `error.response?.status` (pattern axios). Apres migration, c'est `error.status` (pattern `ApiError`). Ce handler doit etre adapte :

```ts
// Avant
(error: AxiosError) => {
  if (error.response?.status === 410) return error.response;
  return handleApiError(error);
};
// Apres
(error: ApiError | Error) => {
  if (error instanceof ApiError && error.status === 410) {
    return { data: error.message };
  }
  return handleApiError(error as ApiError);
};
```

**Gestion des erreurs** : `AxiosError` est remplace par `ApiError` :

```ts
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
```

Les helpers `handleApiError` et `handleApiErrorWith` sont preserves avec la meme signature externe.

**Contrainte CSRF** : le mecanisme de lecture du cookie `XSRF-TOKEN` et d'injection dans le header `X-XSRF-TOKEN` doit etre rigoureusement preserve — c'est un element de securite critique.

**Note** : `useImageUpload.ts` utilise deja `fetch` natif pour l'upload vers MinIO (PUT presigned URL) — non impacte.

---

### 4. Remplacement `envalid` → `zod` (backend)

**Usage actuel** (`src/util/validateEnv.ts`) — import depuis les internals du package :

```ts
import { cleanEnv } from "envalid";
import { bool, port, str } from "envalid/dist/validators"; // chemin interne
```

**Equivalences exactes des validators envalid → Zod :**

| envalid                                 | Zod                                                        |
| --------------------------------------- | ---------------------------------------------------------- |
| `str()`                                 | `z.string()`                                               |
| `str({ default: "val" })`               | `z.string().default("val")`                                |
| `str({ choices: ["a","b","c"] })`       | `z.enum(["a","b","c"])`                                    |
| `str({ choices: [...], default: "a" })` | `z.enum(["a","b","c"]).default("a")`                       |
| `port()`                                | `z.coerce.number().int().min(0).max(65535)`                |
| `port({ default: 9000 })`               | `z.coerce.number().int().min(0).max(65535).default(9000)`  |
| `bool({ default: false })`              | `z.string().transform(v => v === "true").default("false")` |

**Remplacement complet de `validateEnv.ts` :**

```ts
import { z } from "zod";

const portValidator = z.coerce.number().int().min(0).max(65535);

const envSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: portValidator,
  SESSION_SECRET: z.string(),
  ADMIN_SESSION_SECRET: z.string(),
  CORS_ORIGIN: z.string().default(""),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MINIO_ENDPOINT: z.string().default("minio"),
  MINIO_PORT: portValidator.default(9000),
  MINIO_ACCESS_KEY: z.string().default("minioadmin"),
  MINIO_SECRET_KEY: z.string().default("minioadmin"),
  MINIO_BUCKET: z.string().default("forestmanager-images-dev"),
  MINIO_PUBLIC_URL: z.string().default("http://localhost:9000"),
  MINIO_USE_SSL: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
});

export default envSchema.parse(process.env);
```

Zod leve une `ZodError` explicite si une variable manque ou est mal typee — comportement identique a `cleanEnv`.

---

### 5. Remplacement `read` → `readline` (backend script)

**Usage actuel** (`src/scripts/createAdmin.ts`) :

```ts
import { read } from "read";
const result = await read({ prompt: "..." });
const result = await read({ prompt: "...", silent: true });
```

**Remplacement** avec `readline` stdlib :

```ts
import * as readline from "readline";
function ask(prompt: string, silent = false): Promise<string> { ... }
```

Le flag `silent: true` (masquer la saisie du mot de passe) necessite de jouer sur `process.stdin` directement — solution standard bien documentee en Node.js.

---

### 6. Deplacement `@types/helmet` → `devDependencies`

Simple deplacement dans `backend/package.json`. Verifier si helmet embarque deja ses propres types (auquel cas `@types/helmet` est completement suppressible).

---

## Contraintes

- **Zero regression fonctionnelle** : tous les tests backend doivent passer apres chaque phase.
- **CSRF preserve** : le mecanisme de protection CSRF ne doit pas etre altere lors du remplacement axios.
- **Tests frontend** : les tests existants (MSW) mocquent les requetes HTTP — ils doivent continuer a passer apres remplacement d'axios par fetch (MSW supporte les deux).
- **Pas de changement de comportement visible** : les messages d'erreur retournes a l'utilisateur restent identiques.

---

## Ce qui est hors perimetre

- `@dnd-kit` (×3) : utilise dans `StepEditor.tsx` pour liste triable avec support clavier et touch. Supprimer impliquerait de reimplementer l'accessibilite from scratch.
- `date-fns` : tree-shakee par Vite, cout negligeable, `formatDistanceToNow` complexe a reimplementer.
- `react-hook-form` : usage etendu (7 fichiers), gain faible.
- `cheerio` : usage justifie pour le parsing HTML de l'import de recettes.
- `react-hot-toast` : 43 fichiers, entierement embarquee.
