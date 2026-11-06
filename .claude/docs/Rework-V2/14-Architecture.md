# Architecture technique V2

Statut : voir le journal des decisions. Decisions d'origine citees `Dxx` (journal), decisions nouvelles D70 a D76 en fin de document.
Ce document decrit la cible ; il ne decrit pas la V1. Il ne recopie pas le modele de donnees (voir B1).

## 1. Principes

- **Reecriture propre dans ce depot** [D25], meme stack que la V1 pour garder la maitrise : Express, Prisma, PostgreSQL, React, Vite, Tailwind.
- **Socle generique** [D40] : comptes, espaces, membres, permissions, invitations, modules, notifications, activite, recherche, administration. Le socle ne connait aucun module.
- **Tout module se branche par le registre** [D10, D33], Recettes compris.
- **Un seul contrat partage** entre API et web : schemas Zod, types, codes erreur, cles de permission, types de notification [D15].
- **Mobile first, installable, lisible hors ligne** [D35, D38].

## 2. Monorepo [D15, D70]

npm workspaces, un seul `package-lock.json` a la racine.

```
/
  apps/
    api/                      # Express 5 + Prisma
      src/
        core/                 # socle : ne connait aucun module
          auth/               # inscription, connexion, sessions, emails optionnels
          spaces/             # espaces, membres, roles, invitations (lien + username)
          modules/            # registre, acces accordes, demandes d'acces
          notifications/      # stockage, preferences, diffusion temps reel
          activity/           # fil d'activite
          search/             # recherche globale (agrege les fournisseurs des modules)
          exports/            # export perso et export d'espace
          admin/              # super admin (2FA, audit, referentiels, catalogue modules)
          http/               # app Express, middlewares (securite, CSRF, erreurs, validation)
          realtime/           # Socket.IO
          storage/            # MinIO (S3), URLs presignees
          mail/               # transport SMTP optionnel
        modules/
          recipes/            # module Recettes (fourni a tous les espaces)
          meal-plan/          # module Planning (+ generation)
          shopping/           # module Courses (V2.1)
        referentials/         # ingredients, unites, conversions, rayons, tags globaux
        server.ts
      prisma/
        schema.prisma         # un seul schema (Prisma multi-fichiers possible : prisma/schema/*.prisma)
        migrations/
        seed/                 # referentiels uniquement [D76]
      scripts/                # creation admin, donnees de demo (jamais en prod)
    web/                      # React + Vite
      src/
        app/                  # shell, routeur, providers, registre cote web
        core/                 # ecrans du socle : auth, espaces, membres, notifications, profil, admin
        modules/
          recipes/
          meal-plan/
          shopping/
        ui/                   # primitives shadcn/ui (copiees, themees par tokens) [D16]
        patterns/             # composites : RecipeCard, SpaceRail, MealSlot... (design system)
        i18n/                 # configuration i18next, chargement des namespaces
        pwa/                  # enregistrement du service worker, etat hors ligne
        lib/                  # client API, TanStack Query, utilitaires
      public/
  packages/
    shared/                   # importe par api ET web, sans dependance a Node ni au DOM
      src/
        schemas/              # Zod : un fichier par ressource (entrees + sorties)
        errors/               # codes erreur centralises + messages i18n par defaut
        permissions/          # cles de permission et matrice role -> permissions (B2)
        modules/              # types du contrat de module (manifestes)
        notifications/        # types de notification et d'activite declares par module
        i18n/                 # cles partagees (erreurs, noms de modules)
        units/                # conversion d'unites et mise a l'echelle (pure, testee)
    test-utils/               # fabriques de donnees de test partagees [D79]
  e2e/                        # Playwright [D77]
  docker/                     # Dockerfiles api, web ; compose dev, test, preprod, prod
  .github/workflows/
```

Regles :

- `packages/shared` est compile en ESM et consomme en source par Vite et par l'API (alias TypeScript `@fm/shared`). Aucune dependance lourde (Zod seulement).
- La logique metier pure (mise a l'echelle des recettes composees, conversions d'unites, calcul des permissions, algorithme de generation du planning) vit dans `shared` ou dans un dossier `domain/` du module, sans Express ni Prisma : c'est elle qui porte les tests unitaires.
- Un module ne s'importe jamais depuis un autre module. Il peut dependre du socle et de `shared`. Une dependance entre modules (Planning lit des recettes) passe par un **service expose** declare dans le manifeste (`provides` / `requires`).

## 3. Registre de modules [D10, D33, D40, D71]

### 3.1 Contrat d'un module

Chaque module exporte un **manifeste** type par `packages/shared/modules`. Le meme `code` sert cote API, cote web et en base (`SpaceModule.moduleCode`).

