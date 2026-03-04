# Tests manuels - Phase 11 Ingredients Rework

## Prerequis

- App demarree (`npm run docker:up:build`)
- Compte user + compte admin existants
- Au moins 1 communaute avec 2 membres

---

## 1. Units (user)

- [x] GET /api/units retourne les unites groupees par categorie (WEIGHT, VOLUME, SPOON, COUNT, QUALITATIVE)
- [x] Les unites sont triees par sortOrder dans chaque categorie

## 2. Ingredients - autocomplete & creation

- [x] Creer une recette : taper un ingredient existant → autocomplete affiche les suggestions
- [ ] Selectionner un ingredient approuve → l'unite est pre-selectionnee (suggested-unit)
- [x] Taper un ingredient inconnu → "New ingredient" affiche, creation en PENDING a la soumission
- [x] Les ingredients PENDING affichent un badge "nouveau" dans l'autocomplete
- [x] Le champ quantite accepte les nombres decimaux
- [x] Le selecteur d'unite affiche les optgroups par categorie

## 3. Proposals avec ingredients

- [x] Ouvrir "Propose changes" sur une recette communautaire → le formulaire pre-remplit les ingredients actuels
- [x] Modifier un ingredient (changer quantite, unite, supprimer, ajouter) → le bouton Submit s'active
- [x] Soumettre la proposition → succes, le proprietaire voit la proposition dans "Pending Proposals"
- [x] Cliquer "Show changes" → le diff ingredients affiche : ajoutes (vert), supprimes (rouge barre), gardes/modifies
- [x] Accepter la proposition → les ingredients de la recette sont mis a jour
- [x] Rejeter la proposition → une variante est creee avec les ingredients proposes

## 4. RecipeDetail - affichage ingredients

- [x] Les ingredients affichent la quantite et l'abbreviation de l'unite (ex: "100 g")
- [x] Les ingredients sans quantite affichent uniquement le nom
- [x] Les ingredients sans unite affichent uniquement la quantite

## 5. Admin - Units CRUD

- [x] Page /admin/units : liste toutes les unites avec nom, abbreviation, categorie, sortOrder, usage count
- [x] Filtre par categorie fonctionne
- [x] Filtre par recherche fonctionne
- [x] Creer une unite : nom, abbreviation, categorie, sortOrder → succes
- [x] Modifier une unite existante → succes
- [x] Supprimer une unite non utilisee → succes
- [x] Supprimer une unite utilisee → erreur 409

## 6. Admin - Ingredients enrichis

- [x] Page /admin/ingredients : affiche status (badge Approved/Pending), defaultUnit, createdBy, recipeCount
- [x] Filtre par status (All / Approved / Pending)
- [x] Approuver un ingredient PENDING → passe en APPROVED, notification WebSocket au createur
- [x] Approuver + renommer → ingredient approuve avec nouveau nom
- [x] Rejeter un ingredient PENDING avec raison → supprime, notification au createur
- [x] Modifier un ingredient : changer nom et/ou defaultUnit
- [x] Merger deux ingredients → recettes et proposals transferees
- [x] Supprimer un ingredient → succes (supprime aussi les RecipeIngredient + ProposalIngredient)

## 7. Notifications WebSocket

- [x] INGREDIENT_APPROVED : le createur recoit un toast "Votre ingredient X a ete approuve"
- [x] INGREDIENT_MODIFIED : toast avec l'ancien et le nouveau nom
- [x] INGREDIENT_MERGED : toast avec le nom de la cible
- [x] INGREDIENT_REJECTED : toast avec la raison du rejet
