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
| `13-Parcours.md` / `.html`              | 17 parcours et inventaire des 54 ecrans (entree des maquettes).                                           |
| `14-Architecture.md`                    | Architecture technique cible.                                                                             |
| `15-Plan-Tests.md`                      | Plan de tests.                                                                                            |

Artefact en ligne : voir le lien dans la section "Reprise" ci-dessous. La copie locale est toujours ecrite avant chaque publication.

## Reprise

- Derniere session : 2026-11-05. Contexte remis a zero apres cette session : tout l'etat est ici et dans les fichiers cites.
- Fait : etude (A), design system (B4), modele de donnees (B1), permissions (B2), parcours (B3), architecture (B6), tests (B8), maquettes (B5). Version et couverture du CDC : son en-tete.
- Fait aussi : decisions D01 a D142 (journal). Points ouverts B9 tranches le 2026-11-05 (D140 a D142) : copie independante supprimee, liste de courses a role minimal reglable, schema mis a jour avec les decisions des maquettes, super admin sans modification de recette, statuts des documents au journal, D37 et D130 definitifs, D12 et D14 non utilises.
- CDC 1.0 valide par le proprietaire le 2026-11-05 (B9) : la phase d'etude est terminee, le code est autorise.
- Prochaine etape : C1 (socle : monorepo, package partage, auth, espaces, membres, invitations), a demarrer dans une session propre. Commencer par un plan de C1 a faire valider (decoupage, ordre, ce qui reprend ou remplace la V1) avant d'ecrire du code.
- Tout est publie et committe au 2026-11-05 : DS v10, Acces v39, Recettes v35, Planning v26, Admin v26, Permissions v5, Parcours v6, Modele de donnees v5. Maquettes revues dans Chrome le 2026-11-05 (B5b, voir `16-Maquettes/ECARTS.md`).
  - Chaque canevas se met a jour depuis sa copie locale `16-Maquettes/<canevas>/project/` a son URL (le dossier `ds/` n'existe que dans l'artefact) : relire l'artefact (action read sur l'URL), puis publier avec `root` = le dossier du canevas, `file_path` = un fichier modifie, `files` = les autres (`project/...`).
  - Les numeros de version des artefacts avancent aussi a la simple consultation : comparer le contenu en ligne au commit avant d'ecraser.
  - Page du modele de donnees : `python3 generer-page.py schema.prisma Modele-Donnees.html` depuis `11-Modele-Donnees/`, puis prettier sur le .html.
- Methode : copie locale d'abord, puis publication ; commits en francais, autonomes, sans Co-Authored-By ; taches independantes en agents paralleles.
- Artefacts :
  - Analyse V1 : https://claude.ai/artifact/2j7eohGZT8qonftWqb1wUw (`2-Analyse-V1.html`)
  - Recettes composees : https://claude.ai/artifact/LCuB3UZkuVhQqqDMvnP8ae (`7-Proposition-Recettes-Composees.html`)
  - Directions visuelles : https://claude.ai/artifact/DEwK7Soo52ZvKi7qsbzpPr (`8-Directions-Visuelles.html`)
  - Design System : https://claude.ai/artifact/7Q9Uy9qGhUyPYt3bWVa5yc (`10-Design-System/project/`)
  - Modele de donnees : https://claude.ai/artifact/T1MdLYv3PmTx1vDQQM3ajD (`11-Modele-Donnees/Modele-Donnees.html`, regenere par `generer-page.py`)
  - Permissions : https://claude.ai/artifact/Hkq6p1cHvv6SnEgV4VNGzE (`12-Permissions.html`)
  - Parcours : https://claude.ai/artifact/Ryd9M1F6DKM3Ni7wuyNjqX (`13-Parcours.html`)
  - Maquettes Acces et espaces : https://claude.ai/artifact/BT5twLkx7ayNLTsBSjGWuB (`16-Maquettes/1-Acces-Espaces/project/`)
  - Maquettes Recettes : https://claude.ai/artifact/D3NXrW3qfML3cWURVAARLJ (`16-Maquettes/2-Recettes/project/`)
  - Maquettes Planning et profil : https://claude.ai/artifact/8SoeKigajmFtEK4q8RPRrY (`16-Maquettes/3-Planning-Profil/project/`)
  - Maquettes Administration : https://claude.ai/artifact/BW2txaUya8r2YnpHH8GF17 (`16-Maquettes/4-Administration/project/`)
