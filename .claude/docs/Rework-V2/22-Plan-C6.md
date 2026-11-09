# Plan C6 - Notifications, activite, temps reel, changelog

Statut : voir le journal (D187 a D190). Les sous-etapes sont des cases dans `4-Roadmap.md`.
References : `1-CDC-V2.md` S4.8, S4.9, S4.10, `11-Modele-Donnees/schema.prisma` sections 7 et 8, `13-Parcours.md` (P17 et la ligne "Notifications" de chaque parcours), `14-Architecture.md` S6 (amende par D188), `16-Maquettes/3-Planning-Profil/` (E-NOTIFICATIONS, E-NOTIF-PREFERENCES), `16-Maquettes/4-Administration/` (A10). V1 relue depuis `v1-final` : `.claude/docs/V1/features/changelog/SPEC_CHANGELOG.md`, `.claude/docs/V1/features/notifications-rework/SPEC_NOTIFICATIONS_REWORK.md`.

## 1. Perimetre

**Dans C6** : centre de notifications et preferences (F-NOT-1, F-NOT-2), types declares par le socle et les modules (F-NOT-3), temps reel en SSE (D188), fil d'activite d'un espace (F-SPC-7), branchement de tous les evenements annonces par les parcours et des points d'accroche de C1 a C5, changelog (A10, page utilisateur, brouillon genere a partir des commits, notification "nouvelle version" D127).

**Hors C6** (D189) :

- C6b : recherche globale et CommandPalette (P16, F-RECHERCHE), export de donnees (F-EXPORT, D37, `DataExport`), widgets d'accueil choisis et ordonnes (`User.homeWidgets`).
- L'activite "X a exporte l'espace" (D37) arrive avec l'export en C6b ; le type est declare en C6.

**Ecarts aux maquettes** : le fil d'activite n'a pas de maquette ; il reprend la liste groupee par jour de E-NOTIFICATIONS, en page "Activite" de l'espace (entree dans le menu de l'espace, a cote de Membres et Reglages). A10 gagne l'interrupteur "Prevenir tout le monde" (D127) au moment de publier.

## 2. Decoupage [D190]

Tranches verticales, comme C3 a C5 : chaque sous-etape livre l'API, le partage (schemas, codes `NOTIF_` / `CHANGELOG_`) et les ecrans, tests ecrits d'abord [D151].

### C6.1 Socle des notifications

