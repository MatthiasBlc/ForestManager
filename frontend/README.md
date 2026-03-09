# Forest Manager - Frontend

Interface utilisateur React pour l'application Forest Manager.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## Stack

- **React 18** - Bibliotheque UI
- **TypeScript** - Typage statique
- **Vite** - Build tool & dev server
- **TailwindCSS** + **daisyUI** - Styling
- **React Router** - Routing
- **Axios** - Client HTTP
- **Socket.IO Client** - WebSocket pour notifications temps reel
- **Vitest** + **Testing Library** + **MSW** - Tests

## Structure

```
src/
  pages/              # Pages de l'application
    admin/            # Pages admin (dashboard, gestion)
  components/         # Composants reutilisables
    Layout/           # MainLayout, Sidebar
    Navbar/           # Navigation, notifications
    recipes/          # Cards, filtres, badges
    communities/      # Listes, panels
    form/             # Tags, ingredients, etapes
    proposals/        # Modals, listes
    share/            # Modals de partage
    admin/            # Layout et guards admin
  contexts/           # AuthContext, AdminAuthContext, SocketContext, ThemeContext
  hooks/              # Custom hooks (pagination, debounce, confirm, socket)
  network/            # Client API (Axios)
  models/             # Types TypeScript
  utils/              # Utilitaires (formatage, images)
```

## Fonctionnalites

- **Authentification** - Login/signup, sessions, profil
- **Recettes** - CRUD, filtres, pagination, upload images
- **Communautes** - Gestion membres, invitations, tags, activite
- **Propositions** - Creation, accept/reject, variantes
- **Notifications** - Temps reel, 5 categories, preferences
- **Themes** - Forest/Winter, persistence localStorage
- **Admin** - Dashboard stats, gestion centralisee (2FA)

## Developpement

```bash
# Depuis la racine du projet
npm run docker:up:build   # Demarrer tous les services

# Ou depuis ce dossier (requiert backend)
npm run dev               # http://localhost:3000
```

## Tests

404 tests unitaires couvrant :
- Contexts (Auth, Admin, Socket, Theme)
- Hooks personnalises
- Composants (pages, forms, modals)
- Utilitaires (formatage, scaling)

```bash
npm test                  # Tous les tests
npm run test:watch        # Mode watch
npm run test:coverage     # Couverture
```

## Auteur

Cree par [MatthiasBlc](https://github.com/MatthiasBlc)
