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

## Plusieurs modes d'affichages :

en cartes ou en liste.
il faut pouvoir switcher entre les deux modes avec un bouton en haut à droite de la page.

## Dans les recherches

pouvoir rechercher par tags, ajouter un menu déroulant sur le champ (possibilité d'entrée libre, ou d'utiliser le menu déroulant.)

Pouvoir rechercher par ingrédients de la même manière que par tags.
