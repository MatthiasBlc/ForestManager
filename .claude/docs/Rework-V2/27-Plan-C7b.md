# Plan C7b - Connexion avec Discord

Statut : voir le journal (D202, D210). Les sous-etapes sont des cases dans `4-Roadmap.md`.
References : `1-CDC-V2.md` S4.1 (F-ACC-1 a F-ACC-5), S6.2 (securite), `13-Parcours.md` (inscription, connexion, profil), `16-Maquettes/1-Acces-Espaces/` (E-CONNEXION, E-INSCRIPTION, E-PROFIL, E-SUPPRESSION), journal D13, D20, D21, D116, D134, D148, D202.

## 1. Perimetre

**Dans C7b** [D202, D210] :

- Connexion par Discord (OAuth2, code d'autorisation) depuis E-CONNEXION et E-INSCRIPTION ("Continuer avec Discord").
- Inscription par Discord : premiere connexion d'un compte Discord inconnu -> ecran de confirmation E-INSCRIPTION-DISCORD (nom propose, email, avatar repris une fois).
- Liaison et deliaison depuis le profil (section "Compte Discord").
- Compte sans mot de passe : definir un mot de passe depuis le profil ; changement d'email apres avoir defini un mot de passe ; suppression du compte en tapant son nom d'utilisateur.

**Hors C7b** : bot Discord (piste lointaine), autres fournisseurs (Google...), connexion Discord du super admin (jamais, D202), synchronisation continue du nom ou de l'avatar avec Discord.

## 2. Choix [D210]

Tranches au selecteur par le proprietaire (2026-11-13) :

- **Email** : portees `identify email`. Email Discord verifie -> repris et marque verifie (modifiable a la confirmation ; modifie, il redevient non verifie). Sans email verifie : la personne le tape. Jamais de liaison automatique a un compte existant qui a cet email (D202) : refus `AUTH_004` avec le message "connecte-toi avec ton mot de passe, puis relie Discord depuis ton profil".
- **Creation** : toujours par un ecran de confirmation (evite le doublon silencieux d'un utilisateur existant qui clique sur Discord), avec le lien "Tu as deja un compte ? Connecte-toi puis relie Discord".
- **Suppression sans mot de passe** : taper son nom d'utilisateur (facon GitHub).
- **Avatar** : copie une seule fois dans le stockage a la creation, si le stockage est configure ; ensuite il ne suit plus Discord. Aucune image servie depuis Discord (CSP inchangee).
- **Secours** (demande du proprietaire pendant C7b.1) : un compte cree par Discord est invite a definir un mot de passe de secours (notification `core.password.missing` vers "Mot de passe" du profil, retiree des qu'un mot de passe est defini, et encart du profil) et a verifier son email s'il ne l'est pas (rappel existant D90).

Choix techniques (defauts annonces) :

- **Schema** : colonnes sur `User` (un seul fournisseur, pas de table generique) : `discordId String? @unique`, `discordUsername String?` (affiche au profil, rafraichi a chaque connexion Discord), `passwordHash String?` (null = compte sans mot de passe). Anonymisation a la suppression : `discordId` et `discordUsername` remis a null.
- **OAuth2** : client confidentiel (secret cote API), code d'autorisation, `state` aleatoire de 128 bits garde en session 10 minutes (avec l'intention `login` / `link`, `next` filtre comme `safeNext`, "rester connecte"), `prompt=none` (pas d'ecran d'autorisation si deja accorde). Jeton d'acces Discord utilise une fois puis oublie (rien stocke).
- **Redirection** : `${APP_URL}/api/v1/auth/discord/callback` (nginx et le proxy Vite transmettent deja `/api`). Une application Discord par environnement (dev, preprod, prod) ou une seule avec trois redirections : au choix du proprietaire.
- **Configuration** : `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` facultatives (absentes -> `features.discord = false`, boutons masques) ; `DISCORD_BASE_URL` (defaut `https://discord.com`) et `DISCORD_CDN_URL` (defaut `https://cdn.discordapp.com`) pour le faux Discord des E2E. Client injectable `AppDeps.discord` (echange du code, profil, avatar) ; faux client dans les tests de l'API.
- **Inscription en attente** : profil Discord (id, nom, email verifie ou non, hash d'avatar) garde en session 15 minutes, jamais renvoye tel quel au navigateur sauf ce que l'ecran affiche (`GET /auth/discord/pending`).
- **Nom propose** : nom Discord ramene aux regles (`.` et caracteres hors `[a-zA-Z0-9_]` -> `_`, 30 au plus, complete a 3 avec `_`), suffixe numerique si pris ; modifiable.

## 3. Decoupage

Tranches verticales, tests ecrits d'abord [D151]. Ordre : C7b.1 (API), maquette, C7b.2 (web), C7b.3 (E2E, infra), revue dans Chrome, cloture. La maquette ne bloque pas l'API (aucun ecran).

### C7b.1 API

- Partage (`packages/shared`) : codes `AUTH_015` (connexion Discord indisponible, annulee ou expiree), `AUTH_016` (ce compte Discord est deja relie a un autre compte), `AUTH_017` (definis d'abord un mot de passe : deliaison ou changement d'email sans mot de passe), `AUTH_018` (nom d'utilisateur incorrect, confirmation de suppression). `meSchema` : `hasPassword`, `discord: { username } | null`. Corps : `discordRegisterBodySchema` (`username`, `email`), `changePasswordBodySchema` avec `currentPassword` facultatif (exige seulement si le compte a un mot de passe), `deleteAccountBodySchema` = `password` ou `username` (un des deux). `features.discord` dans `/config`.
- Prisma : migration `discord` (colonnes ci-dessus, `passwordHash` nullable).
- `core/auth/discord.ts` (client) et `discord-routes.ts` :
  - `GET /auth/discord/start?intent=login|link&next=&remember=` : 302 vers Discord (state en session). `link` exige une session complete.
  - `GET /auth/discord/callback?code&state` (ou `error`) : state verifie et consomme, code echange, profil lu.
    - `login`, compte relie -> session (rotation, "rester connecte"), `lastLoginAt`, `discordUsername` rafraichi, 302 vers `next`.
    - `login`, compte inconnu -> inscription en attente, 302 vers `/register/discord?next=`.
    - `link` -> liaison (refus `AUTH_016` si relie ailleurs ; remplace un ancien Discord du meme compte), 302 vers `/profile?discord=linked`.
    - Erreur ou annulation -> 302 vers `/login?error=AUTH_015` (ou le profil pour `link`), jamais une page JSON.
  - `GET /auth/discord/pending` : nom propose, email (et s'il est verifie), avatar present ou non ; `AUTH_015` sans attente valable.
  - `POST /auth/discord/register` : meme regles que F-ACC-1 sans mot de passe (disponibilite du nom et de l'email, `AUTH_004` si l'email existe), espace perso et modules par defaut dans la meme transaction que `register` (code partage), email verifie si inchange, sinon email de verification ; avatar copie apres coup (echec journalise, sans effet). Session ouverte, attente consommee.
  - `DELETE /me/discord` : `AUTH_017` sans mot de passe.
  - Definir un mot de passe : `PUT /me/password` sans `currentPassword` quand le compte n'en a pas (sinon `AUTH_005`) ; regles de force habituelles ; autres sessions fermees ; rappel `core.password.missing` retire (aussi par le mot de passe oublie et le temporaire de l'admin).
- Ajustements : `authenticate` (hash null -> `burn`, `AUTH_002` ; le mot de passe temporaire de l'admin reste valable), `changePassword` (`AUTH_017` sans mot de passe), `updateProfile` (changement d'email sans mot de passe -> `AUTH_017`), `deleteAccount` (mot de passe ou, sans mot de passe, nom d'utilisateur exact -> `AUTH_018`), anonymisation. Admin A-UTILISATEURS : marque "Discord" et "sans mot de passe" sur la fiche.
- Rate limit : `start` et `callback` 20 / 15 min, `register` comme l'inscription.
- Tests : `apps/api/test/auth-discord.test.ts` (faux client : connexion, inscription, liaison, deliaison, state invalide ou rejoue, attente expiree, email deja pris, nom propose, avatar), ajouts a `auth.test.ts` et `account-deletion.test.ts`, matrice des routes.

### C7b.0 Maquette

`29-Maquette-C7b.html` a cote du plan : bouton "Continuer avec Discord" (E-CONNEXION, E-INSCRIPTION), E-INSCRIPTION-DISCORD, section "Compte Discord" et "Definir un mot de passe" du profil, E-SUPPRESSION sans mot de passe. Validee par le proprietaire (selecteur) avant C7b.2.

### C7b.2 Web

- `core/access` : bouton Discord (logo SVG en ligne, couleur de marque) si `features.discord`, `next` et "rester connecte" transmis ; message de `?error=` ; page `/register/discord` (E-INSCRIPTION-DISCORD).
- `core/profile` : section "Compte Discord" (Relier / "Relie a <nom>" + Delier, refus `AUTH_017` explique), mot de passe : "Definir un mot de passe" sans mot de passe, email : renvoi vers la definition du mot de passe ; E-SUPPRESSION : champ nom d'utilisateur sans mot de passe.
- Tests : `access.test.tsx`, `profile.test.tsx` (MSW).

### C7b.3 E2E, infra

- Faux Discord dans `docker/compose.e2e.yml` (petit serveur : `authorize` qui renvoie aussitot vers le callback, `token`, `users/@me`) ; parcours 17 "Inscription par Discord puis connexion" ; parcours de liaison depuis le profil.
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` dans `compose.preprod.yml`, `compose.prod.yml`, `deploy.sh` (facultatives), `ci.yml` (secrets `DEV_DISCORD_*` et `DISCORD_*`).
- **Action du proprietaire** : application Discord (portail developpeur), redirections preprod et prod, secrets GitHub.

### Revue et cloture

- Revue dans Chrome sur la stack de dev avec une vraie application Discord (si le proprietaire en fournit une pour le dev), sinon avec le faux Discord.
- CDC (F-ACC-1 a F-ACC-5, ligne D210), `13-Parcours.md`, `14-Architecture.md` (variables), lignes de la feuille de recette (`acc-discord-inscription`, `acc-discord-connexion`, `acc-discord-liaison`, `acc-sans-mdp`), publiee.

## 4. Risques

- Comptes sans mot de passe : chaque chemin qui verifiait le mot de passe (changement, email, suppression, admin) doit traiter le hash null ; liste de 2.C7b.1 relue a la revue.
- Prise de compte : jamais de liaison par email ; liaison seulement depuis une session complete ; `state` a usage unique.
- Discord indisponible : la connexion par mot de passe reste ; un compte sans mot de passe passe par "Mot de passe oublie" (SMTP) ou le mot de passe temporaire de l'admin (D134).
