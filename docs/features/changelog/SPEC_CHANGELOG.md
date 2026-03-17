# Spec : Systeme de Changelog Automatique

## Vue d'ensemble

Systeme de changelog automatise qui genere une entree a chaque deploiement en production. Les commits sont analyses, filtres (seuls les changements impactant l'experience utilisateur sont retenus), categorises et stockes en base. Le changelog est consultable par les utilisateurs connectes et entierement gerable par l'admin.

---

## 1. Modele de donnees

### 1.1 Nouveau modele Prisma : `ChangelogEntry`

```prisma
model ChangelogEntry {
  id          String    @id @default(uuid())
  version     String    @unique          // semver "1.2.0"
  title       String                     // titre libre, ex: "Rework mobile complet"
  content     Json                       // structure categoriee (voir 1.2)
  publishedAt DateTime  @default(now())  // date de publication (= date deploy)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?                  // soft delete admin

  @@index([publishedAt])
  @@index([deletedAt])
}
```

**Regles** :

- Soft delete (coherent avec les conventions du projet)
- UUID v4
- `version` unique — empeche les doublons
- `publishedAt` indexe pour le tri chronologique

### 1.2 Format du champ `content` (JSON)

```json
{
  "features": [{ "text": "Import de recettes depuis une URL externe" }],
  "improvements": [
    { "text": "Navigation mobile entierement repensee" },
    { "text": "Formulaires adaptes aux ecrans tactiles" }
  ],
  "fixes": [{ "text": "Correction du partage de recettes entre communautes" }]
}
```

**3 categories** :
| Categorie | Label affiche | Commits sources |
| -------------- | -------------------- | -------------------------------------- |
| `features` | Nouveautes | `feat:`, `feat(scope):` |
| `improvements` | Ameliorations | `refactor:`, `perf:`, `style:` `chore(deps):` |
| `fixes` | Corrections | `fix:`, `fix(scope):` |

**Commits ignores** (pas user-facing) : `test:`, `docs:`, `ci:`, `build:`, `chore:` (sauf deps)

Chaque item est un objet `{ text: string }` plutot qu'un simple string pour permettre d'enrichir plus tard (ex: ajout d'un lien, d'une icone).

---

## 2. Versionnement Semver

### 2.1 Schema

Format : `MAJOR.MINOR.PATCH`

| Increment | Condition                                                                        | Exemple       |
| --------- | -------------------------------------------------------------------------------- | ------------- |
| MAJOR     | Breaking change explicite (`BREAKING CHANGE:` dans le body ou `!` apres le type) | 1.0.0 → 2.0.0 |
| MINOR     | Au moins un `feat:` dans le diff                                                 | 1.0.0 → 1.1.0 |
| PATCH     | Seulement `fix:`, `refactor:`, `perf:`, `style:`                                 | 1.0.0 → 1.0.1 |

### 2.2 Version initiale

La premiere version sera `1.0.0` — elle marque le MVP complet actuel. Elle sera creee manuellement par l'admin comme premiere entree du changelog (recapitulatif de l'etat actuel de l'app).

### 2.3 Git tags

A chaque generation de changelog, le CI cree un tag git `vMAJOR.MINOR.PATCH` sur le commit de merge. Cela permet de delimiter facilement les commits entre deux versions. Le tag est pousse vers le remote.

### 2.4 Detection du diff

Le script CI determine les commits a analyser :

1. Recupere le dernier tag git `v*`
2. Si aucun tag : prend tous les commits (premiere generation uniquement)
3. `git log --oneline <last_tag>..HEAD` donne la liste des commits a categoriser

---

## 3. Generation automatique (CI/CD)

### 3.1 Nouveau job dans `deploy.yml` : `generate-changelog`

Position : apres `deploy-prod`, uniquement sur push to master.

```yaml
generate-changelog:
  runs-on: ubuntu-latest
  needs: [deploy-prod]
  if: needs.deploy-prod.result == 'success'
```

### 3.2 Etapes du job

1. **Checkout** avec `fetch-depth: 0` (historique complet pour les tags)
2. **Determiner le dernier tag** : `git describe --tags --abbrev=0 --match "v*"` (ou fallback si aucun tag)
3. **Lister les commits** : `git log --oneline <last_tag>..HEAD`
4. **Parser et categoriser** via un script Node.js (`scripts/generate-changelog.ts`)
   - Filtre les commits non user-facing
   - Categorise en features / improvements / fixes
   - Calcule la prochaine version semver
   - Si aucun commit user-facing : **skip** (pas de changelog vide)
5. **Generer le titre** : auto-genere a partir du contenu (ex: `"3 nouveautes, 5 ameliorations et 2 corrections"`) — modifiable par l'admin ensuite
6. **POST vers l'API** : appel `POST /api/admin/changelog/generate` avec API key
7. **Creer et pousser le tag git** : `git tag v<version> && git push origin v<version>`

### 3.3 Script `scripts/generate-changelog.ts`

```typescript
// Entree : liste de commits (via stdin ou argument)
// Sortie : JSON { version, title, content } sur stdout

// Parsing : regex sur le format conventional commit
// ^(feat|fix|refactor|perf|style|chore|test|docs|ci|build)(\(.+\))?(!)?:\s(.+)$
// - group 1 : type
// - group 2 : scope (optionnel)
// - group 3 : breaking (!)
// - group 4 : description

// Commits non-conventionnels : ignores (merge commits, messages libres)
// Merge commits (^Merge) : toujours ignores
```

### 3.4 Authentification CI → API

**API Key dediee** stockee en secret GitHub (`CHANGELOG_API_KEY`).

Cote backend :

- Variable d'environnement `CHANGELOG_API_KEY`
- Middleware dedie qui verifie le header `X-Changelog-Api-Key`
- Ce middleware est utilise **uniquement** sur l'endpoint `POST /api/admin/changelog/generate`
- L'API key n'a acces a rien d'autre — surface d'attaque minimale

**Pourquoi pas une session admin ?** Le CI n'a pas de navigateur, pas de 2FA TOTP. Une API key dediee a un seul endpoint est plus securisee et plus simple qu'un mecanisme de service account admin.

---

## 4. API Backend

### 4.1 Endpoints User (requireAuth)

```
GET /api/changelog                    # Liste paginee (page, limit)
GET /api/changelog/:id                # Detail d'une entree
```

**Response GET list** :

```json
{
  "data": [
    {
      "id": "uuid",
      "version": "1.2.0",
      "title": "3 nouveautes et 2 corrections",
      "content": { "features": [...], "improvements": [...], "fixes": [...] },
      "publishedAt": "2026-03-17T14:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 25, "totalPages": 3 }
}
```

**Filtrage** : `deletedAt: null` (seules les entrees actives sont visibles)

### 4.2 Endpoints Admin (requireSuperAdmin)

```
GET    /api/admin/changelog                    # Liste (inclut soft-deleted si ?includeDeleted=true)
POST   /api/admin/changelog                    # Creer manuellement une entree
POST   /api/admin/changelog/generate           # Endpoint CI (API key auth, pas session)
PATCH  /api/admin/changelog/:id                # Modifier (title, content, version, publishedAt)
DELETE /api/admin/changelog/:id                # Soft delete
```

**POST /api/admin/changelog** (creation manuelle par admin) :

```json
{
  "version": "1.0.0",
  "title": "Lancement de Forest Manager",
  "content": {
    "features": [
      { "text": "Gestion de recettes personnelles et communautaires" },
      { "text": "Systeme d'invitations et de communautes privees" }
    ],
    "improvements": [],
    "fixes": []
  }
}
```

**POST /api/admin/changelog/generate** (appel CI) :

```json
{
  "version": "1.2.0",
  "title": "3 nouveautes, 5 ameliorations et 2 corrections",
  "content": { ... },
  "commitRange": "v1.1.0..abc1234"
}
```

Header requis : `X-Changelog-Api-Key: <secret>`

### 4.3 Codes erreur

| Code          | HTTP | Description                              |
| ------------- | ---- | ---------------------------------------- |
| CHANGELOG_001 | 404  | Entree non trouvee                       |
| CHANGELOG_002 | 409  | Version deja existante                   |
| CHANGELOG_003 | 400  | Contenu invalide (format JSON incorrect) |
| CHANGELOG_004 | 401  | API key invalide ou manquante            |
| CHANGELOG_005 | 400  | Version invalide (format semver)         |

### 4.4 Validation

- `version` : regex `/^\d+\.\d+\.\d+$/`
- `title` : string, 1-200 caracteres
- `content` : objet avec au moins une des 3 cles (`features`, `improvements`, `fixes`), chaque cle est un array d'objets `{ text: string }` avec `text` de 1-500 caracteres
- `publishedAt` : date ISO valide (optionnel, defaut now)

---

## 5. Frontend User

### 5.1 Acces : bouton dans le footer sidebar

**Emplacement** : footer du `Sidebar.tsx`, entre le texte de version et le toggle theme.

Le texte de version actuel (`Forest Manager v0.1`) devient un lien cliquable vers `/changelog`. La version affichee sera dynamique (derniere version du changelog).

En mode compact : icone cliquable avec tooltip "Changelog".

### 5.2 Page `/changelog`

Layout type blog, du plus recent au plus ancien.

```
[Header: "Changelog"]

[Carte]
  v1.2.0 — 17 mars 2026
  "3 nouveautes, 5 ameliorations et 2 corrections"

  Nouveautes
    * Import de recettes depuis une URL externe
    * ...

  Ameliorations
    * Navigation mobile repensee
    * ...

  Corrections
    * Correction du partage entre communautes
    * ...
[/Carte]

[Carte suivante...]

[Pagination]
```

**Design** :

- Cartes empilees verticalement, responsive
- Badge de version colore (ex: `badge badge-primary`)
- Date en format relatif + absolu (ex: "il y a 3 jours — 17 mars 2026")
- Categories avec icone/couleur distincte (vert nouveautes, bleu ameliorations, rouge corrections)
- Pagination classique (coherent avec le reste de l'app, pas d'infinite scroll)

### 5.3 Pas de page de detail

Le contenu est affiche directement dans la liste (chaque carte = une entree complete). Pas besoin d'une page `/changelog/:id` cote user — le contenu est assez court pour etre lu inline. L'endpoint `GET /api/changelog/:id` existe pour l'admin ou pour un usage futur si necessaire.

---

## 6. Frontend Admin

### 6.1 Nouvelle page `/admin/changelog`

Ajout dans la navigation admin (sidebar `AdminLayout.tsx`) avec icone `FaNewspaper` ou `FaHistory`.

**Liste** :

- Table avec colonnes : Version, Titre, Date, Status (actif/supprime), Actions
- Bouton "Nouvelle entree" en haut
- Filtre : afficher/masquer les entrees supprimees
- Actions par ligne : Modifier, Supprimer

**Modal creation/edition** :

- Champ version (input text, validation semver)
- Champ titre (input text)
- Editeur de contenu structure :
  - 3 sections (Nouveautes, Ameliorations, Corrections)
  - Chaque section : liste d'items avec bouton + pour ajouter, x pour supprimer
  - Chaque item : input text
- Date de publication (date picker, defaut now)
- Bouton sauvegarder avec confirmation

**Modal suppression** :

- Confirmation avec le texte : "Supprimer la version X.Y.Z ?"
- Bouton confirmer / annuler

### 6.2 AdminActionType

Nouveau type d'action pour l'audit log :

```
CHANGELOG_CREATED | CHANGELOG_UPDATED | CHANGELOG_DELETED
```

Chaque action admin sur le changelog est tracee dans `AdminActivityLog`.

---

## 7. Convention de commits (officialisation)

Le projet utilise deja les conventional commits de facto. Cette spec les officialise :

```
<type>(<scope>): <description>

[body optionnel]

[BREAKING CHANGE: description]
```

### Types reconnus

| Type       | Usage                                       | Apparait dans le changelog |
| ---------- | ------------------------------------------- | -------------------------- |
| `feat`     | Nouvelle fonctionnalite                     | Oui (Nouveautes)           |
| `fix`      | Correction de bug                           | Oui (Corrections)          |
| `refactor` | Refactorisation sans changement fonctionnel | Oui (Ameliorations)\*      |
| `perf`     | Amelioration de performance                 | Oui (Ameliorations)        |
| `style`    | Changement CSS/UI sans fonctionnel          | Oui (Ameliorations)\*      |
| `test`     | Ajout/modification de tests                 | Non                        |
| `docs`     | Documentation                               | Non                        |
| `ci`       | CI/CD                                       | Non                        |
| `build`    | Build, deps                                 | Non                        |
| `chore`    | Maintenance                                 | Non\*                      |

\*`refactor` et `style` : inclus uniquement s'ils ont un impact visible pour l'utilisateur. Le script les inclut par defaut mais l'admin peut les retirer manuellement.

\*`chore(deps)` : inclus dans Ameliorations (mises a jour de dependances = securite/perf).

### Scope

Le scope est optionnel mais recommande pour les features multi-fichiers :

- `feat(mobile):` — changement lie au mobile
- `fix(recipe):` — correction sur les recettes
- `refactor(auth):` — refactorisation auth

Le scope est utilise uniquement pour le parsing, pas affiche dans le changelog (le texte du commit suffit).

---

## 8. Flux complet (diagramme)

```
Developer                    GitHub                     CI (Actions)                Backend (Prod)
    |                           |                           |                           |
    |-- push branch ----------->|                           |                           |
    |                           |-- PR merge to master ---->|                           |
    |                           |                           |-- test ------------------>|
    |                           |                           |-- build & push images --->|
    |                           |                           |-- deploy-prod ----------->| (Portainer)
    |                           |                           |                           |
    |                           |                           |-- generate-changelog:     |
    |                           |                           |   1. git describe (last tag)
    |                           |                           |   2. git log tag..HEAD    |
    |                           |                           |   3. parse & categorize   |
    |                           |                           |   4. compute version      |
    |                           |                           |   5. POST /api/admin/     |
    |                           |                           |      changelog/generate ->| (stocke en DB)
    |                           |                           |   6. git tag & push       |
    |                           |                           |                           |
User                                                                                    |
    |                                                                                   |
    |-- GET /api/changelog ------------------------------------------------------------>|
    |<-- liste paginee (JSON) ----------------------------------------------------------|
```

---

## 9. Variables d'environnement

| Variable            | Ou             | Description                                                               |
| ------------------- | -------------- | ------------------------------------------------------------------------- |
| `CHANGELOG_API_KEY` | Backend (.env) | Cle pour l'endpoint CI                                                    |
| `CHANGELOG_API_KEY` | GitHub Secrets | Meme cle, injectee dans le job CI                                         |
| `APP_URL`           | GitHub Secrets | URL publique du frontend (ex: `https://forestmanager.matthias-bouloc.fr`) |

**Note architecture reseau** : le backend n'est pas expose publiquement. Il est uniquement sur le reseau Docker `internal`. Le frontend nginx fait reverse proxy de `/api/*` vers le backend. Le job CI POST donc vers `${APP_URL}/api/admin/changelog/generate`, ce qui transite par Traefik → nginx frontend → backend. Aucune exposition supplementaire du backend n'est necessaire.

---

## 10. Securite

- **API key** : generee aleatoirement (64 chars hex min), stockee en secret GitHub et en variable d'env backend
- **Endpoint generate** : API key only, pas de session, pas de TOTP — le scope est un seul endpoint d'ecriture
- **Rate limiting** : l'endpoint generate est inclus dans le rate limiter admin global (30 req/min), suffisant vu que le CI n'appelle qu'une fois par deploy
- **Validation stricte** : version semver, content JSON structure, taille des champs
- **Audit** : chaque action admin (CRUD) est loguee dans AdminActivityLog

---

## 11. Seed

L'entree `v1.0.0` sera creee par le seed (upsert par version) pour que l'environnement de dev ait toujours au moins une entree de changelog.

```typescript
await prisma.changelogEntry.upsert({
  where: { version: "1.0.0" },
  update: {},
  create: {
    version: "1.0.0",
    title: "Lancement de Forest Manager",
    content: {
      features: [
        { text: "Gestion de recettes personnelles et communautaires" },
        { text: "Systeme de communautes privees avec invitations" },
        { text: "Propositions de modifications collaboratives" },
        { text: "Import de recettes depuis des URLs externes" },
      ],
      improvements: [],
      fixes: [],
    },
  },
});
```

---

## 12. Points exclus (hors scope)

- **Notifications de nouveau changelog** : prevu pour plus tard (voir brainstorming futur)
- **Changelog public (non connecte)** : non pour l'instant, pourra etre ajoute via un flag `isPublic` sur le modele
- **Generation par LLM** : le parsing des conventional commits est deterministe et suffisant. Pas besoin d'IA.
- **Markdown dans le contenu** : pas pour la v1. Les items sont du texte brut. Enrichissement possible plus tard.
- **Webhook/notification Slack** : hors scope

---

## 13. Impact sur l'existant

| Element                  | Modification                                                    |
| ------------------------ | --------------------------------------------------------------- |
| `schema.prisma`          | + modele `ChangelogEntry`                                       |
| `AdminActionType` (enum) | + `CHANGELOG_CREATED`, `CHANGELOG_UPDATED`, `CHANGELOG_DELETED` |
| `deploy.yml`             | + job `generate-changelog`                                      |
| `Sidebar.tsx`            | Version cliquable → lien `/changelog`                           |
| `AdminLayout.tsx`        | + nav item "Changelog"                                          |
| `adminRoutes.tsx`        | + route `/admin/changelog`                                      |
| Routes user              | + route `/changelog`                                            |
| Backend routes           | + `/api/changelog`, `/api/admin/changelog`                      |
| `.env` / docker-compose  | + `CHANGELOG_API_KEY`                                           |
| `seed.ts`                | + upsert changelog v1.0.0                                       |
