# Corrections a faire

## Sidebar - Tooltips en mode compact

**Probleme**: En mode compact de la sidebar, les infobulles (tooltips) sur les boutons de navigation passent sous le contenu de la page et ne sont pas visibles par les utilisateurs.

**Contexte**:

- DaisyUI tooltips avec classes `tooltip tooltip-right` et `data-tip`
- Les tooltips sont sur les elements `<li>` du menu
- Plusieurs tentatives de fix avec z-index (z-50 sur aside, z-0 sur drawer-content, CSS personnalise) n'ont pas resolu le probleme

**Comportement attendu**: Au hover d'un bouton en mode compact, une infobulle devrait apparaitre a droite avec le nom de l'action (ex: "My Recipes").

**Fichiers concernes**:

- `frontend/src/components/Layout/Sidebar.tsx`
- `frontend/src/components/Layout/MainLayout.tsx`
- `frontend/src/styles/global.css`

**Pistes à suivre**:

Voici le réultat d'une recherche sur le sujet :
"
Ah, **classique piège des tooltips + sidebar compacte + drawer DaisyUI** 😄
Bonne nouvelle : le problème n’est **pas** vraiment le `z-index`. Tu étais sur une fausse piste (logique, mais piégeuse).

---

## 🧠 Le vrai problème (spoiler : `overflow` et stacking context)

Avec DaisyUI + drawer, il y a **presque toujours** au moins un parent qui fait :

```css
overflow: hidden;
```

ou qui crée un **nouveau stacking context** (`transform`, `filter`, `will-change`, etc.).

👉 Résultat :

- Le tooltip est bien rendu
- MAIS il est **clippé par son parent**
- Le `z-index` ne peut **pas dépasser un parent qui coupe le débordement**

C’est pour ça que :

> z-50 sur l’aside + z-0 sur le contenu = aucun effet

---

## 🔍 Où ça coince très probablement chez toi

Dans un setup DaisyUI classique :

- `drawer`
- `drawer-side`
- `drawer-content`

👉 **`drawer-content` a `overflow-hidden`**
👉 parfois aussi un `transform: translateX(...)` sur la sidebar en mode compact

Donc ton tooltip, même s’il est “au-dessus”, est **découpé**.

---

## ✅ Solutions qui fonctionnent vraiment (par ordre de fiabilité)

---

## ✅ Solution 1 — Forcer `overflow-visible` au bon endroit (la plus simple)

Dans ton `global.css` :

```css
.drawer,
.drawer-side,
.drawer-content,
aside,
.menu,
.menu li {
  overflow: visible !important;
}
```

⚠️ Tu peux resserrer ensuite si besoin, mais pour tester c’est parfait.

👉 **90 % du temps, ça règle le problème immédiatement**.

---

## ✅ Solution 2 — Mettre le tooltip sur le `<button>` et pas le `<li>`

DaisyUI recommande implicitement ça, mais ce n’est pas très clair dans la doc.

❌ Problématique :

```tsx
<li className="tooltip tooltip-right" data-tip="My Recipes">
```

✅ Correct :

```tsx
<li>
  <button className="tooltip tooltip-right" data-tip="My Recipes">
    …
  </button>
</li>
```

Pourquoi ?

- `<li>` est souvent soumis à `overflow`
- `<button>` est plus fiable pour les pseudo-elements `::before` / `::after`

---

## ✅ Solution 3 — Passer le tooltip en `position: fixed`

Si tu veux un truc **bulletproof**, même avec des drawers animés :

```css
.tooltip::before,
.tooltip::after {
  position: fixed;
}
```

⚠️ À utiliser si tu as des animations complexes ou des transforms sur la sidebar.

---

## ✅ Solution 4 — DaisyUI “hack” propre : tooltip toujours visible en compact

En mode compact, tu peux forcer :

```tsx
<button
  className="tooltip tooltip-right tooltip-open"
  data-tip="My Recipes"
>
```

Puis gérer l’ouverture toi-même via hover CSS ou JS.

---

## 🔧 Check rapide dans ton cas précis

Je parierais 💰 que dans `MainLayout.tsx` tu as un truc comme :

```tsx
<div className="drawer-content overflow-hidden">
```

➡️ change en :

```tsx
<div className="drawer-content overflow-visible">
```

ou ajoute dans `global.css`.

---

## 🧪 Debug express (à faire dans DevTools)

1. Inspecte un tooltip
2. Remonte les parents
3. Tu verras **exactement lequel coupe le tooltip**
4. Si tu vois :
   - `overflow: hidden`
   - `transform: translateX(...)`
     👉 bingo 🎯

---

"

## Plusieurs modes d'affichages :

Dans ma liste de recettes, il faut plusieurs modes d'affichages: en cartes ou en liste.
il faut pouvoir switcher entre les deux modes avec un bouton en haut à droite de la page.

## Dans les recherches

pouvoir rechercher par tags, ajouter un menu déroulant sur le champ (possibilité d'entrée libre, ou d'utiliser le menu déroulant.)

Pouvoir rechercher par ingrédients de la même manière que par tags.

# Tests à ajouter APRES les corrections. Ne pas lire tant qu'il y a des lignes non résolues au dessus de celle-ci.

Mettre en place un système de test du code pour le backend et pour le frontend.

En se basant sur les fichier 0.5_test.md, 1.2_test.md, 2.0_test.md, créer des tests unitaires nécessaires.

Les tests doivent être valide avant les déploiement (preprod et prod).
