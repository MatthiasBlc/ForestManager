# Etude UX de la navigation mobile (D205)

Tour fait le 2026-11-13 dans Chrome, fenetre mobile (~420 px), stack de dev, compte de la revue C7c (espace perso + groupe "Coloc revue" avec Recettes et Planning). Les decisions qui en sortent sont au journal ; ce fichier garde la carte et les constats.

## Carte : gestes depuis l'ouverture de l'application

Un geste = un toucher. Point de depart : l'espace ouvert a la reprise (D60).

| Ecran                                     | Chemin sur mobile                                        | Gestes |
| ----------------------------------------- | -------------------------------------------------------- | ------ |
| Accueil                                   | perso : onglet ; groupe : selecteur d'espaces, "Accueil" | 1 / 2  |
| Liste des recettes / Mes recettes         | onglet                                                   | 1      |
| Detail d'une recette                      | onglet, carte (ou un repas du planning, de l'accueil)    | 1-2    |
| Mode cuisine                              | detail, bouton fixe en bas                               | 3      |
| Historique, adapter, partager une recette | detail, menu "...", entree                               | 4      |
| Ajouter une recette (groupe)              | onglet, "Ajouter une recette", "Depuis mes recettes"     | 2-3    |
| Creer une recette (groupe)                | onglet, "Ajouter une recette", "Creer", "Saisir"         | 4      |
| Planning (jour / semaine)                 | onglet                                                   | 1      |
| Idees de repas                            | onglet Planning, icone ampoule (sans libelle)            | 2      |
| Profils de generation                     | onglet Planning, icone (sans libelle)                    | 2      |
| Reglages du planning                      | onglet Planning, icone engrenage (sans libelle)          | 2      |
| Membres, Activite (groupe)                | "Plus", entree                                           | 2      |
| Reglages de l'espace                      | "Plus", "Reglages"                                       | 2      |
| Modules de l'espace                       | "Plus", "Reglages", defiler, "Modules de l'espace"       | 3      |
| Notifications                             | cloche de la barre du haut                               | 1      |
| Preferences de notification               | cloche, engrenage (ou profil, "Notifications")           | 2      |
| Profil et ses sous-ecrans                 | avatar de la barre du haut, entree                       | 1-2    |
| Nouveautes                                | avatar, defiler, "Nouveautes"                            | 2      |
| Changer d'espace                          | nom de l'espace en haut, espace                          | 2      |
| Recherche / palette                       | loupe                                                    | 1      |

Aucun ecran courant n'est a plus de 4 gestes ; les plus profonds (creer une recette dans un groupe, historique) sont des actions rares ou deja raccourcies en C7c.

## Constats

1. **Deux modeles de navigation sur mobile.** Dans un espace : barre du haut (nom de l'espace qui ouvre le selecteur, loupe, cloche, avatar) et onglets en bas. Hors espace (profil et ses sous-ecrans, notifications, nouveautes) : une bande horizontale d'icones d'espaces (le rail du bureau, couche a plat) au-dessus d'un en-tete avec retour, sans onglets. On change de "monde" en touchant la cloche ou l'avatar ; la bande double le selecteur d'espaces et le retour. Source : `core/profile/profile-layout.tsx` (passe `SpaceRail` a `AppShell`).
2. **Planning : trois icones sans libelle** (ampoule = Idees de repas, piece de puzzle = Profils de generation, engrenage = Reglages du planning) dans une barre deja chargee (Jour/Semaine, Generer, fleches, Aujourd'hui, bandeau des jours : environ un tiers de l'ecran avant le premier repas). Les icones ne se devinent pas (la piece de puzzle n'evoque pas des profils).
3. **Espace perso : "Plus" ne contient qu'une entree** ("Reglages"). Un onglet qui ouvre une feuille d'une ligne : un geste perdu et une feuille inutile.
4. **Groupe : deux onglets libres sur quatre** (Planning, Recettes, Plus). Membres et Activite sont dans "Plus".
5. Remarques sans changement propose : "Mes recettes" de l'espace perso empile deux rangees de puces (espaces, tags), acceptable ; "Modules de l'espace" a 3 gestes, action rare ; le detail d'une recette (retour, "...", Mode cuisine fixe) est clair.

## Propositions et choix

Choix du proprietaire au selecteur, le 2026-11-13 : D209 au journal.

| Constat | Choix                                                                                        | Realise (TDD)                                            |
| ------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1       | bande d'espaces retiree sur mobile hors espace ; le bureau garde son rail                    | `SpaceRail desktopOnly`, `profile-layout.tsx`, `app.css` |
| 2       | icone et mot court dessous : Idees, Profils, Reglages (tient sur une ligne a 360 px)         | `.fm-toolbtn`, `.fm-plan-tools`, `planning-page.tsx`     |
| 3       | "Plus" d'une seule entree devient un onglet (espace perso : Accueil, Mes recettes, Reglages) | `buildNavigation`, `TabBar` sans `onMore`                |
| 4       | groupe inchange (Planning, Recettes, Plus)                                                   | -                                                        |

Verifie dans Chrome le 2026-11-13 (fenetre mobile, largeur 360 px simulee pour la barre du Planning, puis bureau 1400 px).
