# Spec : Rework Mobile Complet

## 1. Constat

L'application est actuellement inutilisable sur mobile. L'audit exhaustif de chaque composant et page du frontend revele 26 problemes concrets, regroupes en 5 categories.

### A. Problemes structurels / architecturaux

**A1. Double couche de navigation = perte d'espace vertical**

La NavBar (`App.tsx`) occupe ~64px en haut. En dessous, le bouton hamburger mobile du drawer (`MainLayout.tsx`) ajoute ~48px. Total : **~112px de chrome** avant le contenu. Sur un iPhone SE (667px de hauteur visible), c'est 16.8% de l'ecran consomme par la navigation seule.

```
┌────────────────────────────────────┐
│ NavBar: Forest Manager  🌙 🔔 👤  │ ~64px
├────────────────────────────────────┤
│ ☰ Menu                            │ ~48px
├────────────────────────────────────┤
│                                    │
│         Contenu visible            │ ~455px restants
│         (68% de l'ecran)           │
│                                    │
└────────────────────────────────────┘
```

**A2. Sidebar en overlay plein ecran**

Quand le drawer s'ouvre sur mobile, il couvre 100% du contenu. Apres un clic sur une communaute, le drawer se ferme. Aucun contexte visuel n'est conserve.

**A3. Pas de navigation en bas d'ecran**

Toute la navigation est en haut. Sur les smartphones modernes (6.1"-6.7"), le haut de l'ecran est la zone la plus difficile a atteindre avec le pouce. La "thumb zone" (zone de confort du pouce) se situe dans le tiers inferieur de l'ecran.

**A4. Pas de gestion des safe areas**

Aucun `env(safe-area-inset-*)` pour les ecrans avec encoche (iPhone X+), Dynamic Island, ou barre de navigation Android gestuelle. Le contenu peut passer derriere.

### B. Problemes de debordement (overflow)

**B1. NotificationDropdown : `w-96` (384px)**

L'iPhone SE a un viewport de 375px. Le dropdown deborde de 9px. Avec `absolute right-0`, il sort a gauche de l'ecran.

**B2. VariantsDropdown : `w-72` (288px)**

Meme probleme avec `absolute right-0`. Moins grave car 288 < 375, mais le padding du parent peut le faire deborder.

**B3. RecipeDetailPage : jusqu'a 6 boutons d'action en ligne**

Boutons possibles : Variants, Share, Suggest tag, Propose changes, Edit, Delete. Chaque bouton fait ~80-120px (icone + texte). Total minimum : ~500px. Sur un ecran de 375px, ca deborde massivement. Aucun `flex-wrap` n'est applique.

```tsx
// RecipeDetailPage.tsx L196-259 — aucune gestion du wrap
<div className="flex gap-2 items-center">{/* 6 boutons potentiels sans flex-wrap */}</div>
```

**B4. RecipeFilters : `min-w-[200px]` sur 3 filtres**

Trois filtres avec `min-w-[200px]` dans un `flex gap-4 flex-wrap`. Le wrap fonctionne mais chaque filtre occupe ensuite toute la largeur, ce qui empile 3 blocs de 200px+ verticalement — beaucoup d'espace utilise.

### C. Problemes d'interaction tactile

**C1. SidePanel : resize uniquement a la souris**

`SidePanel.tsx` utilise `onMouseDown`/`onMouseMove`/`onMouseUp`. Aucun event tactile. Le resize est inutilisable sur mobile. Pire : le panel fait minimum 250px dans un `flex gap-6`. Sur un ecran de 375px : 375 - 250 - 24 = **101px pour le contenu** — inutilisable.

**C2. Tooltips DaisyUI sur touch**

`CommunityDetailPage.tsx` : tous les boutons de l'en-tete (Members, Activity, Invitations, Tags, Edit) utilisent `tooltip tooltip-bottom data-tip="..."`. Ces tooltips sont hover-only, donc **invisibles sur mobile**. L'utilisateur ne sait pas ce que font les boutons icones.

**C3. Cibles tactiles trop petites**

De nombreux elements interactifs utilisent `btn-xs` (~24px) ou `btn-sm btn-circle` (~32px). La taille minimum recommandee est 44x44px (Apple HIG) / 48x48dp (Material Design).

Elements concernes :

- Actions membres : Promote, Kick (`btn-ghost btn-xs`)
- Mark as read dans les notifications (`btn-ghost btn-xs`)
- StepEditor : boutons Move up/down/Delete (`btn-ghost btn-xs`)
- Chips remove button dans SearchSelector (12px FaTimes)

**C4. Drag handle du StepEditor trop petit**

`btn-xs` avec `FaGripVertical`. La zone de prise est ~24x24px, bien en dessous des 44px recommandes. Le reordonnement par drag fonctionne (PointerSensor de @dnd-kit supporte le touch) mais est penible a utiliser.

**C5. IngredientRow : 4 colonnes horizontales comprimees**

Layout : `flex gap-2` avec nom (flex-1) + quantite (w-24) + unite (w-28) + bouton supprimer.
Sur 375px : 375 - 32(padding page) - 16(padding form) - 24 - 28\*4 - 8(gaps) ~= 183px pour le nom. Utilisable mais inconfortable, surtout avec le clavier virtuel ouvert qui reduit la vue.

### D. Problemes de mise en page du contenu

**D1. CommunityDetailPage : SidePanel ecrase le contenu**

`flex gap-6` avec le SidePanel (min 250px). Sur mobile, le contenu principal est comprime a quelques pixels. Le panel devrait etre un overlay, pas un element lateral.

**D2. RecipeDetailPage : image hero trop haute**

`h-64` (256px) sur mobile. Sur un iPhone SE, c'est 38% de l'ecran visible occupe par l'image seule. L'utilisateur doit scroller pour voir le titre.

**D3. MembersList : tableau HTML non adapte**

`<table>` avec 4 colonnes (Username, Role, Joined, Actions). Les tableaux ne se compressent pas bien sur mobile. Les boutons d'action ajoutent encore plus de largeur.