Cote API (`apps/api/src/modules/<code>/manifest.ts`) :

| Champ                             | Role                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `code`                            | Identifiant stable (`recipes`, `meal-plan`, `shopping`).                                                                      |
| `router`                          | Routeur Express monte sous `/api/v1/spaces/:spaceId/<code>/...` (et routes hors espace si besoin, ex. `/api/v1/recipes/:id`). |
| `permissions`                     | Cles declarees (`recipes.create`, `recipes.moderate`...) et role minimal par defaut (matrice B2).                             |
| `notificationTypes`               | Types declares (`recipes.suggestion.created`...) avec categorie et gabarit i18n.                                              |
| `activityTypes`                   | Types d'evenements du fil d'activite.                                                                                         |
| `settingsSchema`                  | Schema Zod des reglages du module dans un espace (ex. repas de la journee) [D11].                                             |
| `searchProvider`                  | Fonction de recherche pour la palette Ctrl K (resultats types, filtres par espaces visibles).                                 |
| `exportProvider`                  | Contribution a l'export d'espace et a l'export perso [D37].                                                                   |
| `onSpaceDeleted` / `onMemberLeft` | Crochets du cycle de vie (reprise des recettes d'un ancien membre [D18]).                                                     |
| `provides` / `requires`           | Services offerts a d'autres modules (Recettes fournit `recipes.read` au Planning).                                            |

Cote web (`apps/web/src/modules/<code>/manifest.tsx`) :

| Champ           | Role                                                                                   |
| --------------- | -------------------------------------------------------------------------------------- |
| `code`          | Meme code que l'API.                                                                   |
| `routes`        | Routes React Router chargees a la demande (`lazy`), sous `/s/:spaceId/<code>`.         |
| `nav`           | Entree de la barre du module et de la barre d'onglets (icone Lucide, cle i18n, ordre). |
| `widgets`       | Widgets proposes pour l'accueil (prochains repas, recettes recentes...).               |
| `i18n`          | Namespace de traduction du module, charge a la demande.                                |
| `commands`      | Actions de la palette Ctrl K ("Nouvelle recette").                                     |
| `settingsPanel` | Ecran de reglages du module dans les reglages de l'espace.                             |

### 3.2 Chargement par le socle

- **Statique a la compilation** : une liste `modules/index.ts` importe les manifestes. Pas de plugins charges a chaud (inutile pour un seul depot, et plus sur).
- Au demarrage, l'API valide les manifestes (codes uniques, permissions sans collision), monte les routeurs et enregistre les types de notification et d'activite. Les codes manquants en base sont ajoutes au catalogue `Module` avec le statut `COMING_SOON` ; un module retire du code reste en base avec le statut `RETIRED`.
- Middleware `requireModule(code)` sur chaque routeur de module : l'espace doit avoir le module **accorde et active** [D33] ; sinon `MODULE_001` (403).
- Middleware `requirePermission(key)` : calcule depuis le role du membre et la matrice partagee (B2). Le front utilise la meme fonction pour masquer ce qui est interdit.
- Cote web, le shell interroge `GET /api/v1/spaces/:id` qui renvoie les modules actifs : la navigation, la barre d'onglets et les widgets sont construits depuis le registre filtre par cette liste.

### 3.3 Recettes comme module

Recettes est un module comme les autres : son manifeste, ses routes, ses permissions. Il est simplement **accorde et active a la creation** de tout espace [D33]. Le socle n'importe jamais `modules/recipes`.

## 4. Conventions d'API [D72]

- **REST JSON**, prefixe versionne `/api/v1`. Ressources au pluriel, imbriquees par espace quand elles en dependent : `/api/v1/spaces/:spaceId/recipes`.
- **Validation** : chaque route declare ses schemas Zod (`params`, `query`, `body`, `response`) importes de `shared`. Les entrees inconnues sont refusees (`strict`). Les reponses sont typees ; en dev et en test, la reponse est validee contre son schema.
- **Format d'erreur unique** :
  ```json
  {
    "error": {
      "code": "RECIPE_004",
      "message": "Cette recette n'est pas visible dans cet espace.",
      "details": { "field": "spaceId" }
    }
  }
  ```
  Codes centralises dans `shared/errors` (prefixe par domaine : `AUTH_`, `SPACE_`, `MODULE_`, `RECIPE_`, `MEAL_`, `ADMIN_`, `VALIDATION_`), message par defaut en francais, cle i18n pour le front. Jamais de string literal d'erreur dans le code (regle V1 conservee).
- **Pagination par curseur** pour les listes qui grandissent (recettes, notifications, activite) : `?limit=30&cursor=<opaque>` -> `{ data, nextCursor }`. Offset seulement pour l'admin.
- **Filtres et tri** en query string valides par Zod ; recherche texte via PostgreSQL (`pg_trgm` + `unaccent`) pour les titres et les noms d'ingredients.
- **Idempotence** : les creations sensibles au double envoi (import, partage) acceptent un en-tete `Idempotency-Key` stocke 24 h.
- **Dates** en ISO 8601 UTC ; les dates de planning sont des dates sans heure (`YYYY-MM-DD`).
- **Langue** : l'API lit la langue du profil (ou `Accept-Language` avant connexion) pour les noms des referentiels traduits [D34].

## 5. Authentification et sessions [D13, D21]

- Sessions serveur en base (express-session + store PostgreSQL), cookie `httpOnly`, `secure`, `sameSite=lax`.
- Duree : **1 jour glissant**, **30 jours** avec "Rester connecte" [D13]. Rotation de l'identifiant de session a la connexion.
- Mots de passe : `argon2id` (ou bcrypt cout 12 si l'image Docker pose probleme), politique minimale 10 caracteres + controle des mots de passe faibles (liste locale).
- CSRF : double submit cookie, comme en V1.
- Rate limiting : connexion, inscription, mot de passe oublie, demandes d'acces aux modules, import par URL.
- **Admin isole** : `AdminUser`, session dediee de 30 min non glissante, **2FA TOTP obligatoire** (otplib), audit de chaque action, routes sous `/api/v1/admin`, rate limit renforce. Reprise de la V1.
- Emails [D21] : voir section 9.

## 6. Temps reel

- Socket.IO sur le meme serveur, authentifie par la session (meme cookie).
- Rooms : `user:<id>` (notifications) et `space:<id>` (activite, mises a jour du planning).
- **Rejoindre une room d'espace verifie l'appartenance** a chaque `join` (faille V1 corrigee) ; quitter ou etre exclu retire la socket de la room cote serveur.
- Les evenements transportent des identifiants et un type ; le client invalide les requetes TanStack Query concernees plutot que de recevoir des donnees completes.

## 7. Stockage des images

- MinIO (API S3) comme en V1 en preprod et prod, bucket prive ; RustFS (compatible S3) en dev, test et CI [D167].
- Envoi direct du navigateur par **POST signe** (60 s, 2 Mo, `image/webp` imposes par le stockage) vers `uploads/<userId>/<uploadId>.webp`, apres conversion en WebP et redimensionnement cote client ; l'API verifie (signature WebP, dimensions) en rattachant l'envoi [D167].
- Cles uniques par version : `recipes/<recipeId>/<uuid>.webp`, `users/<userId>/<uuid>.webp`, `spaces/<spaceId>/<uuid>.webp`.
- Lecture par URLs signees courtes (date de signature arrondie a l'heure, valables 2 h : cache du navigateur) [D167].
- Menage horaire : envois abandonnes et objets que la base ne reference plus ; photos des recettes supprimees depuis 30 jours [D22, D167].

## 8. Internationalisation [D34, D73]

- Front : **i18next + react-i18next**, un namespace par module et un pour le socle, charges a la demande ; pluriels et interpolation i18next ; dates, nombres et unites via `Intl`.
- Cles stables en anglais (`recipes.card.servings`), textes francais en V2.0. Un controle CI echoue si une cle utilisee manque dans la langue de reference.
- Referentiels globaux traduits en base (ingredients, unites, rayons, tags globaux) : l'API renvoie le nom dans la langue du profil, avec repli sur le francais.
- Les noms des modules et leurs descriptions sont des cles i18n (le module est du code), pas des donnees.

## 9. Emails optionnels [D21]

- Transport SMTP (nodemailer) configure par variables d'environnement. **Si `SMTP_URL` est absent, l'application demarre** : verification d'email desactivee, "Mot de passe oublie" masque cote front (l'API expose `GET /api/v1/config` avec `features.email: false`), reinitialisation par un super admin.
- Gabarits en texte + HTML simple, traduits par cles i18n.

## 10. PWA et hors ligne [D35, D74]

- **vite-plugin-pwa** (Workbox) : manifest (nom, icones, couleur de theme Braise, `display: standalone`), service worker genere.
- Strategie de cache :
  - coquille de l'application (JS, CSS, polices) : precache, mise a jour au rechargement avec un bandeau "Nouvelle version disponible" ;
  - images : `CacheFirst` avec limite de taille et d'age ;
  - API : **aucune mise en cache par le service worker** ; le hors ligne des donnees passe par TanStack Query.
- **TanStack Query persiste** dans IndexedDB : les recettes ouvertes et le planning de la semaine sont gardes (age max 14 jours) et lisibles sans reseau.
- Hors ligne, les mutations sont **desactivees** dans l'interface avec un bandeau "Hors ligne" ; pas de file d'attente de modifications (D35 : lecture seule).
- Mode cuisine : Screen Wake Lock API quand elle est disponible.

## 11. Securite

Reprise de la V1 (helmet, CSP, CSRF, rate limiting, validation stricte, limite de taille des corps, sessions en base, audit admin), plus :

- verification d'appartenance a chaque `join` de room Socket.IO ;
- **anti-SSRF de l'import par URL a chaque redirection** : redirections suivies a la main (5 max), resolution DNS et refus des IP privees, locales, link-local et metadata a chaque saut, delai et taille bornes ;
- recherche d'utilisateurs non enumerable : invitation par username exact seulement [D07] ;
- liens d'invitation : jeton aleatoire de 128 bits, stocke hache, expiration et nombre d'usages [D07] ;
- en-tetes de securite stricts sur le web (CSP sans `unsafe-inline` grace au build Vite).

## 12. Observabilite [D75]

Journaux structures **pino** conserves (JSON en prod, lisibles en dev), identifiant de requete propage. Pour le suivi d'erreurs, comparaison d'outils gratuits :

| Outil                        | Mode                                  | Cout                                         | Ce qu'il faut heberger                   | Pour / contre                                                                                                                                |
| ---------------------------- | ------------------------------------- | -------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sentry** (offre Developer) | SaaS                                  | Gratuit, quota mensuel limite, 1 utilisateur | Rien                                     | SDK de reference, interface complete. Compte chez un tiers, quota a surveiller ; verifier au moment du choix qu'aucune carte n'est demandee. |
| **GlitchTip**                | Auto-heberge (ou SaaS gratuit limite) | Gratuit                                      | Web + worker + PostgreSQL + Valkey/Redis | Compatible avec les SDK Sentry. Plusieurs conteneurs, environ 0,5 a 1 Go de RAM.                                                             |
| **Bugsink**                  | Auto-heberge                          | Gratuit (usage perso)                        | Un seul conteneur (SQLite ou PostgreSQL) | Compatible avec les SDK Sentry, tres leger, simple sous Portainer. Interface plus sobre.                                                     |

Proposition : **SDK Sentry dans le code** (front et back, protocole standard) et **Bugsink auto-heberge** sur l'infrastructure existante. Aucune donnee chez un tiers, aucune carte, un conteneur de plus. Changer d'outil ne demande que de changer le DSN.

## 13. CI/CD [D76]

- **Branches** : `Developement` = travail ; `master` = prod. Push sur `Developement` -> tests + build + **deploy preprod**. Merge sur `master` -> tests + build + **deploy prod**.
- **Pipeline** : lint, typecheck, tests unitaires et d'integration (PostgreSQL de service), tests de composants, E2E (voir plan de tests), build des images, push, deploy Portainer, generation du changelog.
- **Images taguees** `vX.Y.Z` et `sha-<court>` (plus `latest` pour Portainer) : on sait ce qui tourne et on peut revenir a la version precedente en changeant le tag.
- **Base de donnees** : `pg_dump` automatique avant chaque deploy prod (conserve 14 jours), puis `prisma migrate deploy`. Le deploy echoue proprement si la migration echoue.
- **Seed** : uniquement les referentiels (unites, conversions, rayons, tags globaux, catalogue de modules), idempotent (upsert). Donnees de demo dans un script separe, jamais lance en prod.
- **Remise a zero avant la V2** [D23] : nouvelle base, nouvelle stack Portainer, ancien code V1 supprime du depot a la fin du chantier.

## 14. Versions cibles

Relevees sur le registre npm le 2026-11-03. A reverifier au demarrage du code ; on prend la derniere version stable publiee depuis au moins deux semaines.

| Paquet                      | Version cible                                 | Remarque                                                                                     |
| --------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Node.js                     | 22 LTS (ou 24 LTS si disponible au demarrage) | Comme la V1.                                                                                 |
| typescript                  | 6.0.x                                         | La 7.0 existe, mais `typescript-eslint` ne supporte que `<6.1` : on reste en 6.0 [Q-ARCH-3]. |
| react / react-dom           | 19.3.x                                        | Passage de 18 a 19.                                                                          |
| react-router                | 8.5.x                                         | Mode bibliotheque (routes declarees par les modules).                                        |
| vite                        | 8.3.x                                         |                                                                                              |
| tailwindcss                 | 4.3.x                                         | Tokens en variables CSS (design system).                                                     |
| shadcn (CLI)                | 4.23.x                                        | Composants copies dans `apps/web/src/ui`.                                                    |
| lucide-react                | 1.67.x                                        |                                                                                              |
| @tanstack/react-query       | 5.105.x                                       | + persisteur IndexedDB.                                                                      |
| react-hook-form             | 7.91.x                                        | Avec les schemas Zod partages.                                                               |
| i18next / react-i18next     | 26.7.x / 17.1.x                               |                                                                                              |
| vite-plugin-pwa             | 2.0.x                                         | Compatible Vite 8.                                                                           |
| express                     | 5.3.x                                         | Passage de 4 a 5 (erreurs async gerees nativement).                                          |
| prisma / @prisma/client     | 7.10.x                                        | Le tag `latest` npm pointe sur une 8.0 rc : on prend la derniere 7 stable [Q-ARCH-3].        |
| zod                         | 4.6.x                                         |                                                                                              |
| socket.io                   | 4.8.x                                         |                                                                                              |
| pino                        | 10.4.x                                        |                                                                                              |
| helmet / express-rate-limit | 8.3.x / 8.7.x                                 |                                                                                              |
| @aws-sdk/client-s3          | 3.x recent                                    | MinIO.                                                                                       |
| nodemailer                  | 10.x                                          | Emails optionnels.                                                                           |
| otplib                      | 13.6.x                                        | 2FA admin.                                                                                   |
| vitest                      | 5.1.x                                         |                                                                                              |
| @playwright/test            | 1.64.x                                        | + `@axe-core/playwright` 4.14.x.                                                             |
| msw                         | 3.0.x                                         | Mocks reseau des tests de composants.                                                        |
| @sentry/node, @sentry/react | 11.x                                          | SDK seulement (voir section 12).                                                             |

## 15. Decisions proposees

| #   | Decision                                                                                                                                                                                                                                                                               | Statut  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| D70 | Monorepo npm workspaces `apps/api`, `apps/web`, `packages/shared`, `packages/test-utils`, `e2e/` ; la logique metier pure vit dans `shared` ou `domain/` sans Express ni Prisma.                                                                                                       | VALIDEE |
| D71 | Registre de modules statique : un manifeste API + un manifeste web par module (routes, permissions, notifications, activite, reglages, recherche, export, widgets, navigation) ; `requireModule` et `requirePermission` sur chaque route ; un module n'importe jamais un autre module. | VALIDEE |
| D72 | API REST `/api/v1`, schemas Zod partages en entree et en sortie, format d'erreur unique `{ error: { code, message, details } }`, codes centralises, pagination par curseur.                                                                                                            | VALIDEE |
| D73 | i18next + react-i18next, namespaces par module, cles anglaises stables, controle CI des cles manquantes ; referentiels traduits servis dans la langue du profil.                                                                                                                       | VALIDEE |
| D74 | PWA par vite-plugin-pwa ; le service worker ne met en cache que la coquille et les images ; les donnees hors ligne passent par TanStack Query persiste en IndexedDB ; mutations desactivees hors ligne.                                                                                | VALIDEE |
| D75 | Suivi d'erreurs : SDK Sentry dans le code, Bugsink auto-heberge comme recepteur.                                                                                                                                                                                                       | VALIDEE |
| D76 | CI/CD : preprod au push sur `Developement`, prod au merge sur `master`, images taguees version + SHA, sauvegarde `pg_dump` avant chaque deploy prod, seed limite aux referentiels.                                                                                                     | VALIDEE |

## 16. Questions pour le proprietaire

- **Q-ARCH-1 Suivi d'erreurs** : (a) Bugsink auto-heberge, un conteneur [recommande] ; (b) Sentry SaaS offre gratuite ; (c) GlitchTip auto-heberge ; (d) rien en V2.0, journaux pino seulement.
- **Q-ARCH-2 Framework HTTP** : (a) Express 5, continuite avec la V1 [recommande] ; (b) Fastify (plus rapide, validation de schemas native) ; (c) Hono (leger, moderne).
- **Q-ARCH-3 Versions majeures** : (a) prendre les dernieres stables compatibles entre elles (TypeScript 6.0, Prisma 7, React 19, Express 5) [recommande] ; (b) attendre les toutes dernieres majeures (TypeScript 7, Prisma 8) quitte a decaler le demarrage.
- **Q-ARCH-4 Images des espaces prives** : (a) URLs presignees courtes [recommande, contenu prive] ; (b) bucket public avec chemins non devinables (plus simple, cache plus efficace). Tranche : (a), avec signature arrondie a l'heure pour le cache [D167].
