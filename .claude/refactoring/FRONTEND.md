# Frontend Refactoring

## PRIORITE 1 - Hooks, utilitaires, dead code

### F1.1 - Creer hook useClickOutside

**Probleme**: Pattern click-outside duplique dans 5 composants
**Action**: Creer `src/hooks/useClickOutside.ts`
**Signature**: `useClickOutside(ref: RefObject<HTMLElement>, callback: () => void)`
**Fichiers concernes**:
- `src/components/form/IngredientList.tsx` (lignes 64-73)
- `src/components/form/TagSelector.tsx` (lignes 57-66)
- `src/components/form/IngredientSelector.tsx` (lignes 55-63)
- `src/components/proposals/VariantsDropdown.tsx` (lignes 35-43)
- `src/components/Navbar/NotificationDropdown.tsx` (lignes 44-52)
- `src/components/Navbar/NavBarLoggedInView/NavBarLoggedInView.tsx` (ligne 14)
**Status**: TODO

---

### F1.2 - Creer hook useDebounce

**Probleme**: Logique debounce (setTimeout/clearTimeout + ref) dupliquee 4+ fois
**Action**: Creer `src/hooks/useDebounce.ts`
**Signature**: `useDebouncedCallback(callback: Function, delay: number)`
**Fichiers concernes**:
- `src/components/form/TagSelector.tsx` (lignes 39-55)
- `src/components/form/IngredientList.tsx` (lignes 48-62)
- `src/components/RecipesPageLoggedInView.tsx` (filter changes)
- `src/components/invitations/InviteUserModal.tsx` (lignes 46-55)
**Status**: TODO

---

### F1.3 - Creer utilitaire buildQueryString

**Probleme**: Construction URLSearchParams repetee 7 fois dans api.ts
**Action**: Creer fonction utilitaire dans `src/network/api.ts` ou `src/utils/queryString.ts`
**Signature**: `buildQueryString(params: Record<string, string | number | string[] | undefined>): string`
**Fichier concerne**: `src/network/api.ts` (lignes 70-78, 120-128, 232-240, 245-254, 260-269, 466-475, 477-486)
**Pattern a extraire**:
```typescript
const queryParams = new URLSearchParams();
if (params.limit) queryParams.set("limit", params.limit.toString());
if (params.offset) queryParams.set("offset", params.offset.toString());
// ... etc
```
**Status**: TODO

---

### F1.4 - Centraliser le formatage de dates

**Probleme**: Implementations locales de `formatDate` dans plusieurs composants au lieu d'utiliser `utils/format.Date.ts`
**Action**: Consolider dans `src/utils/format.Date.ts`, supprimer les implementations locales
**Fichiers concernes**:
- `src/utils/format.Date.ts` (utilitaire existant)
- `src/components/proposals/VariantsDropdown.tsx` (lignes 50-55 - implementation locale)
- `src/components/proposals/ProposalsList.tsx` (lignes 71-79 - implementation locale)
**Status**: TODO

---

### F1.5 - Supprimer dead code

**Probleme**: Composants legacy jamais importes
**Action**: Supprimer les fichiers suivants apres verification qu'ils ne sont importes nulle part
**Fichiers a supprimer**:
- `src/components/Recipe.tsx` - composant legacy non importe
- `src/components/AddEditRecipeDialog.tsx` - remplace par RecipeFormPage, non importe
- `src/styles/Recipe.module.css` - CSS module du composant supprime
- Verifier et supprimer si inutilises : `src/styles/RecipesPage.module.css`, `src/styles/App.module.css`
**Status**: TODO

---

### F1.6 - Standardiser error handling dans api.ts

**Probleme**: Mix de `handleApiError` generique + handlers inline custom (11+ variantes)
**Action**: Creer des error handler factories ou un wrapper unifie
**Fichier**: `src/network/api.ts`
**Cas identifies**:
- Lignes 80-81 : `handleApiError` generique
- Lignes 85-97 : custom handler avec 404/403
- Lignes 149-156 : custom 400
- Lignes 165-175 : custom 409
- Lignes 193-202 : custom 403/400
- Lignes 400-412, 414-426 : admin handlers
**Bug potentiel ligne 136**: `return response.data.community` au lieu de `response.data` (a verifier)
**Status**: TODO