**D4. ProposeModificationModal : formulaire complexe dans un modal**

Le modal contient : titre, servings, 3 champs temps, IngredientList complet, StepEditor complet. Sur mobile, ce modal (meme en `modal-bottom`) devient un formulaire scrollable de 1000px+ de haut dans une boite contrainte. Devrait etre une page plein ecran.

### E. Problemes d'UX mobile

**E1. Dropdowns au lieu de pages**

NotificationDropdown et UserMenu utilisent des panneaux absolus. Sur mobile, il faut scroller dans un petit dropdown, facile a fermer accidentellement. Les apps mobiles utilisent des pages pleines ou des bottom sheets pour ce type de contenu.

**E2. Texte d'upload non adapte au tactile**

"Cliquez ou glissez une image ici" — le drag & drop n'existe pas sur mobile. Le texte devrait dire simplement "Appuyez pour ajouter une image".

**E3. Pas de gestes de swipe**

Aucun swipe-to-dismiss pour les modals, aucun swipe pour ouvrir/fermer le drawer, aucun pull-to-refresh.

**E4. Variante `pointer-fine`/`pointer-coarse` fragile**

Le code utilise des variantes Tailwind custom `pointer-fine` (desktop) / `pointer-coarse` (mobile) basees sur `@media (pointer: fine/coarse)`. Probleme : un laptop avec ecran tactile reporte les deux. Un iPad avec clavier Bluetooth reporte `pointer-fine`. La detection par viewport width est plus fiable.

---

## 2. Principes de design mobile

### 2.1 Mobile-first ne signifie pas "desktop reduit"

Le mobile a son propre paradigme de navigation. On ne peut pas simplement compresser la version desktop. Les interactions tactiles, la zone de confort du pouce, et les patterns d'utilisation sont fondamentalement differents.

### 2.2 Thumb zone priority

Sur un smartphone tenu a une main, le pouce atteint confortablement :

- **Zone facile** : tiers inferieur + centre
- **Zone atteignable** : milieu de l'ecran
- **Zone difficile** : haut de l'ecran, coin oppose au pouce

Les actions principales doivent etre dans la zone facile.

### 2.3 Touch targets = 44px minimum

Toute zone cliquable/tapable doit faire au minimum 44x44px (recommandation Apple HIG). Les zones critiques (navigation, actions destructives) devraient faire 48px.

### 2.4 Contenu d'abord

Maximiser l'espace pour le contenu. Le chrome (navigation, barres d'outils) doit etre minimal et se cacher/apparaitre intelligemment.

### 2.5 Patterns natifs

Utiliser les patterns que les utilisateurs connaissent deja :

- Bottom tab bar pour la navigation principale
- Bottom sheets pour les menus contextuels
- Swipe pour naviguer entre sections
- Pull-to-refresh (futur)

---

## 3. Strategie de breakpoints

### 3.1 Definitions

| Nom         | Range     | Comportement                                     |
| ----------- | --------- | ------------------------------------------------ |
| **Mobile**  | 0 – 767px | Bottom tabs, pas de NavBar, sidebar en drawer    |
| **Desktop** | 768px+    | NavBar visible, sidebar fixe, pas de bottom tabs |

Le seuil de 768px correspond au `COMPACT_BREAKPOINT` existant et au breakpoint `md:` de Tailwind.

### 3.2 Remplacement de pointer-fine/pointer-coarse

Les variantes `pointer-fine` et `pointer-coarse` seront remplacees par des breakpoints Tailwind standards :

- `pointer-fine:xxx` → `md:xxx`
- `pointer-coarse:xxx` → valeur par defaut (mobile-first) ou condition inverse

Les variantes custom restent dans `tailwind.config.js` pour d'eventuels usages futurs mais ne sont plus utilisees pour la logique mobile/desktop.

### 3.3 Detection JS

Un hook `useIsMobile()` est necessaire pour les cas ou le **comportement** (pas juste le style) change :

```ts
// hooks/useIsMobile.ts
export function useIsMobile(): boolean {
  // Utilise window.matchMedia('(max-width: 767px)')
  // Reactif au resize sans event listener lourd
}
```

**Cas d'usage du hook (JS necessaire)** :

- NotificationDropdown : ouvre un dropdown (desktop) vs navigate vers `/notifications` (mobile)
- UserMenu : ouvre un dropdown (desktop) vs navigate ou ouvre bottom sheet (mobile)
- SidePanel : rendu en panel lateral (desktop) vs bottom sheet (mobile)
- RecipeDetailPage : boutons inline (desktop) vs menu "..." (mobile)

**Tout le reste** : Tailwind breakpoints `md:` (CSS pur, pas de JS).

---

## 4. Architecture de navigation mobile

### 4.1 Vue d'ensemble

```
DESKTOP (>= 768px)                    MOBILE (< 768px)
┌──────────────────────────────┐      ┌──────────────────────┐
│ NavBar: FM  🌙 🔔 👤        │      │                      │
├──────┬───────────────────────┤      │                      │
│      │                       │      │    Contenu plein      │
│ Side │    Contenu             │      │    ecran              │
│ bar  │                       │      │                      │
│      │                       │      │                      │
│      │                       │      ├──────────────────────┤
│      │                       │      │ [🏠] [📖] [🔔] [👤] │
└──────┴───────────────────────┘      └──────────────────────┘
```

### 4.2 Bottom Tab Bar

**4 onglets** :

| Position | Icone  | Label   | Route          | Contenu                                                |
| -------- | ------ | ------- | -------------- | ------------------------------------------------------ |
| 1        | FaHome | Home    | /dashboard     | Dashboard (communautes + recettes recentes + activite) |
| 2        | FaBook | Recipes | /recipes       | Mes recettes perso avec filtres                        |
| 3        | FaBell | Notifs  | /notifications | Page notifications complete                            |
| 4        | FaUser | Profile | /profile       | Profil + preferences + invitations + deconnexion       |

