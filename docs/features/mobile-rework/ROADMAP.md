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

- [ ] Conditionner `NavBar` : `hidden md:flex` quand user connecte (masquer sur mobile)
- [ ] Ajouter `BottomTabBar` quand `useIsMobile() && user`
- [ ] Position toasts : `bottom-center` mobile (bottom: 72px), `top-right` desktop

### 2.2 - MainLayout

- [ ] Appliquer `md:drawer-open` (remplacement du pointer-fine)
- [ ] Ajouter `padding-bottom: calc(56px + var(--safe-area-bottom))` sur le contenu mobile
- [ ] Supprimer la barre hamburger mobile (remplacee par le drawer via sidebar dans tab bar)

### 2.3 - Sidebar

- [ ] Touch targets 48px sur les items de navigation
- [ ] Breakpoints `md:flex`/`md:hidden` au lieu de pointer variants
- [ ] Ajouter theme toggle dans le footer du drawer sidebar

### 2.4 - Dropdowns -> navigation

- [ ] `NotificationDropdown.tsx` : sur mobile, `navigate('/notifications')` au lieu d'ouvrir le dropdown
- [ ] `NavBarLoggedInView.tsx` : non rendu sur mobile (NavBar masquee)

### 2.5 - ProfilePage hub mobile

- [ ] Ajouter lien vers Invitations (`/invitations`) visible uniquement sur mobile
- [ ] Ajouter theme toggle visible uniquement sur mobile
- [ ] Ajouter bouton Logout visible uniquement sur mobile

### 2.6 - Tests Phase 2

- [ ] Test NavBar masquee sur mobile
- [ ] Test BottomTabBar visible sur mobile connecte, absent sur desktop
- [ ] Test navigation NotificationDropdown -> /notifications sur mobile
- [ ] Test ProfilePage liens supplementaires visibles uniquement sur mobile

---

## Phase 3 — Corrections de layout

Fixer les debordements et les layouts casses.

### 3.1 - RecipeDetailPage

- [ ] Action buttons (6) : remplacer par un bouton "..." ouvrant un `ActionSheet` sur mobile
- [ ] Image hero : hauteur `h-48` au lieu de `h-64` sur mobile
- [ ] Layout general : adaptation responsive existante a verifier

### 3.2 - CommunityDetailPage

- [ ] SidePanel : `BottomSheet` sur mobile au lieu du panneau lateral
- [ ] Boutons header : labels visibles au lieu de tooltips sur mobile (touch targets)
- [ ] Suppression du resize handle sur mobile (inutile en BottomSheet)

### 3.3 - Filtres recettes

- [ ] `RecipeFilters.tsx` : supprimer `min-w-[200px]` sur mobile
- [ ] Layout vertical (un filtre par ligne) sur mobile
- [ ] Filtres repliables : bouton "Filtres" avec badge nombre actifs, collapse/expand slide-down

### 3.4 - Listes et grilles

- [ ] `MembersList.tsx` : cartes au lieu de table sur mobile
- [ ] `RecipesPageLoggedInView.tsx` : masquer toggle card/list sur mobile, forcer card view
- [ ] `CommunityRecipesList.tsx` : idem, forcer card view mobile

### 3.5 - Pages formulaires

- [ ] `RecipeFormPage.tsx` : stacker titre + bouton import verticalement sur mobile
- [ ] `NotificationsPage.tsx` : layout filtres adapte mobile (vertical, toggle en dessous)

### 3.6 - Etats vides

- [ ] CTA dans la thumb zone (centre-bas), boutons 48px (`btn-lg`), messages courts
- [ ] Concerne : `DataContainer.tsx`, `DashboardPage.tsx`, `RecipesPageLoggedInView.tsx`, `CommunityRecipesList.tsx`

### 3.7 - Tests Phase 3

- [ ] Tests visuels RecipeDetailPage (ActionSheet au lieu de boutons en ligne)
- [ ] Tests MembersList (cards vs table selon viewport)
- [ ] Tests filtres repliables (collapse/expand, badge compteur)

---

## Phase 4 — Formulaires tactiles

Optimiser les composants de saisie pour le tactile.

### 4.1 - IngredientList

- [ ] Layout stacke sur mobile : quantite + unite sur 1 ligne, ingredient sur la ligne suivante
- [ ] Touch targets 44px sur boutons supprimer/ajouter

### 4.2 - StepEditor

- [ ] Layout mobile : boutons (supprimer, deplacer) sous le textarea au lieu de sur le cote
- [ ] Touch targets 44px sur boutons drag handle, supprimer
- [ ] Verification drag-and-drop tactile (@dnd-kit touch sensors)

### 4.3 - SearchSelector

- [ ] Touch targets 44px sur les items du dropdown de resultats
- [ ] Padding augmente sur les chips (faciliter la suppression)

### 4.4 - RecipeCard

- [ ] Touch targets 44px sur les boutons d'action (edit, delete, share)
- [ ] Espacement suffisant entre les boutons

### 4.5 - Modales complexes

- [ ] `ProposeModificationModal.tsx` : plein ecran sur mobile (`inset-0` au lieu de modal centree)
- [ ] Gestion back button via `history.pushState` si necessaire

### 4.6 - Upload images

- [ ] `ImageUpload.tsx` / `ImagePicker.tsx` : texte adapte au tactile ("Appuyez pour ajouter" au lieu de "Glissez-deposez")

### 4.7 - Tests Phase 4

- [ ] Tests IngredientList layout mobile (stacked)
- [ ] Tests StepEditor layout mobile (boutons en dessous)
- [ ] Tests ProposeModificationModal plein ecran mobile

---

## Phase 5 — Polish et QA

### 5.1 - Audit touch targets

- [ ] Audit systematique 44px minimum sur tous les elements interactifs
- [ ] Corriger les elements detectes en dessous du seuil

### 5.2 - Scroll et spacing

- [ ] Verifier scroll derriere la bottom tab bar (padding-bottom adequat)
- [ ] Verifier que les derniers elements des listes sont visibles au-dessus de la tab bar
- [ ] Verifier comportement clavier virtuel (input focus, scroll, tab bar masquee)

### 5.3 - Tests multi-devices

- [ ] iPhone SE (375px) — plus petit ecran supporte
- [ ] iPhone 14 (390px) — taille standard
- [ ] iPhone 14 Pro Max (430px) — grand ecran
- [ ] Samsung Galaxy (360px) — Android petit
- [ ] Pixel (412px) — Android standard
- [ ] Mode paysage sur chaque device

### 5.4 - Tests themes et accessibilite

- [ ] Theme coffee sur mobile — contraste, lisibilite
- [ ] Theme winter sur mobile — contraste, lisibilite
- [ ] `prefers-reduced-motion` : verifier que toutes les animations sont desactivees

### 5.5 - Performance

- [ ] Verifier que les re-renders lies a `useIsMobile()` sont minimaux
- [ ] Profiler la bottom tab bar (pas de re-render a chaque scroll)
- [ ] Verifier le poids des nouveaux composants sur le bundle

### 5.6 - Mise a jour documentation

- [ ] Mettre a jour `.claude/context/FILE_MAP.md` (nouveaux fichiers)
- [ ] Mettre a jour `.claude/context/PROGRESS.md`
- [ ] Cocher la feature dans `docs/0 - brainstorming futur.md`

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