---

## PRIORITE 2 - Composants dupliques & reutilisables

### F2.1 - Fusionner ShareRecipeModal et SharePersonalRecipeModal

**Probleme**: 2 composants 90% identiques (180 lignes chacun)
**Action**: Creer un seul `ShareModal` avec prop `mode: "community" | "personal"`
**Differences a gerer**:
- Props : `currentCommunityId` (community only)
- Filtre : exclure communaute courante + deja partagees vs seulement deja partagees
- API call : `shareRecipe()` vs `publishToCommunities()`
- Textes mineurs
**Fichiers concernes**:
- `src/components/share/ShareRecipeModal.tsx` (189 lignes)
- `src/components/share/SharePersonalRecipeModal.tsx` (180 lignes)
**Status**: TODO

---

### F2.2 - Factoriser RecipeCard et RecipeListRow

**Probleme**: 2 composants avec 95% de logique identique, seul le layout differe
**Action**: Extraire la logique commune dans un hook `useRecipeItem` ou un composant HOC
**Logique commune**:
- Handler functions (delete, share, tag click)
- Tag rendering
- Creator display
- Action buttons
**Fichiers concernes**:
- `src/components/recipes/RecipeCard.tsx` (136 lignes)
- `src/components/recipes/RecipeListRow.tsx` (138 lignes)
**Status**: TODO

---

### F2.3 - Creer composants UI reutilisables

**Probleme**: Patterns UI repetes sans abstraction
**Action**: Creer les composants suivants dans `src/components/ui/`

**a) ErrorAlert** (repete 5+ fois)
```tsx
{error && <div className="alert alert-error"><span>{error}</span></div>}
```
Fichiers : LoginModal, ShareRecipeModal, SharePersonalRecipeModal, ProposeModificationModal, InviteUserModal

**b) LoadingSpinner** (repete 20+ fois)
```tsx
<span className="loading loading-spinner loading-lg" />
```

**c) EmptyState** (repete avec variations)
```tsx
<div className="text-center py-12"><p className="text-lg text-base-content/60">{message}</p></div>
```
Fichiers : RecipesPageLoggedInView, CommunityRecipesList, ActivityFeed

**d) StatusBadge** (logique badge repetee)
```tsx
<span className={`badge badge-sm ${statusClass}`}>{status}</span>
```
Fichiers : SentInvitesList, InviteCard

**Status**: TODO

---

### F2.4 - Extraire hook usePaginatedList

**Probleme**: Logique pagination + load more + append quasi-identique dans 2 composants
**Action**: Creer `src/hooks/usePaginatedList.ts`
**Signature**: `usePaginatedList<T>(fetchFn, filters) => { data, isLoading, error, loadMore, hasMore, reset }`
**Fichiers concernes**:
- `src/components/RecipesPageLoggedInView.tsx` (lignes 49-79)
- `src/components/communities/CommunityRecipesList.tsx` (lignes 47-77)
**Status**: TODO

---

### F2.5 - Remplacer window.confirm par modal custom

**Probleme**: `window.confirm()` utilise 5 fois - UX legacy, non stylisable
**Action**: Creer `src/components/ui/ConfirmDialog.tsx` ou hook `useConfirm()`
**Fichiers concernes**:
- `src/components/recipes/RecipeCard.tsx` (ligne 39)
- `src/components/recipes/RecipeListRow.tsx` (ligne 39)
- `src/components/communities/MembersList.tsx` (lignes 24, 40, 63)
**Status**: TODO

---

### F2.6 - Factoriser invite response handlers

