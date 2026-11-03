Forest Manager rassemble des proches (famille, amis, colocs) dans des espaces prives organises en modules : recettes d'abord, puis planning de repas et liste de courses. L'interface est **mobile first** : on l'utilise surtout en cuisine et au magasin, telephone en main.

## Principes

- **Le contenu d'abord.** Une recette, un repas, une liste : la navigation se fait discrete autour.
- **On sait toujours ou l'on est.** L'espace courant est visible dans le rail et teinte l'interface ; le module courant est actif dans la barre du module ou la barre d'onglets.
- **Un geste, un resultat visible.** Chaque action confirme ce qui s'est passe (Toast) ; rien ne se modifie en silence.
- **Le telephone d'abord.** Chaque ecran se concoit a 375px, puis s'enrichit a 768px et 1024px.

## Ton et contenu

- Tutoiement, phrases courtes, voix active. "Ajoute une recette", pas "Vous pouvez ajouter une recette".
- Boutons : un verbe a l'infinitif, majuscule initiale seulement : "Nouvelle recette", "Partager dans un espace", "Adapter pour Colloc".
- Confirmations au participe passe : "Recette enregistree", "Repas verrouille".
- Erreurs : ce qui ne va pas et comment corriger, sans excuse : "Colle une adresse complete, qui commence par https://".
- Vocabulaire du produit : **espace** (pas "serveur" ni "groupe"), **recette liee**, **adapter**, **partager**, **suggestion**, **repas**, **portions**.
- Quantites a la francaise : virgule decimale ("1,5 c. a soupe"), unites abregees ("g", "ml", "c. a soupe"), "pers." pour les portions.
- Pas d'emoji dans l'interface.

## Ambiances et themes

- Six themes = trois **ambiances** x sombre / clair : `braise-dark`, `braise-light`, `sousbois-light`, `sousbois-dark`, `potager-light`, `potager-dark`. **Braise** est la signature : icone, page d'accueil, captures. Sous-bois et Potager sont proposees dans Profil > Apparence.
- Le theme se pose sur `<html data-theme="...">`. Par defaut, l'application suit le reglage clair / sombre du systeme dans l'ambiance choisie.
- Les composants ne lisent que des noms de tokens : une ambiance n'est qu'un jeu de valeurs. Ne jamais ecrire une couleur en dur dans un composant.

## Couleur

