# Plan C2 - Design system, app shell et ecrans du socle

Statut : voir le journal (D154 a D157). Les sous-etapes sont des cases dans `4-Roadmap.md`.
References : `10-Design-System/project/` (README, tokens, composants), `16-Maquettes/1-Acces-Espaces/` et `3-Planning-Profil/` (ecrans du socle), `13-Parcours.md` (P01 a P05, P15), `14-Architecture.md` S2, S8, S10, `15-Plan-Tests.md` (composants).

## 1. Perimetre [D154]

**Dans C2** : outillage web, composants du design system, themes et preferences, app shell (rail, en-tete, barre du module, barre d'onglets), registre web des modules, ecrans du socle branches sur l'API de C1 (acces, espaces, invitations, membres, modules, profil, apparence, suppression du compte), catalogue `/design` [D29], coquille PWA installable.

**Hors C2** (etape cible) :

- Ecrans de Recettes, persistance hors ligne des donnees (TanStack Query dans IndexedDB), avatars et photos (C3).
- Administration (C4), Planning (C5).
- Notifications, palette Ctrl K, widgets d'accueil complets, fil d'activite (C6). En C2, l'accueil montre les invitations et transferts recus (`GET /me/invitations`, `/me/transfers`).
- E2E Playwright (C7) ; C2 couvre par des tests de composants avec MSW.

## 2. Choix techniques

- **Composants [D155]** : les composants du design system sont portes en TSX depuis la copie locale (`components/bundle.js`, `bundle.css`), avec leur CSS tel quel (classes `fm-*` basees sur les tokens) : l'application et les maquettes partagent le meme rendu. Les comportements accessibles viennent de Radix (`radix-ui`) : Dialog pour Sheet, DropdownMenu pour ActionMenu, Toast, Switch, RadioGroup. Icones : `lucide-react` (memes noms que l'apercu). Tailwind 4 sert a la mise en page des ecrans, son theme lit les tokens (`@theme inline`). C'est la demarche shadcn (code possede, Radix + Tailwind + tokens) appliquee au design system deja valide.
- **Polices auto-hebergees [D156]** : Sora, Manrope, IBM Plex Mono via `@fontsource` (pas de Google Fonts : CSP stricte, pas de requete tierce).
- **Tests composants [D157]** : Vitest + jsdom + Testing Library + user-event + MSW. Les reponses mockees sont construites par des fabriques typees par les schemas Zod partages et validees contre eux. Rendu de chaque composant dans les six themes + axe-core sur les ecrans.
- **Donnees** : client `fetch` maison (CSRF double submit, erreurs typees `ApiError` du partage), TanStack Query, formulaires react-hook-form + schemas Zod partages.
- **Routage** : React Router 8 en mode declaratif ; routes des modules chargees a la demande sous `/s/:spaceId/<code>`.
- **i18n** : i18next, namespace `core` en francais ; les messages d'erreur viennent des cles `errors.<CODE>`.
- Versions (regle des deux semaines, relevees le 2026-11-05) : react-router 8.5.0, tailwindcss 4.3.3, @tanstack/react-query 5.104.5, react-hook-form 7.90.0, @hookform/resolvers 6.0.0, i18next 26.5.4, react-i18next 17.1.0, lucide-react 1.61.0, radix-ui 1.8.1, msw 3.0.3, jsdom 30.1.3, Testing Library (react 16.3.3, user-event 14.6.8, jest-dom 7.0.1), axe-core 4.14.0, vite-plugin-pwa 2.0.0, @fontsource 5.3.0.

## 3. Sous-etapes (dans l'ordre, un commit ou plus chacune, TDD [D151])

### C2.1 Outillage web

- Dependances, Tailwind 4 branche sur les tokens, styles du design system, polices.
- Vitest (projet `@fm/web`, jsdom), Testing Library, MSW, fabriques de reponses.
- Client API, TanStack Query, i18next ; `npm run test:web` dans Docker.

### C2.2 Composants du design system

- Icon, Button, IconButton, Field, Switch, Stepper, SegmentedControl, RadioGroup, TintPicker, OptionList, Badge, Chip, Avatar, EmptyState, Skeleton, Sheet, ActionMenu, Toast.
- Page `/design` : chaque composant dans ses etats, selecteur de theme et de teinte.

### C2.3 Themes et preferences

- `data-theme` (ambiance + clair / sombre / systeme), densite, taille du texte, `data-space` ; appliques depuis `/me`, avant connexion depuis le systeme.

### C2.4 App shell et registre web

- AppShell, SpaceRail (etat "en suppression" [D96]), SpaceSwitcher mobile [D130], ModuleNav, TabBar (4 puis "Plus" [D131]), TopBar (mode edition [D136]).
- Manifestes web (`apps/web/src/modules/<code>/manifest.tsx`), Recettes minimal ; navigation construite depuis les modules actifs de l'espace ; espace perso : Accueil, Recettes, Mes recettes, Plus [D95].

### C2.5 Acces (P01)

- Accueil public, inscription, connexion ("Rester connecte"), verification d'email, mot de passe oublie et nouveau (selon `features.email`), bienvenue [D61], garde des routes connectees ; un lien d'invitation survit a l'inscription ou la connexion [D62].

### C2.6 Espaces, invitations, membres (P02 a P05)

- Creer un espace, rejoindre par lien (apercu D62), invitations recues, inviter (lien et nom exact, message neutre D150), membres (roles, exclusion, transfert D92), reglages (nom, description, teinte), quitter, supprimer (nom a taper D93) et restaurer.

### C2.7 Modules

- E-MODULES : catalogue, demande d'acces (F-DEMANDE-MODULE), annulation, motif de refus [D124], activation, desactivation, ordre [D131].

### C2.8 Profil, apparence, compte

- Profil (username, email, mot de passe), apparence avec apercu reel [D115], suppression du compte avec consequences par espace [D116], deconnexion ; accueil minimal (invitations, transferts).

### C2.9 Coquille PWA

- Manifeste, service worker (precache de la coquille), bandeau "Nouvelle version disponible", bandeau hors ligne et actions d'ecriture desactivees [D106].

## 4. Definition de fini de C2

- Chaque ecran du socle des maquettes existe, branche sur l'API, en mobile et en bureau.
- Tests de composants verts dans Docker, dont le rendu des six themes et axe sans violation sur les ecrans.
- Lint, typecheck, build et CI verts. README du chantier et roadmap a jour.
