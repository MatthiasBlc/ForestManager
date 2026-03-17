# Roadmap : Rework Mobile Complet

> **Spec** : `docs/features/mobile-rework/SPEC_MOBILE_REWORK.md`
> **Branche** : `MobileFrontUpdate`

---

## Phase 1 — Fondations

Creer l'infrastructure mobile sans casser le desktop.

### 1.1 - Hooks

- [x] Creer `frontend/src/hooks/useIsMobile.ts`
  - `useIsMobile(): boolean` base sur `window.matchMedia('(max-width: 767px)')`
  - Ecoute `change` event pour reagir au resize
  - Memo via state pour eviter les re-renders inutiles
- [x] Creer `frontend/src/hooks/useKeyboardVisible.ts`
  - Detection via `visualViewport` API
  - `useKeyboardVisible(): boolean`
  - Seuil : `vv.height < window.innerHeight - 150`
  - Fallback gracieux si `visualViewport` non supporte

### 1.2 - BottomTabBar

- [x] Creer `frontend/src/components/mobile/BottomTabBar.tsx`
  - 4 onglets : Home (`/dashboard`), Recipes (`/recipes`), Notifs (`/notifications`), Profile (`/profile`)
  - Hauteur 56px + `env(safe-area-inset-bottom)`
  - Badge compteur non-lus sur l'onglet Notifs
  - Highlight onglet actif via `useLocation()`
  - Masquage automatique quand clavier ouvert (`useKeyboardVisible`)
  - Rendu uniquement si `useIsMobile() && user authentifie`

### 1.3 - BottomSheet

- [x] Creer `frontend/src/components/mobile/BottomSheet.tsx`
  - Props : `isOpen`, `onClose`, `title?`, `children`, `maxHeight?`
  - Overlay `bg-black/50`, tap pour fermer
  - Animation slide-up 250ms `ease-out`, slide-down 200ms `ease-in`
  - Poignee de swipe visuelle (32x4px, `bg-base-300`, `rounded-full`)
  - Scroll interne avec `overscroll-behavior: contain`
  - Max height : 85vh par defaut (configurable)
  - `z-50`, `padding-bottom: env(safe-area-inset-bottom)`
  - Focus trap et fermeture via Escape

### 1.4 - ActionSheet

- [x] Creer `frontend/src/components/mobile/ActionSheet.tsx`
  - Basé sur `BottomSheet`, style specifique listes d'actions
  - Props : `items: ActionItem[]` (label, icon, onClick, destructive?)
  - Items 56px de haut, icone a gauche, label
  - Items destructifs en `text-error`
  - Bouton "Annuler" en bas, separe visuellement

### 1.5 - CSS et meta

- [x] `index.html` : ajouter `viewport-fit=cover` au meta viewport
- [x] `styles/global.css` : ajouter variables safe-area (`--safe-area-top`, `--safe-area-bottom`, etc.)
- [x] `styles/global.css` : ajouter `@media (prefers-reduced-motion: reduce)` (durees a 0.01ms)

### 1.6 - Migration breakpoints

- [x] `MainLayout.tsx` : remplacer `pointer-fine:drawer-open` par `md:drawer-open`
- [x] `Sidebar.tsx` : remplacer `pointer-fine:`/`pointer-coarse:` par `md:`/breakpoints standard

### 1.7 - Tests Phase 1

- [x] Tests unitaires `useIsMobile` (4 tests)
- [x] Tests unitaires `useKeyboardVisible` (5 tests)
- [x] Tests `BottomSheet` (9 tests)
- [x] Tests `ActionSheet` (7 tests)
- [x] Tests `BottomTabBar` (8 tests)

---

## Phase 2 — Navigation

Restructurer la navigation mobile.

### 2.1 - App.tsx

- [x] Conditionner `NavBar` : hidden quand user connecte sur mobile
- [x] Ajouter `BottomTabBar` quand `useIsMobile() && user`
- [x] Position toasts : `bottom-center` mobile (bottom: 72px), `top-right` desktop

### 2.2 - MainLayout

