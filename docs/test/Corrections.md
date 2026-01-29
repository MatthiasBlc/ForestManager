# Corrections a faire

## [RESOLU] Sidebar - Tooltips en mode compact

**Probleme**: En mode compact de la sidebar, les infobulles (tooltips) sur les boutons de navigation passent sous le contenu de la page et ne sont pas visibles par les utilisateurs.

**Solution implementee**:

1. Ajout de `overflow: visible !important` sur `.drawer-side`, `aside`, `.menu`, `.menu li` dans `global.css`
2. Ajout de `position: fixed` sur les pseudo-elements des tooltips (`.tooltip::before`, `.tooltip::after`)
3. Deplacement des classes tooltip des `<li>` vers les elements interieurs (`<Link>`, `<button>`) dans `Sidebar.tsx`

**Fichiers modifies**:

- `frontend/src/styles/global.css`
- `frontend/src/components/Layout/Sidebar.tsx`

---

## [RESOLU] Plusieurs modes d'affichages

**Probleme**: Dans la liste de recettes, il manquait la possibilite de basculer entre un affichage en cartes et en liste.

**Solution implementee**:

1. Ajout d'un bouton toggle (icones grille/liste) en haut a droite de la page
2. Creation du composant `RecipeListRow.tsx` pour l'affichage en liste
3. Persistance du choix de l'utilisateur dans `localStorage`

**Fichiers modifies**:

- `frontend/src/components/RecipesPageLoggedInView.tsx`

**Fichiers crees**:

- `frontend/src/components/recipes/RecipeListRow.tsx`

---

## [RESOLU] Recherche par tags et ingredients

**Probleme**: Pouvoir rechercher par tags avec menu deroulant (entree libre ou selection), et par ingredients de la meme maniere.

**Solution implementee**:

1. Le `TagSelector` existant supporte deja la recherche avec dropdown et entree libre
2. Creation du composant `IngredientSelector.tsx` (similaire a TagSelector)
3. Ajout du filtre par ingredients dans `RecipeFilters.tsx`
4. Mise a jour de l'API backend pour supporter le parametre `ingredients`
5. Mise a jour de l'API frontend pour passer les ingredients dans les requetes

**Fichiers modifies**:

- `frontend/src/components/recipes/RecipeFilters.tsx`
- `frontend/src/components/RecipesPageLoggedInView.tsx`
- `frontend/src/network/api.ts`
- `backend/src/controllers/recipes.ts`

**Fichiers crees**:

- `frontend/src/components/form/IngredientSelector.tsx`

---

# Tests à ajouter APRES les corrections. Ne pas lire tant qu'il y a des lignes non résolues au dessus de celle-ci.

Mettre en place un système de test du code pour le backend et pour le frontend.

En se basant sur les fichier 0.5_test.md, 1.2_test.md, 2.0_test.md, créer des tests unitaires nécessaires.

Les tests doivent être valide avant les déploiement (preprod et prod).
