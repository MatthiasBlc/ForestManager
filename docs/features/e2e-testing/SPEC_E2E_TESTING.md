# Spec : Tests End-to-End (E2E)

## Contexte

L'app dispose de 1271 tests (802 backend integration/unit + 469 frontend unit) mais aucun test E2E qui valide les flux utilisateur complets a travers le navigateur. Les tests actuels mockent soit le backend (MSW cote frontend) soit le frontend (Supertest cote backend). Un bug d'integration entre les deux couches peut passer inapercu.

## Objectifs

- Valider les flux critiques utilisateur de bout en bout (navigateur reel → API → DB)
- Detecter les regressions d'integration (routing, sessions, CSRF, uploads)
- Executer en CI sans flakiness

## Choix technique : Playwright

**Pourquoi Playwright plutot que Cypress :**

- Support natif multi-navigateurs (Chromium, Firefox, WebKit)
- Architecture headless performante (pas de serveur Electron)
- API `expect` native avec auto-wait (moins de flakiness)
- Parallelisme natif (workers)
- Trace viewer integre pour debug CI
- Meilleur support Docker (images officielles `mcr.microsoft.com/playwright`)

## Perimetre

### Flux critiques a couvrir

1. **Auth** : signup → login → session persistante → logout
2. **Recettes** : creer recette (titre, etapes, ingredients, tags) → voir detail → editer → supprimer
3. **Communautes** : creer communaute → inviter membre → accepter invitation → voir communaute
4. **Partage** : publier recette perso vers communaute → voir dans la communaute
5. **Propositions** : proposer modification → owner accepte/rejette
6. **Import** : importer recette via texte brut → formulaire pre-rempli → sauvegarder
7. **Upload** : uploader image recette → affichage → remplacement → suppression

### Hors perimetre (premiere iteration)

- Admin (2FA TOTP rend l'automatisation complexe)
- Notifications temps reel (WebSocket testing specifique)
- Multi-navigateurs (Chromium uniquement en premiere passe)

## Architecture

```
e2e/
├── playwright.config.ts       # Config (baseURL, timeout, retries, workers)
├── global-setup.ts            # Seed DB test, demarrer containers si besoin
├── global-teardown.ts         # Cleanup
├── fixtures/
│   └── auth.fixture.ts        # Login fixture reutilisable (storageState)
├── pages/                     # Page Object Model
│   ├── LoginPage.ts
│   ├── RecipesPage.ts
│   ├── RecipeFormPage.ts
│   ├── CommunityPage.ts
│   └── ...
└── tests/
    ├── auth.spec.ts
    ├── recipes.spec.ts
    ├── communities.spec.ts
    ├── sharing.spec.ts
    ├── proposals.spec.ts
    ├── import.spec.ts
    └── upload.spec.ts
```

### Patterns

- **Page Object Model** : encapsuler les selecteurs et actions par page
- **Auth fixture** : login une fois, sauvegarder `storageState`, reutiliser dans tous les tests
- **Cleanup** : chaque test cree ses propres donnees, cleanup en afterEach
- **Selecteurs** : privilegier `data-testid` pour la stabilite

## Environnement d'execution

### Local

```bash
npm run test:e2e              # Lancer les tests E2E
npm run test:e2e:ui           # Mode interactif Playwright
npm run test:e2e:debug        # Debug mode (headed + inspector)
```

Prerequis : `docker compose up` (backend + frontend + DB + MinIO operationnels)

### CI (GitHub Actions)

- Job separe `e2e` apres les jobs `test-backend` et `test-frontend`
- Docker Compose up complet (backend, frontend, postgres, minio)
- Wait-on pour health checks
- Playwright en mode headless
- Artifacts : traces + screenshots en cas d'echec
- Optionnel : sharding sur 2 workers pour reduire le temps

## Contraintes

- Les tests E2E sont lents (~2-5 min total) → job CI separe, pas bloquant en premiere iteration
- Pas de dependance a des services externes (tout en local/Docker)
- Le seed E2E est distinct du seed dev (donnees minimales, deterministes)
- MinIO doit etre operationnel pour les tests upload
