# Plan C7 - E2E complets, suivi d'erreurs, CI, preprod

Statut : voir le journal (D195 a D198). Les sous-etapes sont des cases dans `4-Roadmap.md`.
References : `15-Plan-Tests.md` (S4 parcours, S5 donnees, S6 CI, S7 couverture, S8 a S10), `14-Architecture.md` S12 et S13, scenarios deja ecrits (`21-Plan-C5.md` S4 parcours 9, `22-Plan-C6.md` S4 parcours 16, `23-Plan-C6b.md` S4 parcours 14 et export du parcours 11), `.github/workflows/ci.yml`, `docker/deploy.sh`, `docker/compose.preprod.yml`, journal D23, D75, D76, D78, D79, D143, D147, D167, D179.

## 1. Perimetre

**Dans C7** : les 16 parcours E2E de `15-Plan-Tests.md` S4 codes et joues (Playwright + axe), la stack E2E et la route de test [D79], le suivi d'erreurs (SDK Sentry, Bugsink) [D75, D179], les controles de CI encore absents (couverture, cles i18n, E2E) [D78], le premier passage de la CI sur GitHub, puis le premier deploy de preprod et sa recette.

**Hors C7** :

- WebKit (Safari) : reporte en V2.1 [D195]. Chromium seul, mobile et desktop.
- Mise en prod, `pg_dump` avant deploy prod [D76], buckets V1 rendus prives : C8.
- Tests manuels sur de vrais telephones (`15-Plan-Tests.md` S10) : feuille de recette jouee sur la preprod en C7.7, rejouee avant la prod en C8.

**Deux postes** [D198] : tout ce qui pousse vers Portainer (preprod comme prod) se fait depuis l'autre ordinateur du proprietaire. C7.1 a C7.6 se font ici et ne touchent ni Portainer ni `master` ; C7.6 se termine par l'etat ecrit dans le `README.md` et un push. C7.7 reprend la-bas.

## 2. Decoupage [D198]

Outillage, Docker et CI sont hors TDD [D151] ; la route de test et le suivi d'erreurs sont du code d'application, ecrits test d'abord.

### C7.1 Socle E2E [D197]

