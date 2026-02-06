# Tests manuels - Corrections pre-Phase 8 (7.3)

Tests automatises: 332 backend + 165 frontend = 497 OK

## Checklist de validation manuelle

### Fix 1 - Bug ShareRecipeModal corrige

- [ ] Aller dans une communaute, ouvrir une recette communautaire
- [ ] Cliquer sur "Share" → selectionner une autre communaute cible → valider
- [ ] Verifier que le partage fonctionne sans erreur "Cannot read properties of undefined"
- [ ] Verifier que la recette apparait dans la communaute cible

### Fix 2 - Prevention partage doublon

- [ ] Reprendre la recette partagee au test precedent
- [ ] Tenter de la re-partager vers la meme communaute cible
- [ ] Verifier qu'un message d'erreur s'affiche (pas de doublon cree)

### Fix 3 - Badge "Shared by: username"

- [ ] Ouvrir la recette partagee dans la communaute cible
- [ ] Verifier que le badge affiche "Shared by: {username}" (et non "Shared from: {communityName}")
- [ ] Verifier le badge sur la RecipeCard en vue grille
- [ ] Verifier le badge sur la RecipeListRow en vue liste

### Fix 4 - Publish recette perso vers communautes

- [ ] Aller sur "My Recipes", trouver une recette personnelle
- [ ] Verifier qu'un bouton de partage (icone share) est visible
- [ ] Cliquer dessus → la modale s'ouvre avec la liste des communautes
- [ ] Les communautes ou la recette est deja partagee ne doivent PAS apparaitre
- [ ] Cocher 1 ou plusieurs communautes → cliquer "Share to X communities"
- [ ] Verifier que la recette apparait dans chaque communaute selectionnee
- [ ] Rouvrir la modale → les communautes deja partagees ne sont plus listees

### Fix 5 - Activity visible uniquement pour moderateurs

- [ ] Se connecter en tant que MEMBER (pas moderateur) d'une communaute
- [ ] Verifier que l'icone Activity (horloge) n'apparait PAS dans la barre d'icones
- [ ] Se connecter en tant que MODERATOR de cette meme communaute
- [ ] Verifier que l'icone Activity apparait et fonctionne

### Fix 6 & 7 - Synchro bidirectionnelle recettes

- [ ] Creer une recette dans une communaute
- [ ] Modifier le titre/contenu dans la communaute → verifier que "My Recipes" est mis a jour
- [ ] Modifier le titre/contenu dans "My Recipes" → verifier que la communaute est mise a jour
- [ ] Modifier les tags dans "My Recipes" → verifier que les tags de la communaute ne changent PAS (tags = locaux)
- [ ] Si la recette est partagee dans 2+ communautes: modifier dans l'une → verifier la synchro dans l'autre

### Fix 8 - Sidebar sticky + scrollbar invisible

- [ ] Avoir 5+ communautes pour declencher le scroll
- [ ] Verifier que "Menu", "Dashboard", "My Recipes", "Communities" restent fixes en haut
- [ ] Scroller la liste des communautes
- [ ] Verifier qu'aucune scrollbar n'est visible (scroll smooth sans barre)

### Fix 9 - Default tab "recipes"

- [ ] Cliquer sur une communaute dans la sidebar
- [ ] Verifier que la page s'ouvre directement sur la liste des recettes (pas sur "members")

### Fix 10 - Bouton "Back to communities" supprime

- [ ] Ouvrir une communaute
- [ ] Verifier qu'il n'y a plus de bouton "Back to communities" en haut

### Fix 11 & 12 - Icones + volet lateral redimensionnable

- [ ] Ouvrir une communaute → verifier les icones en haut a droite (Members, Activity si mod, Invitations si mod, Edit si mod)
- [ ] Cliquer sur l'icone Members → le volet lateral s'ouvre a droite avec la liste des membres
- [ ] Cliquer sur l'icone Activity (si moderateur) → le contenu du volet change pour l'activity feed
- [ ] Cliquer sur l'icone Invitations (si moderateur) → le contenu du volet change pour les invitations
- [ ] Re-cliquer sur l'icone active → le volet se ferme
- [ ] Cliquer sur la croix (X) du volet → le volet se ferme
- [ ] Redimensionner le volet en tirant le bord gauche (drag horizontal)
- [ ] Verifier que la largeur min ~250px et max ~50% viewport sont respectees
- [ ] Changer de communaute via la sidebar → le volet reste ouvert avec le contenu de la nouvelle communaute
- [ ] Recharger la page → la largeur du volet est restauree (localStorage)

### Fix 13 - Navigation tags communautaires

- [ ] Ouvrir une recette depuis une communaute
- [ ] Cliquer sur un tag de la recette
- [ ] Verifier que la navigation revient a la liste des recettes de CETTE communaute (pas "My Recipes")
- [ ] Verifier que le filtre par tag est actif dans la liste

---

## Statut

| #     | Fix                      | Resultat | Notes |
| ----- | ------------------------ | -------- | ----- |
| 1     | Bug ShareRecipeModal     |          |       |
| 2     | Prevention doublon       |          |       |
| 3     | Badge "Shared by"        |          |       |
| 4     | Publish perso            |          |       |
| 5     | Activity mod only        |          |       |
| 6-7   | Synchro bidirectionnelle |          |       |
| 8     | Sidebar sticky           |          |       |
| 9     | Default tab recipes      |          |       |
| 10    | Remove "Back to"         |          |       |
| 11-12 | Side panel               |          |       |
| 13    | Nav tags communaute      |          |       |

---

-