**Pourquoi pas 5 onglets avec Communities ?**
Les communautes sont accessibles depuis :

1. Le dashboard (cartes communautes)
2. Le drawer lateral (icone hamburger ou swipe depuis le bord gauche sur le tab Home)
3. Les notifications (lien direct)

Un 5e onglet surchargerait la barre sur les petits ecrans (375px / 5 = 75px par onglet).

**Design du composant `BottomTabBar`** :

- Hauteur : 56px + `env(safe-area-inset-bottom)` pour les telephones a encoche
- Position : `fixed bottom-0 left-0 right-0`
- Background : `bg-base-100 border-t border-base-300`
- Z-index : `z-50`
- Chaque onglet : icone (20px) + label (10px), zone cliquable = toute la surface (minimum 44px de haut)
- Onglet actif : icone `text-primary` + label `text-primary font-semibold`
- Badge notifications : identique au badge actuel du NotificationDropdown, positionne sur l'icone bell
- Le theme toggle (lune/soleil) est deplace dans la page Profile

**Padding du contenu** :
Le `<main>` doit avoir un `padding-bottom` de `56px + safe-area` pour ne pas passer derriere la tab bar.

### 4.3 NavBar : comportement conditionnel

| Contexte                     | NavBar             | Bottom tabs |
| ---------------------------- | ------------------ | ----------- |
| Non connecte, toutes tailles | Visible (inchange) | Masques     |
| Connecte, desktop (>= 768px) | Visible (inchange) | Masques     |
| Connecte, mobile (< 768px)   | **Masquee**        | Visibles    |

Implementation dans `App.tsx` :

```tsx
// Pseudo-code
<div className="min-h-screen flex flex-col">
  {/* NavBar : visible desktop + non-connecte */}
  <div className="hidden md:block">
    {" "}
    {/* ou logique conditionnelle */}
    <NavBar />
  </div>

  <div className="flex-1 flex flex-col">
    <Routes>{userRoutes}</Routes>
  </div>

  {/* Bottom tabs : visible mobile + connecte */}
  {user && <BottomTabBar className="md:hidden" />}

  <LoginModal />
  <Toaster position="top-right" />
</div>
```

Note : pour les pages publiques (non connecte), la NavBar reste visible sur mobile car elle est legere (logo + login) et il n'y a pas de bottom tabs.

### 4.4 Sidebar sur mobile

Le sidebar (drawer) reste accessible sur mobile **uniquement depuis le tab Home** :

- Via un bouton hamburger dans l'en-tete du dashboard
- OU via un swipe depuis le bord gauche de l'ecran (optionnel, phase ulterieure)

Le drawer s'ouvre en overlay (comme actuellement) mais avec des ameliorations :

- Largeur : `w-72` (288px) au lieu de `w-64` (plus de place pour les noms de communautes)
- Touch targets : 48px minimum pour chaque element de navigation
- Fermeture : tap sur l'overlay OU swipe vers la gauche
- En-tete : "Forest Manager" + bouton fermer (X)

Sur les tabs Recipes, Notifications et Profile, **pas d'acces au drawer**. La navigation entre communautes se fait en revenant au tab Home.

### 4.5 Modification de `MainLayout.tsx`

Le `MainLayout` actuel gere le drawer DaisyUI. Sur mobile, il doit :

1. Ne plus afficher le bouton hamburger en haut (remplace par le bottom tab)
2. Ne plus forcer `pointer-fine:drawer-open` — utiliser `md:drawer-open`
3. Ajouter le padding bottom pour la tab bar

```tsx
// MainLayout.tsx — changements cles
<div className="drawer md:drawer-open h-screen overflow-hidden">
  {/* ... drawer-toggle ... */}
  <div className="drawer-content flex flex-col h-full overflow-hidden z-0">
    {/* Mobile: plus de barre hamburger ici — gere par BottomTabBar/DashboardPage */}
    <main className="flex-1 p-4 md:p-6 overflow-y-auto pb-20 md:pb-6">{children}</main>
  </div>
  {/* Sidebar drawer */}
  <div className="drawer-side z-40 md:z-20">{/* ... inchange ... */}</div>
</div>
```

---

## 5. Composant par composant : comportement mobile

### 5.1 NotificationDropdown

| Desktop                                  | Mobile                                         |
| ---------------------------------------- | ---------------------------------------------- |
| Clic sur cloche → dropdown `w-96` absolu | Clic sur cloche → `navigate('/notifications')` |
| Auto-mark as read apres 3s               | N/A (gere par la page)                         |
| "Voir tout" → navigate                   | N/A                                            |

Le composant utilise `useIsMobile()`. Sur mobile, le `handleToggle` fait un `navigate('/notifications')` au lieu d'ouvrir le dropdown. Le dropdown n'est jamais rendu sur mobile.

La cloche avec badge reste dans la `BottomTabBar`, pas dans le `NotificationDropdown`.

### 5.2 NavBarLoggedInView (UserMenu)

| Desktop                             | Mobile                                        |
| ----------------------------------- | --------------------------------------------- |
| Clic → dropdown `w-64` absolu       | Clic sur onglet Profile → navigate `/profile` |
| Menu : Profile, Invitations, Logout | N/A (ces liens sont dans la page Profile)     |

Le composant n'est plus rendu sur mobile (NavBar est masquee). L'acces au profil, invitations et deconnexion se fait depuis la page Profile, qui doit etre enrichie avec un bouton "Invitations" et un bouton "Logout".

**Modification de `ProfilePage.tsx`** (mobile uniquement) :

- Ajouter un lien vers "Mes invitations" avec badge (+ nombre)
- Ajouter le toggle theme (lune/soleil)
- Ajouter le bouton "Se deconnecter" en rouge

### 5.3 SidePanel (CommunityDetailPage)

