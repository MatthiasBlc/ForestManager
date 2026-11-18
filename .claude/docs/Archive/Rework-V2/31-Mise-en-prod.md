# Mise en prod V2 (C8)

Deroule pas a pas du jour de la prod, depuis ce poste [D201]. Le proprietaire clique dans GitHub et Portainer ; les secrets ne passent jamais par Claude. Les cases de suivi restent dans `4-Roadmap.md` (C8) ; ce fichier porte le deroule et les points de controle.

## 1. Verifie avant le jour J (2026-11-17)

- Version : aucun tag `vX.Y.Z` encore pose, donc `release-notes.ts` sort `2.0.0` (`FIRST_VERSION`) ; l'image API embarque `release.json`, le `2.0.0-dev` du `package.json` ne sert qu'en dev et en test. Tag `v2.0.0` pose par le job `release-tag` apres le deploy prod.
- `compose.prod.yml` = `compose.preprod.yml` aux noms pres (conteneurs, reseau `internal`, volume `postgres17_data`), plus `BACKUP_DIR=/backups` sur le volume `postgres_backups`. `APP_URL`, bucket `forestmanager-images-prod`, `SENTRY_ENVIRONMENT=production`, routeur Traefik `forestmanager-web` : coherents.
- Base neuve [D23] : volume `postgres17_data` vide, l'ancien volume V1 (PostgreSQL 15) reste en place, inutilise.
- Sauvegarde : `/backups` cree dans l'image avec `chown node` et client `postgresql17-client` ; un echec du dump arrete l'API avant les migrations. Jamais execute en vrai : premier passage = premier deploy prod.
- Job `deploy-prod` : memes variables que la preprod avec les secrets de prod (`STACK_ID`, `SENTRY_DSN`, `DISCORD_CLIENT_ID` / `_SECRET`).

## 2. Avant la fusion

1. CI de la PR #35 verte sur le dernier commit (preprod deployee).
2. Menage, premier passage a blanc : relire le log du job `registry-prune` (le proprietaire le colle, l'API publique ne donne pas les logs) :
   - par image (`backend`, `frontend`) : `gardes :` contient `latest`, le tag deploye et 10 `sha-*` ; les `supprimerait` sont les plus anciens ;
   - etape serveur : nombre d'images supprimees et espace libere (images de plus de 72 h portant le label `forestmanager.image`).
3. Log juge bon : retirer `DRY_RUN: 1` de `.github/workflows/ci.yml` (job `registry-prune`), commit, push ; le passage suivant supprime pour de vrai.
   - Fait le 2026-11-17 (CI #34) : par image, gardes = `latest` et les 10 `sha-*` du 2026-11-12 15:57 a ce jour, 8 a supprimer (2026-11-12, 09:39 a 15:21) ; serveur : 0 image (le label date de `841253e`, moins de 72 h). Dans les logs, les `***` sont des `2` masques par GitHub (un secret vaut `2`).
   - Premier passage reel (CI #35, 2026-11-17, vert) : 9 tags supprimes par image (les 8 du passage a blanc et `sha-7c3fc47`, sorti des 10 avec le nouveau tag), aucun echec ; gardes = `latest` et 10 `sha-*` dont `sha-3c2a06d` deploye. Espace libere seulement au `garbage-collect` du registry (S6).
4. Secrets de prod presents dans GitHub (proprietaire) : `STACK_ID`, `SENTRY_DSN` (projet Bugsink de prod), `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`, plus les communs.

## 3. Fusion et deploy

1. Le proprietaire fusionne la PR #35 (`Developement` -> `master`).
2. Suivi de la CI du push sur `master` : `verify`, tests, `e2e`, `build` (tags `sha-<court>` et `latest`), `deploy-prod` (attend `/api/v1/config` en 200), `registry-prune`, `release-tag`.
3. Logs du conteneur `forestmanager-backend` (Portainer) : `Backup: /backups/fm-...dump` puis `Backup done`, migrations appliquees, seed, serveur demarre.

## 4. Verification de la prod

- `https://forestmanager.matthias-bouloc.fr` : page de connexion, `GET /api/v1/config` en 200, version `2.0.0`.
- Inscription d'un compte, espace perso, creation d'une recette avec photo (bucket de prod), planning.
- Connexion par Discord (vrai aller-retour) : lignes `acc-discord-*` et `acc-sans-mdp` de la feuille de recette.
- Admin : compte super admin de prod a creer comme en preprod (`npm run admin:create -w @fm/api` dans la console du conteneur `forestmanager-backend`, Portainer), 2FA a la premiere connexion ; Planning en "Disponible" dans A04.
- Bugsink : une erreur de test remonte dans le projet de prod.
- Tag `v2.0.0` present sur GitHub, brouillon du changelog cree par le seed.

## 5. Retour arriere

- Pas de retour a la V1 (autre compose, autre base) : on corrige en avant.
- Image : redeployer un tag `sha-*` precedent (`TAG=sha-... docker/deploy.sh`, ou relancer le job d'un commit anterieur).
- Base : `pg_restore` du dump `fm-*.dump` pris au demarrage, dans le volume `postgres_backups`.

## 6. Menage apres la prod (proprietaire, non bloquant)

- Registry : `garbage-collect` en tache planifiee de nuit (registry en lecture seule pendant le collect), sans `--delete-untagged` tant que des tags gardes sont d'anciennes images avec index et attestations (toutes celles d'avant `841253e`, dont l'actuel `latest`) : il effacerait leurs sous-images. Sans risque une fois `latest` et les 10 `sha-*` gardes construits en `provenance: false`, soit environ 10 deploys apres `841253e`.
- Registry : `REGISTRY_HTTP_DEBUG_ADDR` a retirer du reseau `proxy`.
- Serveur : images d'avant le label `forestmanager.image` (V1 et premiers builds V2) a retirer a la main une fois.
- Traefik : `trustedIPs` pour la vraie IP derriere Cloudflare (`14-Architecture.md` S13).
- Buckets V1 : `mc anonymous set none` sur `forestmanager-images-preprod` / `-prod` [D167].

## 7. Bilan du 2026-11-17

- PR #35 fusionnee (`cc43aff`), CI #36 verte en ~12 min 30 : `deploy-prod`, `registry-prune`, `release-tag` (`v2.0.0`).
- Demarrage de l'API : `Backup done (4.0K)` (base neuve), 15 migrations appliquees, seed (16 unites, 10 rayons, catalogue des modules, brouillon de changelog `2.0.0` vide : premiere version, pas de commits de reference), `API ready`.
- `/api/v1/config` : `release 2.0.0`, `environment production`, uploads, Bugsink et Discord actifs, email non configure (prevu).
- Compte du proprietaire cree par Discord (mot de passe et email aussi) ; super admin cree, 2FA configuree ; tableau de bord admin : Bugsink et stockage en ligne, version `2.0.0`.
- Controles de Claude dans Chrome : accueil sans erreur console, notifications, flux SSE a travers Cloudflare et Traefik, recette "Test prod - tarte aux tomates" avec photo (ingredient, recette, photo en 201/201/200, photo relue depuis le bucket de prod).
- Evenement de test Bugsink recu dans le projet de prod.
- A noter : les logs JSON de l'API sont mal rendus par la vue de logs de Portainer (affichage seulement) ; `x-real-ip` = IP interne de Traefik tant que `trustedIPs` n'est pas regle (S6).