- Workspace `e2e/` [D70] : `@playwright/test` et `@axe-core/playwright` (versions de `14-Architecture.md` S14, regle des deux semaines), projets `mobile` (Chromium, 390x844, par defaut) et `desktop` (Chromium, 1280x800, parcours marques (D)).
- Stack `docker/compose.e2e.yml`, projet compose `forestmanager-e2e` : PostgreSQL 17 et RustFS en tmpfs, API (image dev, `NODE_ENV=test`), front **en image prod** (nginx, bundle de production : service worker, CSP et proxy SSE reels), conteneur Playwright officiel qui vise le nginx. Scripts racine `npm run e2e` et `e2e:down`. Pas de SMTP (verification d'email sautee, D21).
- Route de test [D79] : `POST /api/v1/__test/scenario` (cree les donnees d'un parcours par les fabriques et rend les identifiants utiles) et `POST /api/v1/__test/reset` (base videe hors referentiels, comme entre deux fichiers d'integration). Montees seulement si `NODE_ENV=test` ; un test prouve leur absence (404) en production. Les fabriques pures de `packages/test-utils` grandissent (recette, recette composee, repas) ; celles d'`apps/api/test/helpers` servent a l'enregistrement.
- Aides Playwright : connexion par la route de test (cookie de session pose sans passer par le formulaire, sauf parcours 1 et 13), `expectNoA11yViolations` (axe, "serious" et "critical"), echec sur toute erreur de console, horloge figee par `page.clock` quand le parcours depend de la date.
- A regler ici : limites de debit desactivees ou relevees en test, anti-SSRF de l'import (le serveur de fixtures est sur une IP privee : hote autorise par une variable lue seulement en test), code TOTP du parcours 13 calcule dans le test.
- Preuve : parcours 1 (inscription, espace perso, premiere recette) vert en mobile et desktop.

### C7.2 Parcours du socle

Parcours 2 (invitation par lien, deux contextes), 8 (demande du Planning, admin, activation) (D), 10 (depart d'un membre), 11 (export Markdown avec photos, suppression, restauration ; `23-Plan-C6b.md` S4), 13 (admin 2FA, fusion d'ingredients) (D), 15 (apparence persistante).

### C7.3 Parcours des Recettes

Parcours 3 (partage), 4 (suggestion acceptee puis refusee), 5 (adaptation, badge, comparaison), 6 (recette composee, lien vivant), 7 (import par URL depuis `apps/api/test/fixtures/import/`), 12 (hors ligne : `context.setOffline`, service worker enregistre, coquille chargee sans reseau).

### C7.4 Parcours du Planning, du temps reel et du clavier

Parcours 9 (`21-Plan-C5.md` S4), 14 (`23-Plan-C6b.md` S4) (D), 16 (`22-Plan-C6.md` S4, deux contextes, vrai flux SSE par nginx).

Un parcours qui revele un defaut : le defaut est corrige en TDD au niveau le plus bas qui le prouve (integration ou composant), le parcours reste comme preuve d'ensemble.

### C7.5 Suivi d'erreurs [D196]

- API : `@sentry/node`, initialise seulement si `SENTRY_DSN` est defini (variable facultative de `env.ts`) ; erreurs 5xx et rejets non geres, jamais les erreurs metier (4xx) ; version = celle de `release.json`, environnement = preprod ou production. Aucune donnee personnelle : ni corps de requete, ni cookies, ni en-tetes d'authentification, ni IP ; l'utilisateur n'est qu'un UUID.
- Web : `@sentry/react` charge a la demande, actif si `GET /api/v1/config` annonce `features.errorTracking` ; envoi par un **tunnel** de l'API (`POST /api/v1/monitoring`, corps borne, rate limit) qui relaie vers Bugsink. Le front ne connait pas le DSN, la CSP ne change pas, une seule image sert la preprod et la prod.
- A13 : "Suivi d'erreurs" passe de "Pas encore branche" a l'etat reel (hote du DSN, jamais la cle) ; "Tester" envoie un evenement de test et dit s'il a ete accepte [D179].
- Infra : `docker/bugsink/compose.yml` (un conteneur, Traefik, volume) et sa notice ; un seul Bugsink pour les deux environnements, un projet par environnement. Secrets GitHub facultatifs `DEV_SENTRY_DSN` (preprod) et `SENTRY_DSN` (prod), passes par `deploy.sh` sans etre exiges : sans DSN, le suivi est coupe et rien ne casse.
- Tests : faux recepteur local (integration API), composant A13, aucun appel a Internet.

### C7.6 CI complete et premier passage [D78, D197]

- Couverture (`@vitest/coverage-v8`) : seuils de `15-Plan-Tests.md` S7 par projet. Zone sous le seuil : tests ajoutes la ou un comportement n'est pas prouve ; sinon seuil pose au niveau mesure, arrondi en dessous, et ecart note dans le plan de tests (pas de test ecrit pour le chiffre).
- Cles i18n : controle des cles utilisees absentes des ressources `fr` (script ou typage, selon ce que `apps/web/src/i18n` permet deja), bloquant.
- Job `e2e` dans `ci.yml` (apres `verify`, avant `build`) : `npm run e2e`, traces, captures et videos des echecs gardees 7 jours.
- `14-Architecture.md` S13 et `15-Plan-Tests.md` S2 et S6 alignes sur ce qui tourne.
- Premier passage sur GitHub : push de la branche de travail (verification et build, aucune image poussee, aucun deploy), corrections jusqu'au vert.
- **Point d'arret** : etat ecrit dans le `README.md` (section "Reprise"), tout committe et pousse. Suite sur l'autre ordinateur.

### C7.7 Preprod (autre ordinateur)

- Revue avec le proprietaire de ses actions (liste : `4-Roadmap.md` sous C7) : secrets GitHub `MINIO_ACCESS_KEY` et `MINIO_SECRET_KEY`, stack Bugsink et `DEV_SENTRY_DSN`, branche de la pull request vers `master`.
- Pull request vers `master` : images poussees, deploy de la stack de preprod existante [D147] ; base neuve sur le volume `postgres17_data_dev` [D23, D145], l'ancien volume V1 reste en place jusqu'a C8.
- Verification : `/health`, migrations et seed au demarrage, compte super admin (`admin:create` dans le conteneur), Planning en "Disponible" dans A04, photo envoyee et relue (MinIO), export telecharge, flux SSE a travers Traefik, evenement de test recu par Bugsink depuis A13, brouillon de changelog cree [D187].
- Second deploy sur la meme base : seed rejoue sans doublon, session conservee.
- Feuille de recette manuelle (`15-Plan-Tests.md` S10) sur un vrai telephone.

## 3. Definition de fini de C7

- 16 parcours verts en local et en CI (mobile, et desktop pour les (D)), axe sans violation "serious" ou "critical" sur chaque ecran visite.
- CI verte de bout en bout sur GitHub : format, lint, typecheck, cles i18n, tests avec couverture, audit, E2E, build des images.
- Suivi d'erreurs branche et verifie sur la preprod ; coupe proprement sans DSN.
- Preprod deployee par la CI, verifiee et recettee ; redeploy sans perte.
- Docs a jour : `15-Plan-Tests.md`, `14-Architecture.md` S12 et S13, `README.md`, actions du proprietaire pour C8 dans `4-Roadmap.md`.
