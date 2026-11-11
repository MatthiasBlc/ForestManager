# Roadmap - Rework V2

La premiere case non cochee est le point de reprise. Phase B terminee : le code est autorise.

## Phase A - Etude (en cours)

- [x] A1 Lire l'application V1 (back, front, schema, infra, docs)
- [x] A2 Ranger la documentation dans `.claude/docs/` (V1 archivee, chantier V2 ouvert)
- [x] A3 Analyse V1 publiee en artefact (`archive/2-Analyse-V1.html`)
- [x] A4 CDC V2 brouillon 0.1 (`1-CDC-V2.md`)
- [x] A5 Journal des decisions ouvert (`3-Journal-des-Decisions.md`)
- [x] A6 **Relecture par le proprietaire** : analyse, CDC, decisions D01 a D16
- [x] A7 Reponses aux questions Q01 a Q16 (CDC S10)
- [x] A8 CDC 0.3 integrant les reponses ; toutes les decisions tranchees (D01 a D33)
- [x] A9 Revue du brainstorming : idees a impact sur le socle tranchees (D34 a D40)

## Phase B - Conception (artefacts a valider un par un)

- [x] B1 Modele de donnees V2 (`11-Modele-Donnees/`)
- [x] B2 Matrice des permissions (`12-Permissions`)
- [x] B3 Parcours utilisateurs, 17 parcours et 54 ecrans (`13-Parcours`)
- [x] B4a Direction visuelle : Braise en signature, Sous-bois et Potager en alternatives
- [x] B4 Design system : tokens, theme, accent d'espace, composants de base, app shell avec rail (artefact Design System) - valide le 2026-11-03 (ajustements possibles pendant les maquettes)
- [x] B5 Maquettes des ecrans : 4 canevas, 85 artboards, decisions D90 a D131 validees
- [x] B5b Traiter les ecarts des maquettes (`archive/16-Maquettes-ECARTS.md`) : design system, ecrans manquants, mise a jour des maquettes
- [x] B6 Architecture technique (`14-Architecture.md`)
- [x] B7 Plan de migration des donnees : sans objet (pas d'utilisateurs en V1, remise a zero)
- [x] B8 Plan de tests (`15-Plan-Tests.md`)
- [x] B9 **Validation finale du CDC 1.0** - feu vert pour coder (2026-11-05)

## Phase C - Realisation (detaillee a la fin de la phase B)

- [x] C1 Socle : monorepo, package partage, auth, espaces, membres, invitations (plan : `17-Plan-C1.md`)
  - [x] C1.0 Plan de C1 valide (D143 a D146, D147 ajoutee en C1.2)
  - [x] C1.1 Monorepo et outillage (suppression de la V1, tag `v1-final` deja pose)
  - [x] C1.2 Docker V2 et commandes
  - [x] C1.3 Package partage (erreurs, permissions, schemas, contrat de module)
  - [x] C1.4 Squelette API, Prisma du socle, seed, harnais de test
  - [x] C1.5 Comptes et sessions
  - [x] C1.6 Espaces et membres
  - [x] C1.7 Invitations
  - [x] C1.8 Registre de modules
  - [x] C1.9 Suppression du compte
  - [x] C1.10 CI V2 et deploy repris de la V1 (D147)
- [x] C2 Design system, app shell et ecrans du socle (plan : `18-Plan-C2.md`)
  - [x] C2.0 Plan de C2 (D154 a D157)
  - [x] C2.1 Outillage web
  - [x] C2.2 Composants du design system
  - [x] C2.3 Themes et preferences
  - [x] C2.4 App shell et registre web
  - [x] C2.5 Acces
  - [x] C2.6 Espaces, invitations, membres
  - [x] C2.7 Modules
  - [x] C2.8 Profil, apparence, compte
  - [x] C2.9 Coquille PWA
- [x] C3 Module recettes (plan : `19-Plan-C3.md`)
  - [x] C3.0 Plan de C3 (D160 a D162, a relire par le proprietaire)
  - [x] C3.1 Referentiels minimaux et domaine pur
  - [x] C3.2 Recettes simples
  - [x] C3.3 Revisions
  - [x] C3.4 Recettes composees
  - [x] C3.5 Partage
  - [x] C3.6 Adaptation et suggestions
  - [x] C3.7 Photos et avatars (MinIO)
  - [x] C3.8 Import
  - [x] C3.9 Mode cuisine et hors ligne
- [x] C4 Referentiels et admin (plan : `20-Plan-C4.md`)
  - [x] C4.0 Plan de C4 (D170 a D173)
  - [x] C4.1 Compte admin, 2FA, audit, shell
  - [x] C4.2 Modules : demandes et catalogue
  - [x] C4.3 Referentiels
  - [x] C4.4 Utilisateurs
  - [x] C4.5 Espaces et moderation
  - [x] C4.6 Journal d'audit, reglages, tableau de bord
  - [x] Revue visuelle de C4 dans Chrome (A01 a A13 hors A10, bureau et mobile), puis cloture
- [x] C5 Module planning + generation (plan : `21-Plan-C5.md`)
  - [x] C5.0 Plan de C5 (D180 a D185)
  - [x] C5.1 Socle du module, reglages
  - [x] C5.2 Calendrier et repas
  - [x] C5.3 Idees de repas
  - [x] C5.4 Profils de generation
  - [x] C5.5 Algorithme de generation (domaine pur)
  - [x] C5.6 Generer, garder, remplacer
  - [x] Revue visuelle de C5 dans Chrome (bureau et mobile), puis cloture (D186 : pas d'appui long sur un repas, PullToRefresh ; E2E 9 ecrit ; Planning "Disponible")
  - [x] Republier la page du modele de donnees (`11-Modele-Donnees/Modele-Donnees.html`, regeneree localement) a son URL, puis cocher C5
- [x] C6 Notifications, activite, temps reel, changelog (plan : `22-Plan-C6.md`)
  - [x] C6.0 Plan de C6 (D187 a D190 ; D190 a relire par le proprietaire)
  - [x] C6.1 Socle des notifications (centre, preferences, cloche)
  - [x] C6.2 Temps reel (SSE) [D188]
  - [x] C6.3 Fil d'activite
  - [x] C6.4 Evenements du socle, dont l'OWNER prevenu d'un acces de moderation [D172, D121] et les decisions sur les demandes de module (P09)
  - [x] C6.5 Evenements des modules (Recettes, Planning)
  - [x] C6.6 Changelog : A10, page Nouveautes, brouillon genere par la CI [D171, D187]
  - [x] Revue visuelle de C6 dans Chrome (bureau et mobile) et flux SSE a travers nginx
  - [x] Cloture de C6 : lignes "Notifications" de `13-Parcours.md` branchees ou reportees, scenario E2E des notifications, `14-Architecture.md` S6, page du modele de donnees regeneree et republiee, suite complete verte (`22-Plan-C6.md` S3)
- [x] C6b Recherche globale, export, widgets d'accueil [D189] (plan : `23-Plan-C6b.md`)
  - [x] C6b.0 Plan de C6b (D191 a D194 ; D191 et D194 a relire par le proprietaire)
  - [x] C6b.1 Recherche globale et CommandPalette [D191, D119]
  - [x] C6b.2 Export de ses recettes et d'un espace [D37, D192]
  - [x] C6b.3 Widgets d'accueil et feuille "Personnaliser" [D193]
  - [x] Revue visuelle de C6b dans Chrome (bureau et mobile)
  - [x] Cloture de C6b (`23-Plan-C6b.md` S3)
- [ ] C7 E2E complets, suivi d'erreurs, CI, preprod (plan : `24-Plan-C7.md`)
  - [x] C7.0 Plan de C7 (D195 a D198 ; D197 a relire par le proprietaire)
  - [x] C7.1 Socle E2E : workspace `e2e/`, `docker/compose.e2e.yml`, route de test, parcours 1 [D197, D79]
  - [ ] C7.2 Parcours du socle : 2, 8, 10, 11, 13, 15
  - [ ] C7.3 Parcours des Recettes : 3, 4, 5, 6, 7, 12
  - [ ] C7.4 Parcours du Planning, du temps reel et du clavier : 9, 14, 16
  - [ ] C7.5 Suivi d'erreurs : SDK Sentry front et back, tunnel, test depuis A13, compose Bugsink [D75, D179, D196]
  - [ ] C7.6 CI complete (couverture, cles i18n, job E2E) et premier passage sur GitHub (reporte depuis C1.10) [D78] ; puis etat ecrit et push : **changement d'ordinateur** [D198]
  - [ ] C7.7 Preprod, sur l'autre ordinateur : deploy par pull request vers `master`, verification, feuille de recette (`24-Plan-C7.md` S2)
  - [ ] A faire par le proprietaire avant le premier deploy preprod (a revoir ensemble) : secrets GitHub `MINIO_ACCESS_KEY` et `MINIO_SECRET_KEY` (exiges par `docker/deploy.sh`) [D167] ; sur une base deja creee, passer le Planning en "Disponible" dans A04 (le seed n'ecrit le statut qu'a la creation) ; stack Bugsink dans Portainer (`docker/bugsink/compose.yml`, livre en C7.5) et secret `DEV_SENTRY_DSN` (`SENTRY_DSN` pour la prod) [D196]
  - [ ] Cloture de C7 (`24-Plan-C7.md` S3)
- [ ] C8 Mise en prod V2 (autre ordinateur [D198])
  - [ ] `pg_dump` avant chaque deploy prod, garde 14 jours [D76] : absent de `ci.yml`, a ecrire avant la prod
  - [ ] A faire par le proprietaire (a revoir ensemble) : retirer la lecture publique des buckets V1 `forestmanager-images-preprod` / `-prod` (`mc anonymous set none`) [D167]
- [ ] C9 Module liste de courses (V2.1)
- [ ] Reimport du JSON d'export dans F-AJOUT-RECETTE (V2.1) [D192]
- [ ] E2E WebKit (Safari) (V2.1) [D195]