| Desktop                         | Mobile                              |
| ------------------------------- | ----------------------------------- |
| Panel lateral resizable 250-50% | Bottom sheet overlay 80% hauteur    |
| Mouse drag pour resize          | Tap overlay ou bouton X pour fermer |
| Panel visible a cote du contenu | Overlay par-dessus le contenu       |

**Composant `BottomSheet`** (nouveau, reutilisable) :

- Overlay sombre (`bg-black/50`) avec tap-to-close
- Panel blanc qui monte depuis le bas (animation `translate-y`)
- Hauteur : 80vh par defaut, scrollable internement
- Barre de poignee en haut (petite barre grise horizontale)
- Fermeture : tap overlay, swipe down, bouton X

Le `CommunityDetailPage` utilise `useIsMobile()` pour choisir :

- Desktop : `<SidePanel>` (inchange)
- Mobile : `<BottomSheet>` avec le meme contenu

Les boutons icones de l'en-tete de communaute (Members, Activity, etc.) deviennent plus grands sur mobile et affichent leur label texte au lieu des tooltips :

```
Desktop: [👥] [📊] [✉️] [🏷️] [✏️]  (icones avec tooltips)
Mobile:  [👥 Members] [📊 Activity] ...  (icones + labels, flex-wrap)
```

### 5.4 RecipeDetailPage

**Boutons d'action** :

| Desktop                   | Mobile                                |
| ------------------------- | ------------------------------------- |
| Tous les boutons en ligne | 1-2 boutons principaux + bouton "..." |
| `flex gap-2 items-center` | Bouton principal + action sheet       |

Sur mobile, logique conditionnelle :

- **Proprietaire** : bouton "Edit" visible + bouton "..." qui ouvre un bottom sheet avec : Share, Delete
- **Non-proprietaire (communaute)** : bouton "Propose" visible + bouton "..." avec : Suggest tag, Variants
- **Recette perso (non proprio)** : rien de special

Le bottom sheet liste les actions avec icones, labels, et zones de 48px de haut.

**Image hero** :

```tsx
// Actuel
<figure className="h-64 md:h-96">

// Mobile : plus court pour voir le titre sans scroller
<figure className="h-40 md:h-64 lg:h-96">
```

**Metadata et tags** : inchanges (flex-wrap fonctionne deja bien).

**Ingredients et etapes** : inchanges (layout vertical, fonctionne bien).

### 5.5 RecipeFormPage

Le formulaire fonctionne deja raisonnablement sur mobile (`max-w-2xl`, `space-y-6`). Corrections :

1. **En-tete** : `flex justify-between items-center` → sur mobile, le bouton "Importer une recette" deborde. Solution : stacker le titre et le bouton sur mobile.

```tsx
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
```

2. **Champs temps** : `grid grid-cols-1 sm:grid-cols-3` — deja correct.

3. **Boutons Save/Cancel** : `flex justify-end gap-4` — OK sur mobile.

### 5.6 RecipeFilters

| Desktop                      | Mobile                                 |
| ---------------------------- | -------------------------------------- |
| 3 filtres en ligne avec wrap | 3 filtres empiles verticalement        |
| Toujours visible             | Repliable derriere un bouton "Filtres" |

Sur mobile (repliable des la v1) :

- Bouton "Filtres" avec badge du nombre de filtres actifs (ex: `Filtres (2)`)
- Au tap, les filtres apparaissent en slide-down (collapse/expand, 200ms `ease-in-out`)
- Chaque filtre occupe 100% de la largeur
- Supprimer `min-w-[200px]` sur mobile
- Les filtres se replient automatiquement apres selection d'un tag/ingredient (pour voir les resultats)

```tsx
// Mobile : bouton toggle + section collapsible
const [filtersOpen, setFiltersOpen] = useState(false);
const activeCount = (search ? 1 : 0) + tags.length + ingredients.length;

<>
  {/* Bouton toggle — mobile uniquement */}
  <button
    className="btn btn-outline btn-sm gap-2 md:hidden mb-4"
    onClick={() => setFiltersOpen(!filtersOpen)}
  >
    <FaFilter />
    Filtres {activeCount > 0 && <span className="badge badge-sm badge-primary">{activeCount}</span>}
  </button>

  {/* Filtres — toujours visibles desktop, collapsible mobile */}
  <div className={`${filtersOpen ? "block" : "hidden"} md:block`}>
    <div className="flex flex-col md:flex-row gap-4 md:flex-wrap p-4 bg-base-200 rounded-lg">
      <div className="w-full md:flex-1 md:min-w-[200px]">{/* Search */}</div>
      {/* ... */}
    </div>
  </div>
</>;
```

### 5.7 IngredientList / IngredientRow

| Desktop             | Mobile                  |
| ------------------- | ----------------------- |
| 4 elements en ligne | Layout en carte stackee |

**Mobile layout pour chaque ingredient** :

```
┌──────────────────────────────────────┐
│ [Ingredient name input       ] [✕]  │
│ [Qty    ] [Unit ▾         ]         │
└──────────────────────────────────────┘
```

Implementation :

```tsx
// Desktop : flex horizontal (inchange)
// Mobile : grid/flex-col
<div className="flex flex-col md:flex-row gap-2 items-stretch md:items-start">
  <div className="flex gap-2 items-start">
    <div className="relative flex-1">{/* Input nom */}</div>
    <button className="btn btn-ghost btn-square text-error md:hidden">
      {/* Remove — visible mobile seulement ici */}
    </button>
  </div>
  <div className="flex gap-2">
    <input type="number" className="input input-bordered w-20 md:w-24" />
    <UnitSelector className="select select-bordered flex-1 md:w-28" />
    <button className="btn btn-ghost btn-square text-error hidden md:flex">
      {/* Remove — visible desktop seulement ici */}
    </button>
  </div>
</div>
```

### 5.8 StepEditor

| Desktop                                  | Mobile                                                           |
| ---------------------------------------- | ---------------------------------------------------------------- |
| [Drag] [Badge] [Textarea] [↑↓✕] vertical | [Drag+Badge] [Textarea full-width] [↑ ↓ ✕] horizontal en dessous |

