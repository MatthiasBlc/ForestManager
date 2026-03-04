# Tests manuels - Phase 13 Recipe Rework v2

## Prerequis

- App demarree (`npm run docker:up:build`)
- 1 compte user connecte
- Au moins 1 communaute avec des recettes
- Au moins 1 recette migree (ancienne, avec 1 seul step)

---

## 1. Creation de recette

- [x] Formulaire affiche : titre, servings (defaut 4), temps (prep/cook/rest), steps, ingredients, tags
- [x] Champ servings accepte uniquement 1-100
- [x] Champs temps sont optionnels (peuvent rester vides)
- [ ] StepEditor : ajouter/supprimer/reordonner des etapes -> possible d'ajouter un drag and drop ?
- [x] Au moins 1 step non vide requis pour soumettre
- [x] Soumission reussie avec tous les champs remplis
- [x] Recette creee visible dans la liste avec badges servings + temps total

## 2. Edition de recette

- [x] Pre-remplissage correct de tous les champs (servings, temps, steps, ingredients)
- [x] Modifier les steps → sauvegarde OK
- [x] Modifier servings/temps → sauvegarde OK
- [x] Recette migree : 1 step pre-rempli, servings=4, pas de temps

## 3. Detail de recette

- [x] TimeBadges affiches (prep, cuisson, repos, total) quand definis
- [ ] Pas de badges temps quand tous les temps sont null −> impossible en édition de mettre les temps à 0, ça ne sauvegarde pas
- [x] ServingsSelector affiche et fonctionne (+/- et saisie directe)
- [x] Scaling des quantites d'ingredients dynamique selon servings selectionnes
- [x] Steps affiches en blocs numerotes sequentiels
- [x] Recette migree : affiche correctement 1 step, servings=4

## 4. Cartes et listes

- [x] RecipeCard affiche badge servings (icone personne + nombre)
- [x] RecipeCard affiche badge temps total (icone horloge + duree)
- [ ] Pas de badge temps quand tous les temps sont null
- [x] RecipeListRow affiche les memes badges en taille xs

## 5. Propositions

- [x] Modal propose modification : champs pre-remplis (titre, servings, temps, steps, ingredients)
- [x] Bouton submit desactive tant qu'aucun changement n'est detecte
- [x] Modifier un step → submit active
- [x] Modifier servings → submit active
- [x] Soumission reussie
- [x] Accepter proposition → recette mise a jour avec les nouveaux steps/servings/temps
- [x] Rejeter proposition → variante creee avec les steps proposes

## 6. Partage et sync

- [ ] Partager recette perso → copie avec steps/servings/times corrects
- [ ] Publier recette perso vers communaute → sync correcte
- [ ] Modifier recette synchronisee → sync bidirectionnelle des steps/servings/times

Recette perso créé. shared dans une commuA. Depuis la recette de cette commu, je viens de share avec une seconde commuB.

Lorsque je modifie la recette perso ou CommuA, les deux recettes sont sync bidirectionnellement.
En revanche la recette de CommuB n'est pas modif.
Faire un changement dans la recette de CommuB n'a pas d'impact sur les autres recettes.
Est-ce un comportement voulu dans les specs / cachier des charges ?

## 7. Recettes communautaires

- [x] Creation recette communautaire avec steps/servings/temps
- [x] Liste communautaire affiche les badges
- [x] Detail communautaire affiche TimeBadges + ServingsSelector + steps