- Migration : `Notification`, `NotificationPreference`, `ActivityEvent` (schema cible, section 7, index partiels des preferences).
- Registre : categories et types du socle (`core.*`) a cote de ceux des modules (`notificationTypes`, `activityTypes` deja valides au demarrage) ; chaque type porte sa categorie. Categories de E-NOTIF-PREFERENCES : invitations et membres, suggestions et partages, nouvelles recettes, planning, nouveautes de Forest Manager.
- Service `notify()` du socle : destinataires, preference resolue (par espace si reglee, sinon globale, sinon activee), jamais l'auteur de l'action, `groupKey` pour regrouper ("Sam et 2 autres ...") sur 24 h, `data` = parametres du message traduit cote client [D34].
- API : liste par curseur (non lues d'abord, groupees par jour cote client), compteur des non lues, marquer lu (une, toutes), preferences globales et par espace.
- Retention : purge dans la tache horaire existante (lues depuis plus de 30 jours, toutes depuis plus de 90 jours).
- Web : cloche avec compteur dans la TopBar (masquee depuis C2.4), E-NOTIFICATIONS (toucher = ouvrir la cible et marquer lu, "Tout marquer comme lu", PullToRefresh), E-NOTIF-PREFERENCES dans le profil.

### C6.2 Temps reel (SSE)

- `GET /api/v1/events` : flux `text/event-stream` authentifie par la session, battement toutes les 25 s, ferme a la deconnexion ou a l'expiration de la session.
- Abonnements calcules par le serveur : l'utilisateur et ses espaces actifs ; recalcules quand il rejoint, quitte ou est exclu d'un espace.
- Evenements : `notification` (nouvelle notification, compteur) et `invalidate` (`spaceId`, `module`, cles de requete) emis apres chaque ecriture qui touche un espace. Le Planning s'en sert pour la salle `space:<id>` reportee de C5 [D184].
- Diffusion en memoire (une seule instance d'API) derriere une interface, pour passer plus tard a PostgreSQL `LISTEN/NOTIFY` sans toucher aux appelants.
- Web : un seul `EventSource` par onglet, invalidation des requetes TanStack Query, reprise native apres coupure (relecture des compteurs a la reconnexion).
- nginx : pas de mise en tampon ni de compression sur `/api/v1/events`, delai de lecture long. Verifie avec la stack de dev et l'image prod.

### C6.3 Fil d'activite

- API : `GET /spaces/:id/activity` par curseur, pour tout membre actif ; service `recordActivity()` du socle, appele par le socle et les modules.
- Web : page "Activite" de l'espace (liste groupee par jour, acteur, message, lien vers la cible si elle est encore visible).

### C6.4 Evenements du socle

- Invitations par nom (P02), transferts proposes / acceptes / refuses, arrivees, departs et exclusions (P03, P08), espace supprime et restaure (P14), demandes de module accordees ou refusees avec le motif (P09), acces de moderation avec le motif pour l'OWNER [D121, D172].
- Les listes "en attente" de l'accueil (invitations, transferts) restent : la notification ouvre le meme ecran.
- Admin : pas de notification en base (l'`AdminUser` n'est pas un `User`) ; la nouvelle demande de module se voit dans "A traiter" du tableau de bord [D129], avec un compteur sur l'entree "Demandes" de l'AdminNav.

### C6.5 Evenements des modules

- Recettes : suggestion recue, acceptee, refusee (P07), demande de partage recue et decision (P06), adaptation d'une recette (P06), activite "X a ajoute ..." et "X a partage ..." (P04, P06).
- Planning : activite "Planning de la semaine genere par X" (P10) ; notification "repas modifie par quelqu'un d'autre" groupee par semaine et par espace (categorie Planning).
- Chaque module declare ses types et ses categories dans son manifeste ; le socle ne connait aucun module [D40].

### C6.6 Changelog [D187]

- Migration : `ChangelogEntry` avec `status` (DRAFT, PUBLISHED, HIDDEN), `publishedAt` facultatif, `notifiedAt`, `content` valide par Zod (sections Nouveautes, Ameliorations, Corrections ; items `{ text }`).
- Script `scripts/release-notes.ts` (TDD) : dernier tag semver `v[0-9]*` (ignore `v1-final`), commits conventionnels depuis ce tag, version suivante (majeure si `!` ou `BREAKING CHANGE`, mineure si `feat`, corrective sinon), items classes, scopes et marqueurs d'etape retires, commits d'une meme etape `(Cx.y)` regroupes en un item. Aucun tag semver : version 2.0.0 sans item (l'admin l'ecrit a la main).
- CI : le job `build` lance le script et ecrit `release.json` dans le contexte de l'image API ; `release-tag` pose le tag de cette version (et non plus celle de `package.json`).
- Demarrage : le seed lit `release.json` s'il existe et cree le brouillon de cette version s'il n'existe pas (creation seule, jamais d'ecrasement).
- API admin : liste des versions, modifier un brouillon ou une version publiee (titre, items), publier (avec `notify` : une notification `core.release.published` pour chaque utilisateur actif dont la categorie est activee), masquer, reafficher. Audit de chaque action [D128].
- Web : A10 (liste des versions et etats, editeur par section, "Enregistrer le brouillon", "Publier la version" avec l'interrupteur), page utilisateur "Nouveautes" (versions publiees, la plus recente d'abord), lien depuis le profil et depuis la notification.

## 3. Definition de fini de C6

- Tests API, web et partages verts, lint, typecheck et build verts ; `release-notes` couvert sur un historique git de fixture.
- Chaque ligne "Notifications" de `13-Parcours.md` est branchee ou explicitement reportee (C6b, C9).
- Flux SSE verifie a travers nginx (image prod) : une notification creee dans un onglet apparait dans un autre sans rechargement.
- Revue visuelle dans Chrome (bureau et mobile) : cloche, E-NOTIFICATIONS, E-NOTIF-PREFERENCES, Activite, A10, Nouveautes.
- `14-Architecture.md` S6 et le schema cible a jour ; page du modele de donnees regeneree et republiee.
- Scenario E2E des notifications ecrit dans ce plan (code et joue en C7).
