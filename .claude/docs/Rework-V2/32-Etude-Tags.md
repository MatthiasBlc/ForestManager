# Etude de l'affichage des tags

Demande du proprietaire le 2026-11-17, apres le peuplement de son compte en prod : la rangee de pastilles de tags au-dessus des listes de recettes est chargee et peu pratique, et fait un scroll horizontal sans fin sur mobile. L'etude couvre tous les endroits ou l'on voit une liste de tags, a harmoniser. Maquette : `32-Maquette-Tags.html`. Les choix du proprietaire vont au journal (D216) ; ce fichier garde l'inventaire, les constats et les options.

## Volume reel

Dans "Le Nid" (espace du proprietaire) : 18 tags globaux (10 du seed : Vegetarien, Vegan, Sans gluten, Rapide, Entree, Plat, Dessert, Aperitif, Petit-dejeuner, Batch cooking ; 8 crees pour lui : Hiver, Printemps, Ete, Automne, Midi, Soir, Congelable, Air fryer) et 15 tags d'espace (11 categories, 4 paliers : Incontournable, Regulier, Occasionnel, A tester). La rangee de filtres compte donc 35 pastilles ("Toutes", 33 tags, "Bases"). Dans l'espace perso : 18 + 11.

## Inventaire

| Endroit                                     | Fichier                                                              | Affichage actuel                                                                       | Choix    |
| ------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| Liste des recettes / Mes recettes (filtres) | `modules/recipes/recipes-page.tsx`                                   | rangee `fm-chip-row` : Toutes, tous les tags globaux puis d'espace, Bases ; ET logique | multiple |
| "Depuis mes recettes" (F-MES-RECETTES)      | `modules/recipes/add-mine-sheet.tsx`                                 | meme rangee, tags globaux seulement                                                    | multiple |
| Editeur de recette                          | `modules/recipes/recipe-editor-page.tsx`                             | `TagPicker` x2 (Tags, Tags de l'espace) : toutes les pastilles, en retour a la ligne   | multiple |
| Regle de profil, epinglage d'un repas       | `modules/meal-plan/rule-sheet.tsx` (`TagChoice`), `profile-grid.tsx` | toutes les pastilles, en retour a la ligne                                             | unique   |
| Fiche recette                               | `modules/recipes/recipe-page.tsx`                                    | badges des tags de la recette (accent : global, neutre : espace)                       | lecture  |
| Carte de recette                            | `modules/recipes/components/recipe-card.tsx`                         | aucun tag                                                                              | -        |
| Recherche globale                           | `core/search/search-palette.tsx`                                     | aucun tag                                                                              | -        |
| Admin, tags globaux                         | `core/admin/tags-page.tsx`                                           | tableau (renommer, fusionner, supprimer, traductions)                                  | gestion  |

Sur mobile (`pointer: coarse`), `.fm-chip-row` defile a l'horizontale sans fin ; en bureau elle passe a la ligne (35 pastilles = 4 a 5 lignes avant la premiere recette).

## Constats

1. **Trop de pastilles a plat.** Tout est montre, dans l'ordre global puis d'espace, alphabetique ; rien ne distingue une saison d'un palier ou d'une categorie. Un tag sans aucune recette dans la liste reste propose (filtre qui ne donne rien).
2. **ET entre tous les tags.** "Hiver" + "Automne" ne donne que les recettes des deux saisons a la fois ; on attend "Hiver ou Automne".
3. **Quatre composants pour la meme chose** (rangee de filtres, `TagPicker`, `TagChoice`, rangee de F-MES-RECETTES), chacun avec sa liste complete.
4. **Manque fonctionnel (F-REF-2) :** le front ne permet ni de creer un tag d'espace (l'editeur ne propose que les tags existants), ni de taguer une recette partagee dans un autre espace (`PUT /:recipeId/space-tags` sans ecran), ni aux moderateurs de renommer, fusionner ou supprimer les tags d'espace (routes `PATCH`, `merge`, `DELETE` sans ecran). Les tags du proprietaire ont ete crees par l'API depuis l'artefact de peuplement. Prevu au parcours P05 et au plan C3, jamais fait cote web.
5. La rangee "Tous les espaces / Perso / Le Nid" de "Mes recettes" s'ajoute au-dessus (deuxieme rangee).