**Mobile layout** :

```
┌──────────────────────────────────────┐
│ ☰ [1]                               │
│ ┌──────────────────────────────────┐ │
│ │ Textarea instruction...          │ │
│ │ ...                              │ │
│ └──────────────────────────────────┘ │
│ [↑ Move up]  [↓ Move down]    [✕]   │
└──────────────────────────────────────┘
```

- Drag handle : 48x48px minimum
- Boutons move/delete : 44px de haut, texte visible (pas juste icone)
- Textarea : `w-full`

### 5.9 SearchSelector

Le composant fonctionne bien sur mobile (dropdown `w-full`, chips wrap). Corrections mineures :

- Chips : padding augmente de `px-2 py-1` a `px-3 py-1.5` sur mobile pour meilleure zone tactile
- Bouton remove (FaTimes 12px) : wrapper de 28px minimum
- Dropdown items : `py-2` → `py-3` sur mobile pour 44px de haut par item

### 5.10 CommunityRecipesList

Le composant fonctionne correctement. Les grids responsive sont deja en place.

Correction : le header (`flex justify-between items-center mb-6`) peut deborder si le titre + boutons sont trop larges. Stacker sur mobile :

```tsx
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
```

### 5.11 MembersList

| Desktop                  | Mobile          |
| ------------------------ | --------------- |
| Table HTML avec colonnes | Liste de cartes |

**Mobile layout** (chaque membre = une carte) :

```
┌──────────────────────────────────────┐
│ alice_wonder (you)       [MODERATOR] │
│ Joined Jan 15, 2026                 │
│                          [Leave]     │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ bob_chef                    [MEMBER] │
│ Joined Mar 2, 2026                  │
│                    [Promote] [Kick]  │
└──────────────────────────────────────┘
```

Implementation : afficher la `<table>` sur desktop (`hidden md:block`) et les cartes sur mobile (`md:hidden`).

### 5.12 Modal

Le composant `Modal.tsx` utilise deja `modal-bottom sm:modal-middle` — c'est **correct** pour la plupart des modals.

**Exception pour les modals complexes** : `ProposeModificationModal` doit devenir plein ecran sur mobile car il contient des sous-composants complexes (IngredientList, StepEditor).

Solution : ajouter une prop `fullScreenMobile?: boolean` au composant Modal :

```tsx
const modalClass = cn({
  "modal modal-bottom sm:modal-middle": !fullScreenMobile,
  "modal modal-open": !fullScreenMobile,
  // Full screen mobile
  "fixed inset-0 z-50 bg-base-100 overflow-y-auto": fullScreenMobile,
  "md:modal md:modal-open md:modal-middle md:relative md:inset-auto": fullScreenMobile,
});
```

Ou plus simple : le `ProposeModificationModal` n'utilise plus `<Modal>` sur mobile et rend a la place une page plein ecran avec un header (bouton retour + titre) et un formulaire scrollable.

### 5.13 ImageUpload / ImagePicker

Corrections :

- Texte "Cliquez ou glissez une image ici" → sur mobile : "Appuyez pour ajouter une image"
- Detection via `useIsMobile()` ou via un message plus universel : "Ajouter une image" tout court
- Zone de drop : augmenter `p-6` a `p-8` sur mobile pour un meilleur tap target

### 5.14 ImportRecipeModal

Fonctionne bien dans un modal-bottom. Le textarea est `w-full min-h-[200px]`. Aucun changement necessaire.

### 5.15 LoginModal

Fonctionne bien (modal-bottom sur mobile). Aucun changement necessaire.

### 5.16 CommunityCard

Fonctionne bien. Les cartes s'empilent en colonne sur mobile. Aucun changement.

### 5.17 RecipeCard

Fonctionne bien. Les cartes s'empilent en colonne sur mobile.

Correction mineure : les boutons d'action en bas de carte (`btn-ghost btn-sm`) sont un peu petits pour le tactile. Augmenter a `btn-md` sur mobile ou s'assurer que la zone cliquable fait au moins 44px.

### 5.18 RecipeListRow

Sur mobile, la vue liste est moins pratique que les cartes. Deux options :

1. Forcer le mode carte sur mobile (masquer le toggle list/card)
2. Adapter le list row pour mobile (empiler les elements)

**Recommandation** : option 1 (forcer carte sur mobile). Le toggle card/list est masque sous `md:` :

```tsx
<div className="hidden md:flex join">{/* card/list toggle — desktop only */}</div>
```

Sur mobile, toujours afficher en mode carte.

### 5.19 DashboardPage

Le dashboard fonctionne deja bien grace aux grids responsive. Corrections :

- En-tetes de section : stacker titre + bouton sur mobile si debordement
- Le bouton "See all (N)" est petit mais acceptable

### 5.20 NotificationsPage

Fonctionne bien sur mobile. Les filtres par categorie (`flex flex-wrap gap-2`) wrappent correctement.

Corrections :

- Les boutons categorie sont `btn-sm` → augmenter la zone tactile
- Le toggle "Non lues uniquement" avec `ml-auto` peut se retrouver hors champ. Sur mobile, le placer en dessous des categories.

### 5.21 ProfilePage

Fonctionne bien (`max-w-2xl`). Les formulaires s'adaptent.

**Ajouts mobile** (voir 5.2) :

- Section "Navigation" en haut avec liens vers Invitations (+ badge)
- Theme toggle (lune/soleil)
- Bouton Deconnexion visible en rouge

Note : le theme toggle est AUSSI dans le footer du drawer Sidebar (voir 4.4).

### 5.22 CommunityDetailPage (en-tete)

L'en-tete de communaute (`flex justify-between items-start gap-4`) peut deborder sur mobile avec l'image + nom + badge + 5 boutons icones.

**Mobile layout** :

