# Forest Manager V2 - Cahier des charges

**Version : 0.2 (BROUILLON, validation en cours)** - 2026-11-03
Statut de chaque decision : voir `3-Journal-des-Decisions.md`. Une ligne marquee `[Dxx]` renvoie a sa decision.
Les questions encore ouvertes sont au S10. Tant qu'une question touche une section, cette section n'est pas validable.

---

## 0. Objet

Extraire les concepts de la V1, les rendre coherents, et definir la cible V2 : fonctionnel, regles metier, design system, architecture. Ce document sert de contrat avant toute ligne de code, que la V2 soit une refonte du depot existant ou une reecriture (S9).

## 1. Vision produit

Forest Manager est une **plateforme d'espaces prives** : une famille, un groupe d'amis, une coloc se regroupent dans un espace et y activent des **modules**.

- Le premier module, et le coeur de l'app, ce sont les **recettes** : retrouver ses recettes (carnets, liens, photos, mails) et les partager avec ses proches.
- Les modules suivants s'appuient dessus : **planning de repas** (manuel puis genere), puis **liste de courses** tiree du planning.
- Plus tard, d'autres modules sans rapport avec la cuisine (listes de jeux, de films...) doivent pouvoir s'ajouter sans toucher au coeur.

Principes directeurs :

1. **Un concept = un objet.** Pas de copies synchronisees en cachette (cf. recettes V1).
2. **L'utilisateur comprend toujours ou est son contenu et qui peut y toucher.**
3. **Rien ne bloque l'utilisateur en attendant un admin** (tags et ingredients PENDING en V1).
4. **Le personnel et le collectif fonctionnent pareil** : l'espace perso est un espace comme les autres [D02].
5. **Modulaire de bout en bout** : un module se declare (back + front + nav + permissions) au lieu d'etre cable en dur [D10].

## 2. Glossaire