## Options

### Liste des recettes (le coeur de la demande)

- **A. Feuille de filtres (recommande).** En tete de liste : recherche + bouton "Filtres" (nombre de filtres actifs). Dessous, seulement les filtres actifs en pastilles retirables. La feuille (bas d'ecran sur mobile, meme feuille en bureau) : champ "Chercher un tag", tags groupes par famille avec le nombre de recettes, tags sans recette masques, "Bases", espace d'origine (Mes recettes) ; pied "Effacer" et "Voir 23 recettes". OU dans une famille, ET entre familles.
- **B. A + raccourcis.** Comme A, mais la rangee montre aussi les 4 ou 5 tags les plus utilises de l'espace quand aucun filtre n'est actif (piste du proprietaire). Un geste de moins pour ces tags ; la rangee peut encore deborder sur mobile si les noms sont longs.
- **C. Rangee reduite.** Garder la rangee, limitee aux N tags les plus utilises + "Plus..." qui ouvre la liste complete. Deux chemins pour la meme action ; l'ordre change avec l'usage (desorientant).
- **D. Colonne de filtres en bureau.** A sur mobile, colonne fixe a gauche en bureau. Plus de code pour un gain faible (la liste est deja sur une grille large).

### Familles de tags

- **F1. Familles declarees (recommande).** Un tag peut appartenir a une famille (Saison, Moment, Type de plat, Regime, Pratique ; dans Le Nid : Categorie, Palier). Familles globales gerees par l'admin, familles d'espace par les moderateurs ; ordre reglable. Sans famille : section "Autres". Sert la feuille, l'editeur, le OU/ET, et l'ordre des tags sur la carte. Changement de modele : table `TagFamily` (portee GLOBAL ou SPACE, nom, position) et `Tag.familyId`.
- **F2. Deux sections fixes** : "Tags" (globaux) et "Tags de Le Nid". Aucun changement de modele, mais les 33 tags restent en deux blocs a plat ; le OU/ET par famille n'est plus possible (ET partout).

### Les autres endroits (meme composant partout)

- **Editeur** : les tags choisis en pastilles retirables + "Ajouter des tags", qui ouvre la meme feuille en mode choix (recherche, familles) ; si la recherche ne trouve rien : "Creer le tag << ... >> dans Le Nid" (corrige le constat 4). Une seule section au lieu de deux.
- **Planning** (regle, epinglage) : un champ "Tag : Hiver >" qui ouvre la meme feuille en choix unique.
- **Fiche recette** : badges tries par famille ; un membre qui peut taguer touche "Modifier les tags" (meme feuille), y compris sur une recette partagee (tags de cet espace).
- **Carte** : les deux premiers tags (ordre des familles) en texte discret sous le titre, ex. "Pates · Hiver" (piste du proprietaire). Alternative : rien sur la carte.
- **Reglages de l'espace > Tags** (moderateurs) : tags par famille avec leur nombre de recettes ; renommer, changer de famille, fusionner, supprimer ; creer, renommer, ordonner les familles.
- **Recherche globale** : un groupe "Tags" ; toucher un tag ouvre la liste des recettes filtree.

## Choix du proprietaire

Au selecteur le 2026-11-17 (detail : D216 au journal) : A (feuille de filtres), F1 (familles declarees), deux tags en texte sur les cartes, creation d'un tag d'espace dans l'editeur, Reglages de l'espace > Tags, tags dans la recherche globale. Pas de bouton "Modifier" sur la fiche : les tags se modifient dans l'editeur seulement, avec les tags de l'espace ou il est ouvert (y compris un espace de partage) ; qui ne peut pas modifier la recette ne tague pas. Ajout du proprietaire : au partage, les tags d'espace d'origine de la recette sont proposes en cases cochees pour l'espace cible (poses s'ils y existent, crees sinon).