```
┌──────────────────────────────────────┐
│ [img] Community Name       [MODERATOR]│
│       Description text...            │
│       3 members · 12 recipes         │
│                                      │
│ [👥 Members] [📊 Activity] [✉️ Inv.] │
│ [🏷️ Tags]   [✏️ Edit]              │
└──────────────────────────────────────┘
```

- Boutons : `flex flex-wrap gap-2` avec labels texte au lieu de tooltips icone-only
- Zone tactile minimum 44px par bouton
- L'image communaute reste en `w-16 h-16` (correcte)

---

## 6. Nouveau composant : BottomSheet

Composant reutilisable pour remplacer les dropdowns et les panels sur mobile.

### Interface

```ts
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  height?: "auto" | "half" | "full"; // 'auto' = fit content, 'half' = 50vh, 'full' = 90vh
}
```

### Structure

```
┌──────────────── Overlay (bg-black/50, tap to close) ────────────┐
│                                                                   │
│                                                                   │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ ───── (poignee de swipe, 32x4px, bg-base-300, rounded)       │ │
│ │                                                               │ │
│ │  Title (optional)                                     [X]    │ │
│ │ ────────────────────────────────────────────────────────────  │ │
│ │                                                               │ │
│ │  Contenu scrollable                                          │ │
│ │                                                               │ │
│ └───────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### Comportement

- Animation : slide-up de 300ms (`transition-transform`)
- Overlay : fade-in 200ms
- Fermeture : tap overlay, bouton X (swipe down en v2)
- Scroll interne : `-webkit-overflow-scrolling: touch`, overscroll-behavior: contain
- Z-index : `z-50`
- Padding bottom : `env(safe-area-inset-bottom)`

### Usages

- CommunityDetailPage : SidePanel content (Members, Activity, Invitations, Tags, Edit)
- RecipeDetailPage : menu d'actions "..."
- ProfilePage/mobile : pourrait etre utilise pour des sous-sections (futur)

---

## 7. Action sheet pour RecipeDetailPage

Pattern specifique pour les boutons d'action sur mobile.

### Composant `ActionSheet`

Basé sur `BottomSheet` avec un style specifique pour les listes d'actions :

```
┌───────────────────────────────────────┐
│ ─────                                 │
│                                       │
│  [🔀] Voir les variantes (3)         │
│  ─────────────────────────────────    │
│  [↗️] Partager                        │
│  ─────────────────────────────────    │
│  [🏷️] Suggerer un tag               │
│  ─────────────────────────────────    │
│  [🗑️] Supprimer          (en rouge)  │
│                                       │
│  [    Annuler    ]                    │
│                                       │
└───────────────────────────────────────┘
```

Chaque item : 56px de haut, icone a gauche, label, separation entre items.
Item destructif (Delete) : texte en rouge (`text-error`).
Bouton "Annuler" en bas, separe par plus d'espace.

---

## 8. Safe areas

### 8.1 Meta viewport

Dans `index.html`, ajouter `viewport-fit=cover` :

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

### 8.2 CSS

```css
/* global.css */
:root {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);
}
```

### 8.3 Application

- **BottomTabBar** : `padding-bottom: var(--safe-area-bottom)`
- **Main content** : `padding-bottom: calc(56px + var(--safe-area-bottom))` sur mobile
- **Bottom sheets** : `padding-bottom: var(--safe-area-bottom)`
- **Modals bottom** : DaisyUI gere deja le positionnement

---

## 9. Recapitulatif des modifications par fichier

### Fichiers a creer

| Fichier                              | Description                                            |
| ------------------------------------ | ------------------------------------------------------ |
| `components/mobile/BottomTabBar.tsx` | Navigation par onglets en bas                          |
| `components/mobile/BottomSheet.tsx`  | Sheet reutilisable (overlay, slide-up)                 |
| `components/mobile/ActionSheet.tsx`  | Variante du BottomSheet pour listes d'actions          |
| `hooks/useIsMobile.ts`               | Hook de detection viewport < 768px                     |
| `hooks/useKeyboardVisible.ts`        | Hook de detection clavier virtuel (visualViewport API) |

### Fichiers a modifier

| Fichier                               | Changements                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `index.html`                          | Ajouter `viewport-fit=cover`                                                         |
| `styles/global.css`                   | Variables safe-area, padding body mobile                                             |
| `tailwind.config.js`                  | Garder les variantes pointer mais ne plus les utiliser                               |
| `App.tsx`                             | Conditionner NavBar (desktop) vs BottomTabBar (mobile + connecte), toast position    |
| `MainLayout.tsx`                      | `md:drawer-open` au lieu de `pointer-fine:drawer-open`, padding bottom mobile        |
| `Sidebar.tsx`                         | `md:flex`/`md:hidden` au lieu de `pointer-fine`/`pointer-coarse`, touch targets 48px |
| `NavBar.tsx`                          | Ajouter `hidden md:flex` (masquer sur mobile quand connecte)                         |
| `NotificationDropdown.tsx`            | Sur mobile : navigate au lieu d'ouvrir dropdown                                      |
| `NavBarLoggedInView.tsx`              | N'est plus rendu sur mobile (NavBar masquee)                                         |
| `SidePanel.tsx`                       | Desktop : inchange. Mobile : utilise BottomSheet                                     |
| `CommunityDetailPage.tsx`             | Boutons header : labels au lieu de tooltips sur mobile, BottomSheet                  |
| `RecipeDetailPage.tsx`                | Action buttons : ActionSheet sur mobile, image hero plus courte                      |
| `RecipeFormPage.tsx`                  | Stacker titre + bouton import sur mobile                                             |
| `RecipeFilters.tsx`                   | Supprimer `min-w-[200px]` mobile, layout vertical, filtres repliables                |
| `IngredientList.tsx`                  | Layout en carte (stacke) sur mobile                                                  |
| `StepEditor.tsx`                      | Layout mobile : boutons sous le textarea, touch targets 44px                         |
| `SearchSelector.tsx`                  | Touch targets dropdown items, chips padding                                          |
| `RecipesPageLoggedInView.tsx`         | Masquer toggle card/list sur mobile, forcer card view                                |
| `CommunityRecipesList.tsx`            | Idem (forcer card view mobile)                                                       |
| `MembersList.tsx`                     | Table desktop / Cartes mobile                                                        |
| `RecipeCard.tsx`                      | Boutons action : touch targets 44px                                                  |
| `NotificationsPage.tsx`               | Filtres : layout adapte mobile, toggle unread en dessous                             |
| `ProfilePage.tsx`                     | Ajouter liens Invitations + theme + logout sur mobile                                |
| `ProposeModificationModal.tsx`        | Plein ecran sur mobile (pas de Modal wrapper)                                        |
| `ImageUpload.tsx` / `ImagePicker.tsx` | Texte adapte au tactile                                                              |

### Fichiers inchanges

| Fichier                   | Raison                                         |
| ------------------------- | ---------------------------------------------- |
| `Modal.tsx`               | `modal-bottom sm:modal-middle` deja correct    |
| `LoginModal.tsx`          | Fonctionne bien en modal-bottom                |
| `ImportRecipeModal.tsx`   | Fonctionne bien en modal-bottom                |
| `SuggestTagModal.tsx`     | Fonctionne bien (overflow-visible, max-w-lg)   |
| `CommunityCard.tsx`       | Layout responsive deja correct                 |
| `HomePage.tsx`            | Page publique, layout simple et correct        |
| `CommunitiesPage.tsx`     | Grid responsive deja correct                   |
| `InvitationsPage.tsx`     | Grid responsive deja correct                   |
| `CommunityCreatePage.tsx` | Formulaire simple, fonctionne bien             |
| `DashboardPage.tsx`       | Grids responsive corrects, ajustements mineurs |
| `TagSelector.tsx`         | Delegue a SearchSelector                       |
| `UnitSelector.tsx`        | `<select>` natif, fonctionne bien sur mobile   |
| `IngredientSelector.tsx`  | Delegue a SearchSelector                       |

---

## 10. Ce qui ne change PAS

- **Aucun changement backend** — tout est front-end
- **Aucune nouvelle route API** — les memes endpoints sont utilises
- **Pas de nouveau modele DB**
- **Le comportement desktop est preserve** — toutes les modifications sont conditionnelles (mobile uniquement)
- **DaisyUI reste le framework composant** — on ajoute juste des composants custom pour les patterns mobiles (BottomSheet, BottomTabBar)
- **Les themes (coffee/winter) restent identiques**
- **La logique business ne change pas** — memes actions, memes permissions, memes validations

---

## 11. Strategie d'implementation

### Phase 1 : Fondations

Creer l'infrastructure mobile sans casser le desktop.

- [ ] Creer `useIsMobile()` hook
- [ ] Creer `useKeyboardVisible()` hook (visualViewport API)
- [ ] Creer `BottomTabBar` composant (avec masquage clavier)
- [ ] Creer `BottomSheet` composant
- [ ] Creer `ActionSheet` composant (variante BottomSheet)
- [ ] Ajouter `viewport-fit=cover` dans `index.html`
- [ ] Ajouter variables safe-area dans `global.css`
- [ ] Ajouter `prefers-reduced-motion` dans `global.css`
- [ ] Remplacer `pointer-fine`/`pointer-coarse` par `md:` dans `MainLayout.tsx` et `Sidebar.tsx`

### Phase 2 : Navigation

Restructurer la navigation mobile.

- [ ] `App.tsx` : conditionner NavBar (desktop) vs BottomTabBar (mobile connecte)
- [ ] `App.tsx` : position toasts conditionnelle (`bottom-center` mobile, `top-right` desktop)
- [ ] `MainLayout.tsx` : `md:drawer-open`, padding bottom mobile, supprimer barre hamburger mobile
- [ ] `Sidebar.tsx` : touch targets, breakpoints `md:`, theme toggle dans le footer
- [ ] `NotificationDropdown.tsx` : navigate vers `/notifications` sur mobile
- [ ] `ProfilePage.tsx` : ajouter liens Invitations, theme toggle, logout sur mobile

### Phase 3 : Corrections de layout

Fixer les debordements et les layouts casses.

- [ ] `RecipeDetailPage.tsx` : ActionSheet pour boutons, image hero reduite
- [ ] `CommunityDetailPage.tsx` : BottomSheet pour SidePanel, boutons avec labels
- [ ] `RecipeFilters.tsx` : layout vertical mobile, supprimer min-w, filtres repliables
- [ ] `MembersList.tsx` : cartes au lieu de table sur mobile
- [ ] `RecipesPageLoggedInView.tsx` + `CommunityRecipesList.tsx` : forcer card view mobile
- [ ] `RecipeFormPage.tsx` : stacker en-tete
- [ ] `NotificationsPage.tsx` : layout filtres mobile
- [ ] Etats vides : CTA dans la thumb zone, boutons 48px, messages courts

### Phase 4 : Formulaires tactiles

Optimiser les composants de saisie pour le tactile.

- [ ] `IngredientList.tsx` : layout stacke mobile
- [ ] `StepEditor.tsx` : layout mobile, touch targets 44px
- [ ] `SearchSelector.tsx` : touch targets items et chips
- [ ] `RecipeCard.tsx` : touch targets boutons action
- [ ] `ProposeModificationModal.tsx` : plein ecran mobile
- [ ] `ImageUpload.tsx` / `ImagePicker.tsx` : texte adapte

### Phase 5 : Polish

- [ ] Verifier tous les touch targets (audit 44px minimum)
- [ ] Verifier scroll derriere la bottom tab bar (padding-bottom + derniers elements visibles)
- [ ] Verifier comportement clavier virtuel (input focus, scroll, tab bar masquee)
- [ ] Tester sur iPhone SE (375px), iPhone 14 (390px), iPhone 14 Pro Max (430px)
- [ ] Tester sur Android (360px Samsung Galaxy, 412px Pixel)
- [ ] Tester les deux themes (coffee + winter) sur mobile
- [ ] Tester mode paysage
- [ ] Performance : verifier que les re-renders lies a `useIsMobile()` sont minimaux

---

## 12. Decisions prises

1. **Swipe gestures** : V2. Le swipe (sidebar, bottom sheets) sera implemente apres le rework mobile v1. Trop de conflits potentiels avec le scroll a gerer.

2. **Mode carte force sur mobile** : oui. Le toggle list/card est masque (`hidden md:inline-flex`). Mode carte impose sur mobile.

3. **Filtres repliables** : oui, des la v1. Bouton "Filtres" avec badge du nombre de filtres actifs, collapse/expand en slide-down.

4. **ProposeModificationModal** : modal plein ecran sur mobile, pas de nouvelle route. `history.pushState` temporaire pour gerer le back button si necessaire.

5. **Theme toggle** : dans le profil ET dans le footer du drawer sidebar. Double acces pour couvrir les deux contextes.

---

## 13. Transitions et animations mobiles

Les animations sont critiques pour un rendu natif sur mobile.

### Regles

| Element                     | Animation           | Duree                       |
| --------------------------- | ------------------- | --------------------------- |
| Navigation entre pages/tabs | Aucune (instantane) | 0ms                         |
| Bottom sheet (ouverture)    | Slide-up            | 250ms `ease-out`            |
| Bottom sheet (fermeture)    | Slide-down          | 200ms `ease-in`             |
| Overlay (apparition)        | Fade-in             | 200ms                       |
| Collapse/expand (filtres)   | Height transition   | 200ms `ease-in-out`         |
| Boutons (feedback tactile)  | `active:scale-95`   | via DaisyUI (deja en place) |

### Respect de `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

