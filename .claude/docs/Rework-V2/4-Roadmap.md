# Roadmap - Rework V2

La premiere case non cochee est le point de reprise. **Aucune ligne de code applicatif avant la fin de la phase B.**

## Phase A - Etude (en cours)

- [x] A1 Lire l'application V1 (back, front, schema, infra, docs)
- [x] A2 Ranger la documentation dans `.claude/docs/` (V1 archivee, chantier V2 ouvert)
- [x] A3 Analyse V1 publiee en artefact (`2-Analyse-V1.html`)
- [x] A4 CDC V2 brouillon 0.1 (`1-CDC-V2.md`)
- [x] A5 Journal des decisions ouvert (`3-Journal-des-Decisions.md`)
- [x] A6 **Relecture par le proprietaire** : analyse, CDC, decisions D01 a D16
- [x] A7 Reponses aux questions Q01 a Q16 (CDC S10)
- [x] A8 CDC 0.3 integrant les reponses ; toutes les decisions tranchees (D01 a D33)

## Phase B - Conception (artefacts a valider un par un)

- [ ] B1 Modele de donnees V2 detaille (schema Prisma cible commente)
- [ ] B2 Matrice des permissions complete, par module
- [ ] B3 Parcours utilisateurs (inscription, recette, partage, suggestion, planning, courses)
- [x] B4a Direction visuelle : Braise en signature, Sous-bois et Potager en alternatives
- [ ] B4 Design system : tokens, theme, accent d'espace, composants de base, app shell avec rail (artefact Design System)
- [ ] B5 Maquettes des ecrans du CDC S5.4 (artefact Design)
- [ ] B6 Architecture technique : monorepo, registre de modules, contrats API
- [x] B7 Plan de migration des donnees : sans objet (pas d'utilisateurs en V1, remise a zero)
- [ ] B8 Plan de tests (integration, composants, E2E)
- [ ] B9 **Validation finale du CDC 1.0** - feu vert pour coder

## Phase C - Realisation (detaillee a la fin de la phase B)

- [ ] C1 Socle : monorepo, package partage, auth, espaces, membres, invitations
- [ ] C2 Design system et app shell
- [ ] C3 Module recettes (+ revisions, partage, copie, suggestions, import)
- [ ] C4 Referentiels et admin
- [ ] C5 Module planning + generation
- [ ] C6 Notifications, activite, changelog
- [ ] C7 E2E complets, preprod, remise a zero de la base et de la stack de prod
- [ ] C8 Mise en prod V2
- [ ] C9 Module liste de courses (V2.1)
