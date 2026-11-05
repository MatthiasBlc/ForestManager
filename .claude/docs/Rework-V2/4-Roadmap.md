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

- [ ] C1 Socle : monorepo, package partage, auth, espaces, membres, invitations (plan : `17-Plan-C1.md`)
  - [x] C1.0 Plan de C1 valide (D143 a D146, D147 ajoutee en C1.2)
  - [x] C1.1 Monorepo et outillage (suppression de la V1, tag `v1-final` deja pose)
  - [x] C1.2 Docker V2 et commandes
  - [x] C1.3 Package partage (erreurs, permissions, schemas, contrat de module)
  - [x] C1.4 Squelette API, Prisma du socle, seed, harnais de test
  - [x] C1.5 Comptes et sessions
  - [x] C1.6 Espaces et membres
  - [x] C1.7 Invitations
  - [ ] C1.8 Registre de modules
  - [ ] C1.9 Suppression du compte
  - [ ] C1.10 CI V2 et deploy repris de la V1 (D147)
- [ ] C2 Design system et app shell
- [ ] C3 Module recettes (+ revisions, partage, adaptation, suggestions, import)
- [ ] C4 Referentiels et admin
- [ ] C5 Module planning + generation
- [ ] C6 Notifications, activite, changelog
- [ ] C7 E2E complets, preprod, remise a zero de la base et de la stack de prod
- [ ] C8 Mise en prod V2
- [ ] C9 Module liste de courses (V2.1)