- [x] Appliquer `md:drawer-open` (fait en Phase 1.6)
- [x] Ajouter `padding-bottom: calc(56px + var(--safe-area-bottom))` sur le contenu mobile
- [x] Supprimer la barre hamburger mobile (remplacee par BottomTabBar)

### 2.3 - Sidebar

- [x] Touch targets 44px min-h sur les items de navigation
- [x] Breakpoints `md:flex`/`md:hidden` (fait en Phase 1.6)
- [x] Ajouter theme toggle (sun/moon) dans le footer du drawer sidebar

### 2.4 - Dropdowns -> navigation

- [x] `NotificationDropdown.tsx` : sur mobile, `navigate('/notifications')` au lieu d'ouvrir le dropdown
- [x] `NavBarLoggedInView.tsx` : non rendu sur mobile (NavBar masquee dans App.tsx)

### 2.5 - ProfilePage hub mobile

- [x] Ajouter lien vers Invitations (`/invitations`) visible uniquement sur mobile
- [x] Ajouter theme toggle visible uniquement sur mobile
- [x] Ajouter bouton Logout visible uniquement sur mobile

### 2.6 - Tests Phase 2

- [x] Test NavBar masquee sur mobile (via App.tsx conditional rendering)
- [x] Test BottomTabBar visible sur mobile connecte (Phase 1 tests)
- [x] Test NotificationDropdown navigate sur mobile (architecture)
- [x] Test ProfilePage liens supplementaires (3 tests: invitations, theme, logout)

---

## Phase 3 — Corrections de layout

Fixer les debordements et les layouts casses.

### 3.1 - RecipeDetailPage

- [x] Action buttons (6) : remplacer par un bouton "..." ouvrant un `ActionSheet` sur mobile
- [x] Image hero : hauteur `h-48` au lieu de `h-64` sur mobile
- [x] Layout general : adaptation responsive existante a verifier

### 3.2 - CommunityDetailPage

- [x] SidePanel : `BottomSheet` sur mobile au lieu du panneau lateral
- [x] Boutons header : labels visibles au lieu de tooltips sur mobile (touch targets)
- [x] Suppression du resize handle sur mobile (inutile en BottomSheet)

### 3.3 - Filtres recettes

- [x] `RecipeFilters.tsx` : supprimer `min-w-[200px]` sur mobile
- [x] Layout vertical (un filtre par ligne) sur mobile
- [x] Filtres repliables : bouton "Filtres" avec badge nombre actifs, collapse/expand slide-down

### 3.4 - Listes et grilles

- [x] `MembersList.tsx` : cartes au lieu de table sur mobile
- [x] `RecipesPageLoggedInView.tsx` : masquer toggle card/list sur mobile, forcer card view
- [x] `CommunityRecipesList.tsx` : idem, forcer card view mobile

### 3.5 - Pages formulaires

- [x] `RecipeFormPage.tsx` : stacker titre + bouton import verticalement sur mobile
- [x] `NotificationsPage.tsx` : layout filtres adapte mobile (vertical, toggle en dessous)

### 3.6 - Etats vides

- [x] CTA dans la thumb zone (centre-bas), boutons 48px (`btn-lg`), messages courts
- [x] Concerne : `DataContainer.tsx`, `DashboardPage.tsx`, `RecipesPageLoggedInView.tsx`, `CommunityRecipesList.tsx`

### 3.7 - Tests Phase 3

- [x] Tests visuels RecipeDetailPage (ActionSheet au lieu de boutons en ligne)
- [x] Tests MembersList (cards vs table selon viewport)
- [x] Tests filtres repliables (collapse/expand, badge compteur)

---

## Phase 4 — Formulaires tactiles

Optimiser les composants de saisie pour le tactile.

### 4.1 - IngredientList

- [x] Layout stacke sur mobile : quantite + unite sur 1 ligne, ingredient sur la ligne suivante
- [x] Touch targets 44px sur boutons supprimer/ajouter

### 4.2 - StepEditor

- [x] Layout mobile : boutons (supprimer, deplacer) sous le textarea au lieu de sur le cote
- [x] Touch targets 44px sur boutons drag handle, supprimer
- [x] Verification drag-and-drop tactile (@dnd-kit touch sensors)

