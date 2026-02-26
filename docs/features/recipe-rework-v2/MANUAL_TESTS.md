# Tests manuels - Phase 13 Recipe Rework v2

## Prerequis

- App demarree (`npm run docker:up:build`)
- 1 compte user connecte
- Au moins 1 communaute avec des recettes
- Au moins 1 recette migree (ancienne, avec 1 seul step)

---

## 1. Creation de recette

- [ ] Formulaire affiche : titre, servings (defaut 4), temps (prep/cook/rest), steps, ingredients, tags
- [ ] Champ servings accepte uniquement 1-100
- [ ] Champs temps sont optionnels (peuvent rester vides)
- [ ] StepEditor : ajouter/supprimer/reordonner des etapes
- [ ] Au moins 1 step non vide requis pour soumettre
- [ ] Soumission reussie avec tous les champs remplis
- [ ] Recette creee visible dans la liste avec badges servings + temps total

## 2. Edition de recette

- [ ] Pre-remplissage correct de tous les champs (servings, temps, steps, ingredients)
- [ ] Modifier les steps → sauvegarde OK
- [ ] Modifier servings/temps → sauvegarde OK
- [ ] Recette migree : 1 step pre-rempli, servings=4, pas de temps

## 3. Detail de recette

- [ ] TimeBadges affiches (prep, cuisson, repos, total) quand definis
- [ ] Pas de badges temps quand tous les temps sont null
- [ ] ServingsSelector affiche et fonctionne (+/- et saisie directe)
- [ ] Scaling des quantites d'ingredients dynamique selon servings selectionnes
- [ ] Steps affiches en blocs numerotes sequentiels
- [ ] Recette migree : affiche correctement 1 step, servings=4

## 4. Cartes et listes

- [ ] RecipeCard affiche badge servings (icone personne + nombre)
- [ ] RecipeCard affiche badge temps total (icone horloge + duree)
- [ ] Pas de badge temps quand tous les temps sont null
- [ ] RecipeListRow affiche les memes badges en taille xs

## 5. Propositions

- [ ] Modal propose modification : champs pre-remplis (titre, servings, temps, steps, ingredients)
- [ ] Bouton submit desactive tant qu'aucun changement n'est detecte
- [ ] Modifier un step → submit active
- [ ] Modifier servings → submit active
- [ ] Soumission reussie
- [ ] Accepter proposition → recette mise a jour avec les nouveaux steps/servings/temps
- [ ] Rejeter proposition → variante creee avec les steps proposes

## 6. Partage et sync

- [ ] Partager recette perso → copie avec steps/servings/times corrects
- [ ] Publier recette perso vers communaute → sync correcte
- [ ] Modifier recette synchronisee → sync bidirectionnelle des steps/servings/times

## 7. Recettes communautaires

- [ ] Creation recette communautaire avec steps/servings/temps
- [ ] Liste communautaire affiche les badges
- [ ] Detail communautaire affiche TimeBadges + ServingsSelector + steps