- Fonds, du plus bas au plus haut : `bg` (page), `surface` (barre du module, barre d'onglets, en-tetes de blocs), `surface-raised` (cartes, menus, feuilles, champs). `rail` pour le rail des espaces.
- Texte : `ink` sur tous les fonds ; `ink-muted` pour les metadonnees, toujours lisible a 4.5:1 sur `bg`, `surface`, `surface-raised` et `rail`.
- Bordures : `line` entre surfaces ; `line-strong` pour les controles (champs, cases, interrupteurs eteints), 3:1 sur tous les fonds.
- **Accent d'espace** : `accent`, `accent-soft`, `accent-text`, `on-accent`. Par defaut la teinte 1 ; un element `data-space="1"` a `"5"` les remplace par `tint-N`, `tint-N-soft`, `tint-N-text`, `on-tint-N`. L'AppShell pose `data-space` de l'espace courant : tout ce qu'il contient prend sa teinte.
  - `accent` : remplissage du bouton principal, interrupteur allume, case cochee, pastille de compteur. Son texte : `on-accent`.
  - `accent-soft` : element actif de navigation, puce selectionnee, repas planifie. Son texte : `accent-text`.
- Chaque ambiance a 5 teintes d'espace. Braise : Braise, Nuit, Tison, Flamme, Cendre. Sous-bois : Sapin, Lichen, Baie, Myrtille, Mousse. Potager : Tomate, Courge, Aubergine, Basilic, Betterave. Un espace garde son numero de teinte quand l'utilisateur change d'ambiance.
- `second` (et `-soft`, `-text`, `on-`) : tout ce qui touche aux **recettes liees** (bloc "Recette liee", badges "Composee" et "Base"). Jamais pour une action.
- Etats : `success`, `warning`, `danger`, chacun avec `-soft` (fond), `-text` (texte sur fond clair ou soft) et `on-` (texte sur le remplissage plein). Un etat porte toujours un mot ou une icone, jamais la couleur seule.
- Toutes les paires texte / fond ci-dessus ont ete verifiees a 4.5:1 dans les six themes ; `focus` et `line-strong` a 3:1.

## Typographie

- Trois familles, communes a toutes les ambiances : **Sora** (`display`) pour les titres, **Manrope** (`sans`) pour tout le texte, **IBM Plex Mono** (`mono`) pour les quantites.
- Echelle : `display` (une fois par ecran), `title-lg` (titre de page), `title` (section, feuille), `title-sm` (carte, bloc), `body-lg` (etapes en mode cuisine), `body` (texte et champs, 16px), `body-sm` (metadonnees), `label` (boutons, onglets, libelles), `caption` (jours du planning, en capitales espacees), `quantity` (quantites, chiffres tabulaires).
- Les champs restent en 16px : en dessous, Safari zoome sur iPhone.

## Espacement et mise en page

- Grille de 4px : `space-1` (4) a `space-12` (48). Marge laterale de page `space-4` sur mobile, `space-6` a partir de 768px.
- Points de rupture **sur le conteneur** (`@container`), pas sur l'ecran : 768px (rail vertical, recherche dans l'en-tete, plus de barre d'onglets) et 1024px (barre du module). L'AppShell et les grilles de cartes (`fm-cq`) declarent les conteneurs.
- Structure : `size-rail` 72px, `size-sidebar` 240px, `size-header` 56px, `size-tabbar` 64px plus la marge de securite du bas.
- **Cible tactile minimale `size-touch` (44px)** pour tout ce qui se touche : boutons, lignes de menu, ingredients, repas, onglets.

## Formes et profondeur

- Rayons : `radius-sm` (puces, badges, cases), `radius-md` (boutons, champs, repas, blocs), `radius-lg` (cartes, menus, dialogues), `radius-xl` (haut des feuilles du bas), `radius-full` (avatars, icones d'espace au repos, interrupteurs).
- Ombres : `shadow-sm` sur les cartes, `shadow-md` sur les menus, la palette et les toasts, `shadow-lg` sur les feuilles et dialogues. En sombre, les surfaces se distinguent surtout par leur teinte.

## Gestes et mouvement

- Retenus : **glisser vers le bas** pour fermer une feuille (Sheet), **appui long** (500 ms) sur une carte ou un repas pour son menu d'actions (ActionMenu), **tirer pour rafraichir** en haut des listes (PullToRefresh). Chaque geste a un equivalent visible : croix, bouton "...", option "Actualiser".
- Exclus : glisser depuis le bord de l'ecran, vibration.
- Animations courtes (150 a 250 ms, ease-out) : feuilles qui montent, icone d'espace qui passe du rond au carre arrondi. Tout s'arrete avec `prefers-reduced-motion`.

## Iconographie

- **Lucide** (lucide-react dans l'application) : trait de 2px, grille 24, extremites arrondies, couleur du texte. 20px dans les boutons et la navigation, 16px dans les puces et repas.
- Les icones de cet apercu sont des remplacements dessines dans le meme esprit, avec les noms Lucide ; elles ne sont pas les fichiers Lucide.
- Pas de logo pour l'instant : le nom "Forest Manager" s'ecrit en Sora 700. Les espaces sans avatar affichent leurs initiales sur leur teinte.

## Accessibilite

- Focus clavier : anneau `focus` de 2px plein, decale de 2px, 3:1 sur tous les fonds.
- Toute icone seule a un `label`. Les feuilles ont un titre, se ferment avec Echap et rendent le focus.
- Les etats (verrouille, original modifie, hors ligne) ont un texte, pas seulement une couleur ou une icone.

## Composants

- **Actions** : Button, IconButton.
- **Formulaires** : Field, Switch, Stepper, SegmentedControl.
- **Affichage** : Badge, Chip, Avatar, Icon, EmptyState.
- **Superpositions** : Sheet, ActionMenu, Toast, CommandPalette.
- **Navigation** : SpaceRail, ModuleNav, TabBar, TopBar, AppShell.
- **Recettes** : RecipeCard, IngredientRow, RecipeBlock.
- **Planning** : MealSlot, PullToRefresh.

Dans l'application, les primitives viennent de shadcn/ui (Radix) avec ces tokens ; les composants metier (SpaceRail, RecipeCard, RecipeBlock, MealSlot...) sont propres a Forest Manager.
