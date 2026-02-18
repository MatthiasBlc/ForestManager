# Tests manuels - Phase 11 Ingredients Rework

## Prerequis

- App demarree (`npm run docker:up:build`)
- Compte user + compte admin existants
- Au moins 1 communaute avec 2 membres

---

## 1. Units (user)

- [ ] GET /api/units retourne les unites groupees par categorie (WEIGHT, VOLUME, SPOON, COUNT, QUALITATIVE)
- [ ] Les unites sont triees par sortOrder dans chaque categorie

## 2. Ingredients - autocomplete & creation

- [ ] Creer une recette : taper un ingredient existant → autocomplete affiche les suggestions
- [ ] Selectionner un ingredient approuve → l'unite est pre-selectionnee (suggested-unit)
- [ ] Taper un ingredient inconnu → "New ingredient" affiche, creation en PENDING a la soumission
- [ ] Les ingredients PENDING affichent un badge "nouveau" dans l'autocomplete
- [ ] Le champ quantite accepte les nombres decimaux
- [ ] Le selecteur d'unite affiche les optgroups par categorie

## 3. Proposals avec ingredients

- [ ] Ouvrir "Propose changes" sur une recette communautaire → le formulaire pre-remplit les ingredients actuels
- [ ] Modifier un ingredient (changer quantite, unite, supprimer, ajouter) → le bouton Submit s'active
- [ ] Soumettre la proposition → succes, le proprietaire voit la proposition dans "Pending Proposals"
- [ ] Cliquer "Show changes" → le diff ingredients affiche : ajoutes (vert), supprimes (rouge barre), gardes/modifies
- [ ] Accepter la proposition → les ingredients de la recette sont mis a jour
- [ ] Rejeter la proposition → une variante est creee avec les ingredients proposes

## 4. RecipeDetail - affichage ingredients

- [ ] Les ingredients affichent la quantite et l'abbreviation de l'unite (ex: "100 g")
- [ ] Les ingredients sans quantite affichent uniquement le nom
- [ ] Les ingredients sans unite affichent uniquement la quantite

## 5. Admin - Units CRUD

- [ ] Page /admin/units : liste toutes les unites avec nom, abbreviation, categorie, sortOrder, usage count
- [ ] Filtre par categorie fonctionne
- [ ] Filtre par recherche fonctionne
- [ ] Creer une unite : nom, abbreviation, categorie, sortOrder → succes
- [ ] Modifier une unite existante → succes
- [ ] Supprimer une unite non utilisee → succes
- [ ] Supprimer une unite utilisee → erreur 409

## 6. Admin - Ingredients enrichis

- [ ] Page /admin/ingredients : affiche status (badge Approved/Pending), defaultUnit, createdBy, recipeCount
- [ ] Filtre par status (All / Approved / Pending)
- [ ] Approuver un ingredient PENDING → passe en APPROVED, notification WebSocket au createur
- [ ] Approuver + renommer → ingredient approuve avec nouveau nom
- [ ] Rejeter un ingredient PENDING avec raison → supprime, notification au createur
- [ ] Modifier un ingredient : changer nom et/ou defaultUnit
- [ ] Merger deux ingredients → recettes et proposals transferees
- [ ] Supprimer un ingredient → succes (supprime aussi les RecipeIngredient + ProposalIngredient)

## 7. Notifications WebSocket

- [ ] INGREDIENT_APPROVED : le createur recoit un toast "Votre ingredient X a ete approuve"
- [ ] INGREDIENT_MODIFIED : toast avec l'ancien et le nouveau nom
- [ ] INGREDIENT_MERGED : toast avec le nom de la cible
- [ ] INGREDIENT_REJECTED : toast avec la raison du rejet
