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
- Fait : etude (A), design system (B4), modele de donnees (B1), permissions (B2), parcours (B3), architecture (B6), tests (B8), maquettes (B5). Decisions D01 a D139 toutes tranchees (journal). Version et couverture du CDC : son en-tete.
- Prochaine etape : B9, validation finale du CDC 1.0. Maquettes revues dans Chrome le 2026-11-05 (B5b termine, voir `16-Maquettes/ECARTS.md`). Tout est publie et committe au 2026-11-05 : DS v10, Acces v39, Recettes v35, Planning v26, Admin v26.
  - Chaque canevas se met a jour depuis sa copie locale `16-Maquettes/<canevas>/project/` a son URL (le dossier `ds/` n'existe que dans l'artefact) : relire l'artefact (action read sur l'URL), puis publier avec `root` = le dossier du canevas, `file_path` = un fichier modifie, `files` = les autres (`project/...`).
  - Les numeros de version des canevas avancent aussi a la simple consultation : comparer le contenu en ligne au commit avant d'ecraser.
- Preparation de B9 faite le 2026-11-05 : contradictions de report corrigees dans le CDC (F-NOT-3 et D41, S3.1 et D53, S7 remplacee par un renvoi au schema, D26, D46, D55, D57, D125). Le CDC reste en 0.5 ; la validation et la case B9 appartiennent au proprietaire.
- Points ouverts pour B9 :
  - S2, S4.3 (F-REC-7), roadmap C3 : la "Copie (fork)" independante n'existe ni dans le schema, ni dans `12-Permissions.md`, ni dans les parcours (seule copie = adaptation D17, et 12 dit "transformer sa suggestion refusee en adaptation" quand D04 dit "copie"). Supprimer la copie independante ou l'ajouter partout ?
  - S7 : `schema.prisma` date de B1 et ne porte pas les decisions B5 : proposition de transfert de propriete (D92), lien d'invitation sans expiration possible alors que la duree est 1, 7 ou 30 jours (D94), ingredient MERGED "plus propose" contre synonyme propose a la saisie (D120), ordre des modules choisi par l'OWNER (D131), mot de passe temporaire (D134), choix et ordre des widgets d'accueil (S5.2). Mettre a jour le schema avant la 1.0 ou en C1 ?
  - S3.3, S4.9 : `12-Permissions.md` donne au super admin le droit de modifier une recette, alors que D52 et D122 limitent son acces a la lecture et aux actions de moderation (masquer, supprimer).
  - S4.7 : droits de la liste de courses encore "proposes" dans `12-Permissions.md` (memes droits que modifier le planning) ; aucune decision du journal.
  - En-tete, S5.4, S6 : documents de conception aux statuts perimes alors que le journal les valide (12 PROPOSEE avec P1 et P2 "a trancher", 13 BROUILLON, 15 PROPOSE, schema PROPOSITION ; sections "Questions pour le proprietaire" deja tranchees). Aligner sur "statut : voir le journal" et republier 12 et 13 ?
  - S4.1 (F-ACC-6), S4.2 (F-SPC-8) : D37 (export natif) a ete choisi par Claude, "a revoir" selon le journal ; D130 (selecteur mobile, S5.2) est note "reversible". A confirmer.
  - S4.3 (F-REC-13), S4.8 : D12 et D14 sont reserves dans le journal (notifications, analytics) sans jamais avoir ete ecrits ; couverts par D41, D118 et D39. Les marquer "non utilises" ?
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