A ajouter dans `global.css`.

---

## 14. Gestion du clavier virtuel

Le clavier virtuel reduit l'ecran visible de ~40-50% sur mobile. Problemes potentiels :

### 14.1 Masquer la bottom tab bar

Quand le clavier est ouvert, la bottom tab bar mange 56px supplementaires sur un ecran deja reduit. Elle doit se masquer.

Detection via `visualViewport` API :

```ts
// Dans BottomTabBar.tsx ou un hook dedie useKeyboardVisible()
useEffect(() => {
  const vv = window.visualViewport;
  if (!vv) return;

  const handleResize = () => {
    // Le clavier est ouvert si le viewport visible est significativement plus petit
    const keyboardOpen = vv.height < window.innerHeight - 150;
    setIsKeyboardOpen(keyboardOpen);
  };

  vv.addEventListener("resize", handleResize);
  return () => vv.removeEventListener("resize", handleResize);
}, []);
```

La bottom tab bar ajoute `hidden` quand `isKeyboardOpen` est true.

### 14.2 Scroll vers l'input actif

Les navigateurs mobiles gerent generalement le scroll automatique vers l'input focus. Mais dans les conteneurs avec `overflow: hidden` (comme le drawer DaisyUI), ca peut echouer. S'assurer que les zones de formulaire utilisent `overflow-y: auto` (pas `hidden`).