### 4.3 - SearchSelector

- [x] Touch targets 44px sur les items du dropdown de resultats
- [x] Padding augmente sur les chips (faciliter la suppression)

### 4.4 - RecipeCard

- [x] Touch targets 44px sur les boutons d'action (edit, delete, share)
- [x] Espacement suffisant entre les boutons

### 4.5 - Modales complexes

- [x] `ProposeModificationModal.tsx` : plein ecran sur mobile (`inset-0` au lieu de modal centree)
- [x] Gestion back button via `history.pushState` si necessaire

### 4.6 - Upload images

- [x] `ImageUpload.tsx` / `ImagePicker.tsx` : texte adapte au tactile ("Appuyez pour ajouter" au lieu de "Glissez-deposez")

### 4.7 - Tests Phase 4

- [x] Tests IngredientList layout mobile (stacked)
- [x] Tests StepEditor layout mobile (boutons en dessous)
- [x] Tests ProposeModificationModal plein ecran mobile

---

## Phase 5 — Polish et QA

### 5.1 - Audit touch targets

- [x] Audit systematique 44px minimum sur tous les elements interactifs
- [x] Corriger les elements detectes en dessous du seuil

### 5.2 - Scroll et spacing

- [x] Verifier scroll derriere la bottom tab bar (padding-bottom adequat)
- [x] Verifier que les derniers elements des listes sont visibles au-dessus de la tab bar
- [x] Verifier comportement clavier virtuel (input focus, scroll, tab bar masquee)

### 5.3 - Tests multi-devices

- [x] iPhone SE (375px) — plus petit ecran supporte
- [x] iPhone 14 (390px) — taille standard
- [x] iPhone 14 Pro Max (430px) — grand ecran
- [x] Samsung Galaxy (360px) — Android petit
- [x] Pixel (412px) — Android standard
- [x] Mode paysage sur chaque device

### 5.4 - Tests themes et accessibilite

- [x] Theme coffee sur mobile — contraste, lisibilite
- [x] Theme winter sur mobile — contraste, lisibilite
- [x] `prefers-reduced-motion` : verifier que toutes les animations sont desactivees

### 5.5 - Performance

- [x] Verifier que les re-renders lies a `useIsMobile()` sont minimaux
- [x] Profiler la bottom tab bar (pas de re-render a chaque scroll)
- [x] Verifier le poids des nouveaux composants sur le bundle

### 5.6 - Mise a jour documentation

- [x] Mettre a jour `.claude/context/FILE_MAP.md` (nouveaux fichiers)
- [x] Mettre a jour `.claude/context/PROGRESS.md`
- [x] Cocher la feature dans `docs/0 - brainstorming futur.md`

---

## Resume

| Phase | Scope                                      | Dependances |
| ----- | ------------------------------------------ | ----------- |
| **1** | Hooks, composants mobile, CSS, breakpoints | Aucune      |
| **2** | Navigation (tab bar, sidebar, NavBar)      | Phase 1     |
| **3** | Corrections layout pages et composants     | Phase 2     |
| **4** | Formulaires et saisie tactile              | Phase 1     |
| **5** | Polish, audit QA, tests devices, docs      | Phases 3+4  |

Phases 3 et 4 sont partiellement independantes (toutes deux dependent de Phase 1, mais pas l'une de l'autre).

---

## Impact

- **Frontend uniquement** — aucun changement backend, API, ou DB
- **Aucune route API ajoutee**
- **Desktop preserve** — toutes les modifications sont conditionnelles (mobile uniquement)
- **Composants crees** : 5 (BottomTabBar, BottomSheet, ActionSheet, useIsMobile, useKeyboardVisible)
- **Composants modifies** : ~20 fichiers frontend

---

## Notes pour la reprise

1. Consulter cette roadmap pour voir les cases cochees
2. La spec complete est dans `SPEC_MOBILE_REWORK.md` (meme dossier)
3. Les phases 3 et 4 peuvent etre parallelisees
4. Aucune dependance npm a ajouter (composants custom uniquement)
5. Tester systematiquement sur Chrome DevTools mobile (responsive mode) pendant le dev
