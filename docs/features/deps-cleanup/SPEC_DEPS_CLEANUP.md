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
import cn from "classnames";
cn("modal-box w-11/12 max-w-2xl", className);
```

**Remplacement** : fonction utilitaire locale dans `src/utils/cn.ts` :

```ts
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
```

Ou plus simplement, remplacer l'appel par un template literal si le cas est trivial (concatenation de 2 strings fixes).

---

### 2. Suppression `usehooks-ts`

**Usage actuel** (`Modal.tsx`) :

```tsx
import { useOnClickOutside } from "usehooks-ts";
useOnClickOutside(ref, () => {
  onClose();
});
```

**Remplacement** : hook local `src/hooks/useOnClickOutside.ts` :

```ts
import { useEffect, RefObject } from "react";

export function useOnClickOutside<T extends HTMLElement>(ref: RefObject<T>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}
```

---

### 3. Remplacement `axios` → `fetch` natif

C'est le changement le plus consequent. Toute la logique est concentree dans deux fichiers :

- `src/network/apiClient.ts` — configuration centrale (baseURL, credentials, intercepteurs)
- `src/network/api.ts` — fonctions API metier (`AxiosError` type)

**Comportement a reproduire exactement :**

| Fonctionnalite axios                | Equivalent fetch                                           |
| ----------------------------------- | ---------------------------------------------------------- |
| `axios.create({ withCredentials })` | `credentials: "include"` dans chaque requete               |
| `baseURL`                           | Prefixer l'URL avec `VITE_BACKEND_URL`                     |
| Intercepteur Content-Type           | Header `"Content-Type": "application/json"` systematique   |
| Intercepteur CSRF (cookie → header) | Lire `XSRF-TOKEN` dans le cookie, injecter dans la requete |
| `AxiosError.response.status`        | `Response.status`                                          |
| `AxiosError.response.data.error`    | `await response.json()` puis `.error`                      |
| Rejet auto sur status >= 400        | A implementer manuellement (`if (!res.ok) throw ...`)      |

**Nouveau `apiClient.ts`** : expose une fonction `apiFetch(path, options?)` qui encapsule `fetch` avec tous ces comportements. Les appels dans `api.ts` sont mis a jour pour utiliser `apiFetch` au lieu de `API.get/post/patch/delete`.

**Gestion des erreurs** : `AxiosError` est remplace par un type `ApiError` custom :

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

Les helpers `handleApiError` et `handleApiErrorWith` sont preserves avec la meme signature externe (seul le type interne change).

**Contrainte CSRF** : le mecanisme de lecture du cookie `XSRF-TOKEN` et d'injection dans le header `X-XSRF-TOKEN` doit etre rigoureusement preserve — c'est un element de securite critique.

---

### 4. Remplacement `envalid` → `zod` (backend)

**Usage actuel** (`src/util/validateEnv.ts`) :

```ts
import { cleanEnv, str, port } from "envalid";
export const env = cleanEnv(process.env, { ... });
```

**Remplacement** :

```ts
import { z } from "zod";
const envSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: z.coerce.number(),
  ...
});
export const env = envSchema.parse(process.env);
```

Zod leve une erreur explicite si une variable manque ou est mal typee — comportement identique a `cleanEnv`.

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
