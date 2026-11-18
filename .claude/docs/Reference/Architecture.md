# Architecture technique

Les choix et les regles. Le code fait foi pour le reste [D221] : arborescence, versions (`package.json`), schema (`apps/api/prisma/schema.prisma`), routes (`routes.ts`), CI (`.github/workflows/ci.yml`). Le debat de chaque choix est dans le journal (`D##`).

## 1. Principes

- **Reecriture propre dans ce depot** [D25] : Express 5, Prisma, PostgreSQL 17, React 19, Vite, Tailwind ; Node 22 sans build de l'API (types effaces nativement).
- **Socle generique** [D40] : comptes, espaces, membres, permissions, invitations, modules, notifications, activite, recherche, export, administration. Le socle ne connait aucun module.
- **Tout module se branche par le registre** [D10, D33], Recettes compris.
- **Un seul contrat partage** entre API et web dans `packages/shared` : schemas Zod, codes erreur, permissions, contrat de module, unites [D15].
- **Mobile first, installable, lisible hors ligne** [D35, D38].

## 2. Organisation du depot [D15, D70]

npm workspaces : `apps/api`, `apps/web`, `packages/shared`, `packages/test-utils`, `e2e/` ; `docker/` pour les images et les compose.

- `apps/api/src/core/` : le socle ; `apps/api/src/modules/<code>/` : un dossier par module ; `apps/api/src/referentials/` : ingredients, unites, conversions, rayons, tags globaux.
- `apps/web/src/core/` : ecrans du socle ; `modules/<code>/` : ecrans des modules ; `ui/` : primitives du design system ; `patterns/` : composites (rail, selecteur d'espaces...) ; `styles/` : jetons et styles des composants (font foi pour le design system).
- `packages/shared` est consomme en source par l'API et Vite (`@fm/shared`), sans dependance lourde (Zod seulement).
- La logique metier pure (mise a l'echelle, conversions, permissions, generation du planning, filtre des tags) vit dans `shared` ou dans le module, sans Express ni Prisma : c'est elle qui porte les tests unitaires.
- **Un module n'importe jamais un autre module.** Une dependance (le Planning lit des recettes) passe par un service declare (`provides` / `requires`, contrats dans `apps/api/src/modules/services.ts`).

## 3. Registre de modules [D10, D33, D40, D71]

- **Contrat** : `ModuleDefinition` dans `packages/shared/src/modules/` (code, permissions, categories et types de notification, types d'activite), etendu cote API (`ApiModule` de `core/modules/registry.ts` : catalogue, routeur, roles reglables, services, crochets du cycle de vie) et cote web (manifeste du module : navigation, routes, recherche, widgets, liens de reglages...). Le meme `code` sert en base (`SpaceModule.moduleCode`).
- **Statique a la compilation** : `modules/index.ts` importe les manifestes, pas de plugin charge a chaud.
- Au demarrage, l'API valide les manifestes (codes uniques, cles prefixees, sans collision) et aligne le catalogue `Module` (un code nouveau entre avec le statut de son manifeste, un code retire passe `RETIRED`).
- `requireModule` sur chaque routeur de module : module **accorde et active** dans l'espace [D33], sinon `MODULE_001`. Les permissions se calculent depuis le role et la matrice partagee (`Permissions.md`), avec les roles minimaux reglables par espace [D58, D141] ; le front utilise la meme fonction pour masquer ce qui est interdit.
- Recettes est un module comme les autres, **accorde et active a la creation** de tout espace et toujours actif [D33, D91].

## 4. Conventions d'API [D72]

- **REST JSON** sous `/api/v1`, ressources imbriquees par espace quand elles en dependent (`/api/v1/spaces/:spaceId/recipes`).
- **Validation** : chaque route declare ses schemas Zod (`params`, `query`, `body`) importes de `shared` ; entrees inconnues refusees (`strict`) ; reponses validees contre leur schema.
- **Erreur unique** : `{ "error": { "code", "message", "details" } }`. Codes centralises dans `packages/shared/src/errors/` (prefixe par domaine), message francais par defaut, cle i18n pour le front. Jamais de string literal d'erreur. Un non-membre recoit `SPACE_001` (404) comme un espace inexistant.
- **Pagination par curseur** (`?limit=&cursor=` -> `{ data, nextCursor }`, `total` sur la premiere page des recettes) ; offset seulement dans l'admin.
- **Recherche texte** par PostgreSQL (`pg_trgm` + `unaccent`).
- **Dates** en ISO 8601 UTC ; dates de planning sans heure (`YYYY-MM-DD`).
- **Langue** : noms des referentiels traduits selon la langue du profil, repli sur le francais [D34].

## 5. Authentification et sessions [D13, D21, D202]

- Sessions serveur en base, cookie `httpOnly`, `secure`, `sameSite=lax` ; **1 jour glissant**, **30 jours** avec "Rester connecte" ; identifiant renouvele a la connexion.
- Mots de passe `argon2id`, 10 a 128 caracteres ; connexion par email ou username.
- CSRF par double submit cookie ; limites de debit sur connexion, inscription, mot de passe oublie, lecture des nouveautes (ouverte sans connexion [D226]), demandes d'acces aux modules, import par URL, creations d'ingredients.
- **Connexion avec Discord** [D202, D210] facultative : sans `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`, `features.discord` vaut false et les boutons sont masques. Redirection declaree chez Discord : `<APP_URL>/api/v1/auth/discord/callback`.
- **Admin isole** : `AdminUser`, session dediee de 30 min non glissante, **2FA TOTP obligatoire**, audit de chaque action, routes sous `/api/v1/admin`.

## 6. Temps reel [D188]

- Server-Sent Events : `GET /api/v1/events`, authentifie par la session, battement toutes les 25 s qui ferme le flux si la session n'existe plus ; un `EventSource` par onglet, tout est relu apres une reconnexion.
- Destinataires lus en base a l'envoi (pas d'etat d'abonnement) : rejoindre, quitter ou etre exclu prend effet a l'evenement suivant.
- Deux evenements, identifiants seulement : `notification` et `invalidate` (`spaceId`, `module`) ; le client invalide les requetes TanStack Query concernees, groupees sur 150 ms.
- Diffusion en memoire (une instance d'API, 10 connexions au plus par utilisateur) ; PostgreSQL `LISTEN/NOTIFY` si plusieurs instances un jour. nginx : `/api/v1/events` sans tampon ni gzip.

## 7. Stockage des images [D167]

- MinIO (S3) en preprod et prod, bucket prive ; RustFS en dev, test et CI.
- Envoi direct du navigateur par **POST signe** (60 s, 2 Mo, `image/*`) apres conversion en WebP (JPEG sur Safari) et redimensionnement cote client ; l'API verifie en rattachant l'envoi.
- Lecture par URLs signees (signature arrondie a l'heure, valables 2 h, pour le cache du navigateur).
- Menage horaire : envois abandonnes, objets que la base ne reference plus, photos des recettes supprimees depuis 30 jours [D22].

## 8. Internationalisation [D34, D73]

- i18next + react-i18next, cles anglaises stables, textes francais en V2 ; la CI echoue si une cle utilisee manque.
- Referentiels globaux traduits en base ; noms des modules en cles i18n (le module est du code).

## 9. Emails optionnels [D21]

- SMTP (nodemailer) par variables d'environnement. **Sans `SMTP_URL`, l'application demarre** : verification d'email desactivee, "Mot de passe oublie" masque (`GET /api/v1/config` : `features.email: false`), reinitialisation par un super admin.

## 10. PWA et hors ligne [D35, D74, D220]

- vite-plugin-pwa : manifeste, service worker ; la coquille est en precache, mise a jour proposee par un bandeau "Nouvelle version disponible" (pas forcee).
- L'API n'est jamais mise en cache par le service worker : les donnees hors ligne passent par TanStack Query persiste en IndexedDB (recettes ouvertes et planning, 14 jours). Hors ligne, les modifications sont desactivees (lecture seule).
- **Variante preprod** [D220] : le build ecrit `dist/preprod/` (nom "Forest Manager Preprod", icones a bandeau PREPROD) ; l'entrypoint nginx la sert si `WEB_VARIANT=preprod` (pose dans `docker/compose.preprod.yml`). Sans la variable : prod.
- Mode cuisine : Screen Wake Lock quand il est disponible.

## 11. Securite

- helmet, CSP sans `unsafe-inline`, CSRF, limites de debit, validation stricte, taille des corps bornee, sessions en base, audit admin.
- **Anti-SSRF de l'import par URL a chaque redirection** : redirections suivies a la main (5 max), refus des IP privees, locales, link-local et metadata a chaque saut, delai et taille bornes.
- Pas d'enumeration : invitation par username exact seulement [D07] ; liens d'invitation a jeton de 128 bits stocke hache, expiration et nombre d'usages.
- Temps reel : destinataires relus en base a chaque envoi (section 6).

## 12. Observabilite [D75, D196, D199]

- Journaux **pino** (JSON en prod), identifiant de requete propage.
- Suivi d'erreurs : SDK Sentry dans le code, **Bugsink auto-heberge** comme recepteur (`docker/bugsink/`), un projet par environnement. API : `@sentry/core`, actif seulement si `SENTRY_DSN` est defini ; 5xx et exceptions non gerees, jamais les 4xx ni de donnee personnelle. Web : charge a la demande si `features.errorTracking`, envoi par le tunnel `POST /api/v1/monitoring` (le front ne connait pas le DSN). Sans DSN, le suivi est coupe et rien ne casse.

## 13. CI/CD et infra [D76, D147, D201]

Chaine reprise de la V1 : memes secrets, registry, stacks Portainer, Traefik. Detail des jobs : `.github/workflows/ci.yml` ; detail des controles : `Plan-Tests.md`.

- **Declencheurs** : push sur une branche -> verification, tests, E2E, build sans pousser ; PR vers `master` -> idem, images poussees, **deploy preprod** ; push sur `master` -> idem, **deploy prod**, puis tag `v<version>` (version calculee depuis les commits conventionnels depuis le dernier tag, notes de version en brouillon embarquees [D187]).
- **Images** taguees `sha-<court>` (plus `latest` en prod), deployees par ce tag : retour arriere en changeant le tag. La meme image sert preprod et prod.
- **Menage des images** apres chaque deploy : le registry garde par image les 10 derniers `sha-*`, le tag deploye et les autres tags ; images construites sans attestation (`provenance: false`). Les blobs ne sont liberes que par le `garbage-collect` cote serveur (action du proprietaire, `../V2.2/Roadmap.md`). Serveur : images inutilisees de plus de 3 jours portant le label `forestmanager.image` supprimees par l'API Portainer.
- **Base** : au demarrage de l'image API, `pg_dump` (prod seulement, gardes 14 jours, un echec arrete le conteneur), puis `prisma migrate deploy`, puis seed. Restauration : `pg_restore --no-owner --clean --if-exists -d <base> fm-<date>.dump` (dump sur le meme serveur que la base : pas une sauvegarde hors site).
- **Seed** : referentiels (unites, conversions, rayons, tags globaux, catalogue des modules) et brouillon de changelog, **idempotent** (upsert, jamais de remise a zero) : preprod et prod sont persistantes.
- **IP des clients** : chaine Cloudflare, Traefik, nginx du front, API ; `TRUST_PROXY=3` en preprod et prod. **Reste a faire cote serveur (proprietaire)** : que Traefik fasse confiance a Cloudflare, sinon l'API voit l'IP du noeud Cloudflare (journal d'audit, sessions, limites de debit ; non bloquant). Dans la config statique de Traefik, sur l'entrypoint HTTPS (souvent `websecure`), puis redemarrer Traefik :

  ```yaml
  entryPoints:
    websecure:
      forwardedHeaders:
        trustedIPs: # https://www.cloudflare.com/ips (releve du 2026-11-17)
          - 173.245.48.0/20
          - 103.21.244.0/22
          - 103.22.200.0/22
          - 103.31.4.0/22
          - 141.101.64.0/18
          - 108.162.192.0/18
          - 190.93.240.0/20
          - 188.114.96.0/20
          - 197.234.240.0/22
          - 198.41.128.0/17
          - 162.158.0.0/15
          - 104.16.0.0/13
          - 104.24.0.0/14
          - 172.64.0.0/13
          - 131.0.72.0/22
          - 2400:cb00::/32
          - 2606:4700::/32
          - 2803:f800::/32
          - 2405:b500::/32
          - 2405:8100::/32
          - 2a06:98c0::/29
          - 2c0f:f248::/32
  ```

  En arguments de commande : meme liste separee par des virgules dans `--entrypoints.websecure.forwardedHeaders.trustedIPs=...`. Verification : connexion admin en preprod, la ligne "Connexion" du journal d'audit montre la vraie IP.

## 14. Versions

Les versions sont dans les `package.json` et les Dockerfiles. Regle : la derniere version stable publiee depuis au moins deux semaines, compatible avec le reste (exemple : TypeScript reste en 6.0 tant que typescript-eslint ne suit pas la 7). npm 11 obligatoire (`packageManager`).
