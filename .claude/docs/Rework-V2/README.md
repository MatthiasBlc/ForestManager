# Rework V2

Refonte de Forest Manager : clarifier les concepts de la V1, refaire l'interface (shadcn/ui + Tailwind), decider entre faire evoluer et reecrire.

## Ordre de lecture

1. Ce README.
2. `4-Roadmap.md` : la premiere case non cochee est le point de reprise.
3. `1-CDC-V2.md` : S1 a S3 (vision, glossaire, roles) pour tout le monde, puis la section du module concerne.
4. `3-Journal-des-Decisions.md` : seulement pour comprendre le pourquoi d'une regle (chercher le `D##`).
5. `2-Analyse-V1.html` : l'analyse de la V1. A ouvrir dans un navigateur ; ne pas la lire en entier comme contexte (c'est du HTML).

## Fichiers

| Fichier                                 | Role                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `1-CDC-V2.md`                           | Cahier des charges cible. La version est dans son en-tete.                                                |
| `2-Analyse-V1.html`                     | Copie locale de l'artefact d'analyse (lisible hors ligne).                                                |
| `3-Journal-des-Decisions.md`            | Decisions `D##` avec constat, options, choix, statut.                                                     |
| `4-Roadmap.md`                          | Phases et cases a cocher.                                                                                 |
| `5-Etude-Adaptations.md`                | Etude : adapter une recette a un espace (D17).                                                            |
| `6-Etude-Recettes-Composees.md`         | Etude : recettes a base de recettes (D24).                                                                |
| `7-Proposition-Recettes-Composees.html` | Maquette interactive des recettes composees (D24).                                                        |
| `8-Directions-Visuelles.html`           | Comparaison interactive des trois ambiances (D32).                                                        |
| `9-Revue-Brainstorming.md`              | Idees futures triees : a decider maintenant, couvertes, a attendre (D34 a D40).                           |
| `10-Design-System/project/`             | Copie locale du design system (tokens, README, 25 composants, apercus). Source de verite : `tokens.json`. |
| `11-Modele-Donnees/`                    | Schema Prisma cible (`schema.prisma`), page de presentation generee (`generer-page.py`).                  |
| `12-Permissions.md` / `.html`           | Matrice des permissions par acteur et par module.                                                         |
| `13-Parcours.md` / `.html`              | 17 parcours et inventaire des 52 ecrans (entree des maquettes).                                           |
| `14-Architecture.md`                    | Architecture technique cible.                                                                             |
| `15-Plan-Tests.md`                      | Plan de tests.                                                                                            |

Artefact en ligne : voir le lien dans la section "Reprise" ci-dessous. La copie locale est toujours ecrite avant chaque publication.

## Reprise

- Derniere session : 2026-11-03.
- Artefacts publies :
  - Analyse V1 : https://claude.ai/artifact/2j7eohGZT8qonftWqb1wUw (`2-Analyse-V1.html`)
  - Recettes composees : https://claude.ai/artifact/LCuB3UZkuVhQqqDMvnP8ae (`7-Proposition-Recettes-Composees.html`)
  - Directions visuelles : https://claude.ai/artifact/DEwK7Soo52ZvKi7qsbzpPr (`8-Directions-Visuelles.html`)
  - Design System : https://claude.ai/artifact/7Q9Uy9qGhUyPYt3bWVa5yc (`10-Design-System/project/`)
  - Modele de donnees : https://claude.ai/artifact/T1MdLYv3PmTx1vDQQM3ajD (`11-Modele-Donnees/Modele-Donnees.html`)
  - Permissions : https://claude.ai/artifact/Hkq6p1cHvv6SnEgV4VNGzE (`12-Permissions.html`)
  - Parcours : https://claude.ai/artifact/Ryd9M1F6DKM3Ni7wuyNjqX (`13-Parcours.html`)
- Phase A terminee : decisions D01 a D40 tranchees, CDC en 0.3.
- Design System valide (B4), ajustable pendant les maquettes.
- Conception validee (B1 a B4, B6, B8), decisions D01 a D85, CDC en 0.4.
- En cours (2026-11-04) : maquettes B5, quatre canevas faits en parallele selon `16-Maquettes/BRIEF.md`. Interrompus a mi-parcours par une limite d'usage puis relances. Copies locales dans `16-Maquettes/<canevas>/project/` ; un artboard prevu dans `canvas.json` mais absent du disque reste a faire.
  - Acces et espaces : https://claude.ai/artifact/BT5twLkx7ayNLTsBSjGWuB
  - Recettes, Planning et profil, Administration : URL a reporter a la fin des agents.
- Ensuite : revue des maquettes par le proprietaire, puis validation finale du CDC 1.0 (B9).