| Terme          | Definition V2                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Espace (Space) | Conteneur de contenu et de membres. Type `PERSONAL` (1 par user, 1 seul membre) ou `GROUP` ("communaute" a l'ecran). |
| Membre         | Lien user <-> espace avec un role (S3).                                                                              |
| Module         | Brique fonctionnelle activable par espace (Recettes, Planning, Courses...).                                          |
| Recette        | Contenu cree par un auteur, rattache a un espace d'origine.                                                          |
| Partage        | Rendre une recette visible dans un autre espace **par reference** (pas de copie) [D03].                              |
| Adaptation     | Copie d'une recette dans un espace, liee a l'original ; modifiable sans toucher l'original [D17].                    |
| Copie (fork)   | Duplication explicite d'une recette dans un espace, qui devient independante, avec trace de l'origine.               |
| Revision       | Etat date d'une recette. Chaque modification acceptee cree une revision [D05].                                       |
| Suggestion     | Modification proposee par un membre sur une recette dont il n'est pas l'auteur [D04].                                |
| Referentiels   | Tags, ingredients, unites. Partages par toute la plateforme ou propres a un espace.                                  |

## 3. Acteurs et roles

### 3.1 Roles dans un espace GROUP [D06]

| Action                                        | MEMBER | MODERATOR | OWNER |
| --------------------------------------------- | :----: | :-------: | :---: |
| Voir le contenu, ajouter des recettes         |   x    |     x     |   x   |
| Suggerer une modification                     |   x    |     x     |   x   |
| Modifier / retirer **sa** recette             |   x    |     x     |   x   |
| Modifier / retirer la recette d'un autre      |        |     x     |   x   |
| Trancher une suggestion si l'auteur est parti |        |     x     |   x   |
| Gerer les tags de l'espace                    |        |     x     |   x   |
| Inviter, exclure un membre                    |        |     x     |   x   |
| Promouvoir / retrograder un moderateur        |        |           |   x   |
| Activer / desactiver un module                |        |           |   x   |
| Renommer, changer l'avatar                    |        |     x     |   x   |
| Supprimer l'espace, transferer la propriete   |        |           |   x   |

Regles :

- Un espace GROUP a toujours **exactement un OWNER**. Il ne peut pas partir sans transferer la propriete (ou supprimer l'espace).
- Le dernier membre qui part supprime l'espace (soft delete) apres confirmation explicite.
- Les droits des modules (ex : qui peut editer le planning) se reglent par module, sur la base de ces 3 roles.

### 3.2 Espace PERSONAL

Un seul membre, OWNER. Pas d'invitation, pas de suggestions. Tous les modules qui ont du sens en solo y sont disponibles (recettes, planning, courses).

### 3.3 Administration plateforme

`AdminUser` reste isole (session dediee, 2FA TOTP, audit log). Il gere : referentiels globaux, catalogue des modules, moderation de dernier recours (recettes, espaces), changelog. Il **n'est plus** un passage oblige pour qu'un user utilise un tag ou un ingredient [D08][D09].

## 4. Perimetre fonctionnel

Identifiants `F-<module>-<n>` pour que roadmap et tests s'y referent.

### 4.1 Comptes

- F-ACC-1 Inscription email + username + mot de passe. Verification de l'email [Q05].
- F-ACC-2 Connexion avec option "rester connecte" (30 jours). Sans l'option : session 1 jour glissante [D13].
- F-ACC-3 Mot de passe oublie par email [Q05].
- F-ACC-4 Profil : username, email, mot de passe, avatar, theme d'interface (S5.3).
- F-ACC-5 Suppression du compte (RGPD) : anonymisation de l'auteur sur les contenus restes dans des espaces GROUP [Q03].
- F-ACC-6 Export de ses donnees (recettes en JSON / Markdown).
- A la creation du compte, l'espace PERSONAL est cree automatiquement.

### 4.2 Espaces, membres, invitations

- F-SPC-1 Creer un espace GROUP (nom, description, avatar, couleur d'accent). Le createur est OWNER.
- F-SPC-2 Inviter par **lien d'invitation** (expiration, nombre d'usages, revocable) ou par username exact [D07].
- F-SPC-3 Accepter / refuser une invitation. Les invitations en attente sont visibles dans le centre de notifications.
- F-SPC-4 Quitter, exclure, promouvoir, retrograder, transferer la propriete (S3.1).
- F-SPC-5 Supprimer l'espace (OWNER) avec confirmation et delai de grace [Q06].
- F-SPC-6 Activer / desactiver les modules autorises par la plateforme.
- F-SPC-7 Fil d'activite de l'espace.

### 4.3 Recettes (module coeur)

Contenu :

- F-REC-1 Titre, photo, portions (avec mise a l'echelle des quantites), temps (preparation, cuisson, repos, total calcule), ingredients (quantite, unite, ingredient), etapes ordonnees, notes, source (URL).
- F-REC-2 **Sections** optionnelles (ex : "Sauce", "Pate") regroupant ingredients et etapes ; une recette simple = 1 section implicite [Q07].
- F-REC-3 Tags.

Cycle de vie [D03][D04][D05] :

- F-REC-4 Creer une recette **dans un espace** (perso ou groupe). Elle a **un** espace d'origine et **un** auteur. Plus de double creation perso + communaute.
- F-REC-5 **Partager** une recette dans d'autres espaces dont on est membre : la recette apparait dans ces espaces, c'est la meme recette (une seule source de verite, pas de synchronisation).
- F-REC-6 **Adapter** une recette pour un espace ("chez nous on la fait au beurre") : nouvelle recette de cet espace, liee a l'original et a sa revision de depart (`adaptedFromId`). L'original n'est jamais modifie. L'adaptation signale quand l'original a change et offre un ecran "Comparer avec l'original" en lecture seule [D17].
- F-REC-7 **Suggerer une modification** (membre non auteur) : diff lisible champ par champ. L'auteur (ou un moderateur si l'auteur n'est plus membre) accepte ou refuse. Accepter cree une revision. Refuser ne cree rien ; le suggereur peut, s'il le veut, transformer sa suggestion en copie personnelle.
- F-REC-8 **Historique des revisions** consultable, avec restauration par l'auteur.
- F-REC-9 Retirer une recette d'un espace de partage (auteur ou moderateur de cet espace) sans la supprimer.
- F-REC-10 Supprimer une recette (auteur) : elle disparait de tous les espaces ou elle est partagee, apres confirmation listant ces espaces.
- F-REC-11 Recherche et filtres : texte, tags, ingredients, temps max, auteur, espace. Tri.
- F-REC-12 Vue cuisine : etapes en grand, ecran maintenu allume, cochage des ingredients.

Ce que l'on supprime de la V1 : la recette perso jumelle creee automatiquement, la synchronisation des copies, la variante creee automatiquement au refus d'une proposition, la gestion "recette orpheline" (remplacee par la reprise par les moderateurs).

### 4.4 Referentiels (tags, ingredients, unites) [D08][D09]

- F-REF-1 Tags globaux : liste courte et curee par l'admin (ex : vegetarien, dessert, rapide).
- F-REF-2 Tags d'espace : propres a chaque espace, y compris sur une recette partagee [D19]. Tout membre peut en creer en taguant une recette ; ils sont immediatement utilisables. Les moderateurs les renomment, fusionnent, suppriment.
- F-REF-3 Ingredients : catalogue global. Un ingredient inconnu est cree a la volee et utilisable tout de suite ; l'admin fusionne les doublons a posteriori (le statut sert au tri de la file admin, pas a bloquer).
- F-REF-4 Unites : catalogue global gere par l'admin, avec categories (poids, volume, cuillere, piece, qualitatif) et conversions pour la liste de courses.
- Supprime : workflow PENDING des tags d'espace, suggestions de tags, preference "masquer les tags" par espace [Q08].

### 4.5 Import

- F-IMP-1 Import depuis une URL (JSON-LD schema.org, comme en V1) vers un formulaire pre-rempli que l'utilisateur valide.
- F-IMP-2 Import depuis un texte colle (parsing heuristique, sans LLM payant) [Q09].
- Securite : resolution DNS et verification d'IP privee **a chaque redirection**, taille et duree bornees.

### 4.6 Planning de repas (module)

Reprend la V1 (grille jours x repas, slots recette / texte libre / vide, verrouillage, echange par glisser-deposer, idees de repas, archives, generation par jeux de parametres) avec ces changements :

- F-MPL-1 Disponible dans l'espace PERSONAL aussi.
- F-MPL-2 Choix des repas de la journee configurable (V1 : midi / soir en dur) [Q10].
- F-MPL-3 Droit d'edition par role (S3.1) au lieu du booleen `editableByMembers`.
- F-MPL-4 Une idee de repas peut etre convertie en recette.
- F-MPL-5 Un slot peut pointer vers n'importe quelle recette visible dans l'espace (origine ou partagee).
- La generation (regles par tag ou recette, poids, frequences, cooldowns, exclusions, epinglages) est conservee telle quelle fonctionnellement ; son UI est refaite.

### 4.7 Liste de courses (module, V2.1)

- F-SHP-1 Generer une liste depuis une periode du planning (agregation des ingredients, conversion d'unites, mise a l'echelle des portions).
- F-SHP-2 Articles libres, cocher "achete", archiver.
- F-SHP-3 Regroupement par type de magasin, magasin favori par ingredient.

### 4.8 Notifications et activite

- F-NOT-1 Centre de notifications persistant (comme V1), temps reel par WebSocket, groupement.
- F-NOT-2 Preferences par categorie et par espace.
- F-NOT-3 Types de notification types (enum) et declares par chaque module.
- F-NOT-4 Notification "nouvelle version" liee au changelog.

### 4.9 Administration plateforme

Dashboard, referentiels, catalogue de modules (lesquels sont disponibles, pour quels espaces), espaces, recettes (moderation), changelog, journal d'audit. Reprise de la V1 avec le design system V2.

### 4.10 Changelog

Reprise de la V1 (genere par la CI, page utilisateur, CRUD admin).

## 5. UX et design system

### 5.1 Principes

- **Une seule interface** desktop et mobile, construite avec les memes composants (pas de pages "mobile" a part).
- **Navigation stable en 3 niveaux** : espace -> module -> contenu. L'utilisateur sait toujours dans quel espace il est.
- **Le contenu d'abord** : les panneaux lateraux et les menus servent le contenu, pas l'inverse.
- **Tout se retrouve** : palette de commandes (Ctrl+K) et recherche globale.

### 5.2 Structure d'ecran (App shell)

- **Rail des espaces** (gauche, etroit) : avatar de l'espace perso puis des groupes, bouton "+". Sur mobile : selecteur d'espace en haut.
- **Barre du module** : modules actifs de l'espace courant (Recettes, Planning, Courses, Membres, Reglages). Sur mobile : barre d'onglets en bas.
- **Zone de contenu** : liste / detail, avec panneau de detail lateral sur grand ecran et page pleine sur mobile.
- **En-tete** : recherche, notifications, profil.
- Dashboard d'accueil fait de **widgets** que l'utilisateur choisit et ordonne (prochains repas, recettes recentes, invitations, activite).

### 5.3 Design system

- **shadcn/ui** (Radix + Tailwind) : composants copies dans le depot, donc modifiables, organises en 3 couches : `ui/` (primitives shadcn), `patterns/` (composites : RecipeCard, IngredientInput, SlotCell...), `modules/` (ecrans).
- **Tailwind v4** avec des **tokens CSS** (`--background`, `--foreground`, `--primary`, `--muted`, `--radius`, etc.) definis une fois.
- **Personnalisable** : theme clair / sombre / systeme, densite (confortable / compacte), taille du texte, et **couleur d'accent par espace** (chaque espace a sa teinte, appliquee par variable CSS quand on y entre).
- Icones : un seul jeu (Lucide, livre avec shadcn). daisyUI et react-icons sont retires.
- Accessibilite : focus visible, navigation clavier complete (Radix), contraste AA, cibles tactiles de 44px.
- Un **catalogue de composants** vivant (page interne `/design` ou Storybook [Q11]) sert de reference.

### 5.4 Ecrans a maquetter avant de coder

Accueil (widgets), liste de recettes, detail de recette (+ vue cuisine), formulaire de recette (sections, ingredients, etapes), suggestion et diff, planning (semaine, mobile jour par jour), parametres de generation, espace (membres, invitations, modules, reglages), notifications, profil et apparence, admin.

## 6. Exigences techniques

### 6.1 Architecture

- Monorepo npm workspaces : `apps/api`, `apps/web`, `packages/shared` (schemas Zod, types, codes erreur, constantes de permissions partages entre back et front) [D15].
- Backend : Express + Prisma conserves (maitrises, testes). Organisation **par module** (`modules/recipes`, `modules/meal-plan`...) avec routes, service, schemas, permissions et notifications propres.
- Frontend : React + Vite + TanStack Query (cache et invalidation serveur), React Router, react-hook-form + Zod partages. Chaque module enregistre ses routes, sa nav et ses widgets dans un registre.
- Temps reel : Socket.IO conserve, **jonction d'une room uniquement apres verification d'appartenance**.

### 6.2 Securite

Conserver l'acquis V1 (helmet, CSRF double submit, rate limiting, validation Zod, limites de taille, sessions en base, audit admin). Ajouter : verification des rooms socket, anti-SSRF a chaque redirection, recherche d'utilisateurs non enumerable, verification email, politique de mot de passe, rate limit sur l'auth user.

### 6.3 Qualite

- Tests d'integration API par module (comme V1) + tests de composants + **E2E Playwright** sur les parcours critiques (inscription, recette, partage, suggestion, planning).
- Lint et typecheck bloquants en CI.

### 6.4 Infrastructure et deploiement

- Images taguees par version et SHA (plus seulement `:latest`), rollback possible.
- Preprod deployee a chaque push sur la branche de travail, prod au merge sur `master`.
- Le seed de deploiement ne contient que les referentiels ; les donnees de demo sont un script separe.
- Migrations Prisma revues avant merge, sauvegarde DB avant chaque deploy prod.

## 7. Modele de donnees cible (esquisse a valider)

```
User -+- Membership(role) -- Space(kind: PERSONAL|GROUP, accentColor, avatar)
      |                         +- SpaceModule(moduleCode, enabled, settings)
      |                         +- Invite(code, expiresAt, maxUses, uses)
      |                         \- SpaceTag
      \- Recipe(authorId, homeSpaceId, adaptedFromId?, adaptedFromRevisionId?, currentRevisionId)
            +- RecipeRevision(n, snapshot: sections/ingredients/steps, authorId, createdAt)
            +- RecipeShare(spaceId, sharedById, sharedAt)     -- visibilite par reference
            +- RecipeSuggestion(baseRevisionId, diff, status)
            \- RecipeTag(tagId, spaceId)   -- tags d'espace par espace, globaux avec spaceId null
Referentiels : Tag(scope GLOBAL|SPACE), Ingredient, Unit(+conversions)
Modules : MealPlan/MealSlot/MealIdea/GenerationParams..., ShoppingList/ShoppingItem
Transverse : Notification(type enum), ActivityLog, ChangelogEntry, Admin*
```

Points a trancher : revision en snapshot JSON ou tables normalisees [Q12] ; tags d'espace vs tags globaux sur une recette partagee dans plusieurs espaces [Q04].

## 8. Migration des donnees V1 -> V2

La prod a de vraies donnees : la migration est un livrable a part entiere, testee sur une copie de la prod.

- Chaque user recoit son espace PERSONAL ; ses recettes perso y sont rattachees.
- Les paires "recette perso + copie communautaire synchronisee" sont **fusionnees** en une recette (origine : perso) + un partage vers chaque communaute.
- Les forks (`sharedFromCommunityId`) deviennent des copies (`copiedFromId`).
- Les variantes (`isVariant`) deviennent des copies de leur proposeur, avec la recette d'origine en `copiedFromId` [Q13].
- Propositions PENDING : converties en suggestions. Historique ACCEPTED/REJECTED : conserve en lecture seule ou abandonne [Q13].
- Tags PENDING -> tags d'espace actifs. Ingredients PENDING -> actifs.
- Le role MODERATOR le plus ancien de chaque communaute devient OWNER [Q14].

## 9. Strategie : faire evoluer ou reecrire

Voir l'analyse (artefact `2-Analyse-V1.html`, section "Evoluer ou reecrire"). **Recommandation [D01]** : reecrire le frontend, refondre le backend par module dans le meme depot (en recuperant l'infra, la securite, l'admin, l'import, l'algorithme de generation et les tests), avec une migration de donnees unique. A valider.

## 10. Questions ouvertes

| #   | Question                                                                                                                                                        | Bloque     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Q01 | REPONDU (D02) - Valides-tu l'espace PERSONAL comme un espace a part entiere (planning perso, courses perso) ?                                                   | S2, S3, S7 |
| Q02 | REPONDU (D18) - Quand l'auteur d'une recette partagee quitte un groupe : la recette reste visible (figee, reprise par les moderateurs) ou disparait du groupe ? | S4.3       |
| Q03 | Suppression de compte : ses recettes partagees restent (auteur "ancien membre") ou sont supprimees ?                                                            | S4.1       |
| Q04 | REPONDU (D19) - Les tags sont-ils attaches a la recette (communs a tous les espaces) ou a la recette **dans** un espace ?                                       | S4.4, S7   |
| Q05 | Envoi d'emails : quel service gratuit (SMTP perso, Brevo, Resend free tier...) ? Sans email, pas de reset de mot de passe.                                      | S4.1       |
| Q06 | Suppression d'espace : delai de grace (ex : 30 jours restaurable) ou immediat ?                                                                                 | S4.2       |
| Q07 | Sections de recette (sous-recettes) en V2.0 ou plus tard ?                                                                                                      | S4.3       |
| Q08 | On supprime vraiment les suggestions de tags et l'option "masquer les tags" ? Les utilisais-tu ?                                                                | S4.4       |
| Q09 | Import par texte colle : en V2.0 ou plus tard ?                                                                                                                 | S4.5       |
| Q10 | Planning : faut-il d'autres repas que midi / soir (petit-dejeuner, gouter) ?                                                                                    | S4.6       |
| Q11 | Catalogue de composants : page interne simple ou Storybook ?                                                                                                    | S5.3       |
| Q12 | Revisions : snapshot JSON (simple) ou tables normalisees (requetable) ?                                                                                         | S7         |
| Q13 | Que garder de l'historique V1 des propositions et variantes ?                                                                                                   | S8         |
| Q14 | Choix de l'OWNER des communautes existantes lors de la migration ?                                                                                              | S8         |
| Q15 | Combien d'utilisateurs / communautes reels en prod aujourd'hui ? (dimensionne l'effort de migration)                                                            | S8, S9     |
| Q16 | Les failles V1 relevees (rooms socket, SSRF de l'import) : correctif immediat en V1 ou on attend la V2 ?                                                        | V1         |