### 14.3 Formulaires longs dans les bottom sheets

Quand un bottom sheet contient un formulaire (ex: SuggestTagModal), le clavier + le sheet + le contenu se battent pour l'espace. Le bottom sheet doit passer en `position: fixed; inset: 0` quand le clavier s'ouvre pour occuper tout l'ecran disponible.

---

## 15. Etats vides adaptes au mobile

Les etats vides (aucune recette, aucune communaute) occupent tout l'ecran sur mobile. Regles :

- Le CTA principal ("Creer ma premiere recette") doit etre dans la **thumb zone** (centre-bas de l'ecran, pas en haut)
- Le message doit etre court (1 ligne max) et actionnable
- L'icone/illustration doit etre dimensionnee pour mobile (~64px, pas un icone 48px perdu dans un ocean blanc)
- Le bouton CTA doit faire 48px de haut minimum (`btn-lg` ou equivalent)

Composants concernes :

- `DataContainer.tsx` (wrapper generique des etats vides)
- `DashboardPage.tsx` (sections communautes + recettes)
- `RecipesPageLoggedInView.tsx` (liste vide)
- `CommunityRecipesList.tsx` (communaute sans recettes)

### Layout mobile pour etat vide

```
┌──────────────────────────────┐
│                              │
│                              │
│          [icon 64px]         │  centre vertical
│                              │
│    Aucune recette pour       │
│    l'instant                 │
│                              │
│    [  Creer ma premiere  ]   │  btn-lg, thumb zone
│    [     recette         ]   │
│                              │
└──────────────────────────────┘
```

---

## 16. Position des toasts

Actuellement : `<Toaster position="top-right" />`.

Sur mobile, les toasts en haut a droite sont :

1. Partiellement caches par l'encoche / Dynamic Island
2. Dans la zone difficile d'atteinte (on ne peut pas les dismiss facilement)

### Changement

Conditionner la position dans `App.tsx` :

```tsx
const isMobile = useIsMobile();

<Toaster
  position={isMobile ? "bottom-center" : "top-right"}
  containerStyle={isMobile ? { bottom: 72 } : undefined} // au-dessus de la tab bar
/>;
```

Le `bottom: 72` (56px tab bar + 16px marge) place les toasts juste au-dessus de la bottom tab bar, dans la zone de regard naturelle.

---

## 17. Items V2 (post rework mobile v1)

Ces elements sont prevu pour une iteration ulterieure (voir aussi `docs/0 - brainstorming futur.md`) :

- Swipe gestures (sidebar open/close, bottom sheet dismiss, swipe-back navigation)
- Long-press sur RecipeCard pour ouvrir l'ActionSheet (conflit avec scroll a gerer)
- Pull-to-refresh sur les listes
- Haptic feedback (`navigator.vibrate()`) sur les actions de confirmation