**Probleme**: Logique accept/reject identique dans 2 composants
**Action**: Extraire dans un hook `useInviteActions()`
**Fichiers concernes**:
- `src/components/Navbar/NotificationDropdown.tsx` (lignes 63-91)
- `src/components/invitations/InviteCard.tsx` (lignes 17-40)
**Status**: TODO

---

## PRIORITE 3 - Qualite & bonnes pratiques React

### F3.1 - Remplacer anti-pattern key pour force re-render

**Probleme**: `proposalsKey` incremente pour forcer le re-render de ProposalsList
**Action**: Utiliser un callback `onRefresh` ou un state partage pour trigger le refetch
**Fichier**: `src/pages/RecipeDetailPage.tsx` (lignes 23, 276)
**Status**: TODO

---

### F3.2 - Remplacer window.dispatchEvent par state/context

**Probleme**: `window.dispatchEvent(new Event("community-updated"))` pour sync inter-composants
**Action**: Utiliser un context ou un callback prop
**Fichier**: `src/pages/CommunityDetailPage.tsx` (ligne 100)
**Status**: TODO

---

### F3.3 - Fix index comme key dans IngredientList

**Probleme**: Utilise `index` comme key dans une liste modifiable (reorder/delete possible)
**Action**: Generer un ID stable pour chaque ingredient (uuid ou nanoid)
**Fichier**: `src/components/form/IngredientList.tsx` (ligne 159)
**Status**: TODO

---

### F3.4 - Retirer console.error du code production

**Probleme**: 15+ `console.error` dans le code de production
**Action**: Remplacer par un logger conditionnel ou supprimer
**Fichiers concernes**:
- `src/network/api.ts` (ligne 19)
- `src/contexts/AuthContext.tsx` (ligne 85)
- `src/pages/RecipeDetailPage.tsx` (lignes 39, 57, 77)
- `src/pages/RecipeFormPage.tsx` (lignes 60, 96)
- `src/components/RecipesPageLoggedInView.tsx` (lignes 73, 148)
- `src/components/Navbar/NavBarLoggedInView/NavBarLoggedInView.tsx` (ligne 26)
- `src/components/communities/CommunityRecipesList.tsx` (lignes 71, 110)
- `src/components/form/IngredientSelector.tsx` (ligne 30)
- `src/components/form/IngredientList.tsx` (ligne 41)
- `src/components/form/TagSelector.tsx` (ligne 32)
- `src/components/share/SharePersonalRecipeModal.tsx` (lignes 43, 75)
- `src/components/share/ShareRecipeModal.tsx` (lignes 46, 84)
- `src/components/ErrorBoundary.tsx` (ligne 22 - celui-ci est acceptable)
**Status**: TODO

---

### F3.5 - Decomposer les pages trop grosses

**Probleme**: Pages de 300+ lignes qui melangent state, logic et UI
**Action**: Extraire en sous-composants et hooks

**a) RecipeDetailPage.tsx (317 lignes)**
- Extraire `useRecipeDetail(recipeId)` hook
- Extraire composant `RecipeModals` pour les 3 modals
**b) CommunityDetailPage.tsx (310 lignes)**
- Extraire logique edit inline dans un hook
- Extraire gestion panel width
**c) RecipesPageLoggedInView.tsx (289 lignes)**
- Sera grandement simplifie par F2.4 (usePaginatedList)

**Status**: TODO

---

### F3.6 - Consolider states lies en objets

**Probleme**: Multiple `useState` pour des states conceptuellement lies
**Action**: Regrouper en objets ou utiliser `useReducer` pour les cas complexes
**Exemples**:
- `RecipeDetailPage.tsx` : 3 modals booleans -> `useState({ propose: false, share: false, publish: false })`
- `ProfilePage.tsx` : profileError/profileLoading/profileSuccess -> objet unique
- `NotificationDropdown.tsx` : actionLoading/actionError -> objet unique
**Status**: TODO

---

### F3.7 - Ajouter aria-label manquants

**Probleme**: Certains boutons icon-only n'ont pas d'aria-label
**Action**: Audit a11y rapide et ajout des labels manquants
**Status**: TODO
