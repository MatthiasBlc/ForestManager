# Plan C4 - Referentiels et administration

Statut : voir le journal (D170 a D173). Les sous-etapes sont des cases dans `4-Roadmap.md`.
References : `1-CDC-V2.md` S3.3, S4.4 et S4.9, `11-Modele-Donnees/schema.prisma` sections 4 et 8, `12-Permissions.md` (Administration), `13-Parcours.md` (P09), `16-Maquettes/4-Administration/` (A01 a A13), `15-Plan-Tests.md` (Admin, scenario E2E 13). V1 relue depuis `v1-final` : `backend/src/admin/`, `backend/src/scripts/createAdmin.ts`, `frontend/src/pages/admin/`.

## 1. Perimetre

**Dans C4** : compte super admin (creation par script, connexion 2FA TOTP, session isolee de 30 min non glissante), journal d'audit de chaque action, shell d'administration ; file des demandes d'acces aux modules et catalogue (D33) ; gestion des referentiels (ingredients, fusion D120, traductions, poids par unite D46, unites, rayons D125, tags globaux) ; utilisateurs et mot de passe temporaire (D134) ; espaces et moderation motivee (D52, D122) ; journal d'audit (D128), reglages en lecture seule (D135), tableau de bord (D129).

**Hors C4** :

- Changelog : ecran admin A10, page utilisateur et generation par la CI en C6, avec les notifications et l'activite [D171]. L'entree "Changelog" de la navigation admin est absente en C4.
- Notifications : OWNER prevenu d'un acces de moderation [D172], OWNER prevenu d'une demande accordee ou refusee, admin prevenu d'une nouvelle demande (P09). En C4, tout est dans le journal d'audit et dans les listes "en attente" ; C6 branche les notifications sur les points d'accroche poses ici.
- Traductions affichees aux utilisateurs : C4 saisit les noms anglais (D34), l'interface reste en francais seul.

## 2. Decoupage [D173]

Tranches verticales, comme C3 (D161) : chaque sous-etape livre l'API (`apps/api/src/core/admin/`, routes sous `/api/v1/admin`), le partage (schemas, codes `ADMIN_`) et les ecrans, avec ses tests ecrits d'abord [D151]. Pagination par offset dans l'admin (`14-Architecture.md`).

### C4.1 Compte admin, 2FA, audit, shell

- Migration : `AdminUser` complet, `AdminSession`, `AdminAuditLog` (schema cible, section 8). Le journal refuse `UPDATE` et `DELETE` au niveau de la base (trigger), en plus de l'absence de route [D128].
- Script `apps/api/src/scripts/create-admin.ts` (reprise de `createAdmin.ts` V1, D174) lance dans le conteneur ; pas de creation par l'API ni par le seed.
- Connexion : identifiant et mot de passe, puis configuration de la 2FA a la premiere connexion (secret TOTP, QR code, cle a saisir, code de confirmation) ou code TOTP ensuite (otplib). Session admin dans un cookie distinct de celui des utilisateurs, store maison comme D148, 30 min non glissantes, CSRF, rate limit renforce. Un compte utilisateur ne donne aucun droit admin, et l'inverse.
- `requireAdmin` et `audit(action, cible, donnees)` dans une meme transaction que l'action ; categories du journal tirees de la cle d'action (`module.*`, `ingredient.*`, `moderation.*`...).
- Web : routes `/admin` chargees dans un bundle a part (lazy) de la meme SPA [D170], A01, A01a, A01b (sans compteur d'etapes, D138), AdminNav (bureau) et en-tete mobile avec la duree restante de la session, tableau de bord A02 vide qui se remplit au fil des tranches.

### C4.2 Modules : demandes et catalogue

- File des demandes (A03) : accorder, refuser avec motif (A03b) ; demandes traitees recemment.
- Catalogue (A04) : statut de chaque module (disponible, beta, bientot, retire), espaces ayant acces, accorder d'office a un espace, retirer l'acces (donnees conservees et masquees, D33, D85). Le seed continue de n'ecrire le statut qu'a la creation.
- Audit de chaque decision. Point d'accroche pour les notifications de C6.

### C4.3 Referentiels

- Ingredients (A05) : onglets Nouveaux, Verifies, Sans traduction, Sans rayon ; ajouter, renommer, traduire, rayon et unite par defaut, poids par unite (D46), marquer comme verifie. "Doublon probable" calcule par similarite (`pg_trgm`) avec un ingredient verifie.
- Fusion (A05b, D120) : les ingredients des recettes pointent vers la cible, les quantites ne changent pas, le fusionne devient un synonyme propose a la saisie ; les revisions passees restent telles quelles. Personne n'est notifie ; audit.
- Unites (A06) : ajouter, modifier (dimension, facteur vers la base, traduction) ; testeur d'addition qui reutilise `packages/shared/src/units/` (meme calcul que la future liste de courses).
- Rayons (A07) : ajouter, traduire, ordonner (parcours en magasin), classer les ingredients sans rayon (D125).
- Tags globaux (A08) : creer, traduire, fusionner (deplace les recettes), supprimer (retire de toutes les recettes).
- Le seed reste en `update: {}` : il ne reecrit jamais ce que l'admin a modifie.

### C4.4 Utilisateurs

- Liste (A12) : recherche, filtres (tous, OWNER d'un espace, inactifs depuis 6 mois), espaces, inscription, derniere connexion. Compte seulement, jamais le contenu ; pas de connexion a la place d'un utilisateur.
- Mot de passe temporaire (A12b, D134) : genere et affiche une fois, 24 h, usage unique (`AuthTokenKind.TEMP_PASSWORD`) ; l'ancien mot de passe reste valable tant que le temporaire n'a pas servi.
- Cote utilisateur : connexion avec le temporaire -> ecran "Choisis ton mot de passe" obligatoire avant toute autre action ; ensuite les autres sessions sont fermees.

### C4.5 Espaces et moderation

- Liste (A09) : groupes, perso, en suppression ; OWNER, membres, recettes, modules, etat. Restaurer un espace en suppression (a la demande de l'OWNER).
- Acces de moderation (A09b, D52, D122) : motif obligatoire (liste et "Autre"), lecture seule pendant 30 minutes, trace dans l'audit ; point d'accroche pour prevenir l'OWNER en C6 [D172].
- Vue de moderation de l'espace : recettes en lecture seule (reutilise les composants du detail sans les actions d'ecriture) ; actions masquer, supprimer, retirer d'un espace de partage (la recette reste chez son auteur), avec motif et audit. Supprimer un espace par moderation, avec motif.
- A trancher en realisation (nouvelle decision) : forme de l'acces de moderation en base (table dediee avec expiration) et etat "masquee" d'une recette (champ absent du schema cible).

### C4.6 Journal d'audit, reglages, tableau de bord

- Journal (A11) : filtres par categorie (Moderation, Modules, Referentiels, Comptes, Connexions), du plus recent au plus ancien, "Voir les plus anciennes".
- Reglages (A13, D135) : SMTP, Bugsink, stockage ; etat, valeurs non secretes, bouton "Tester" par service, aucun secret affiche ni renvoye par l'API.
- Tableau de bord complet (A02 bureau et A02m mobile, D129) : "A traiter" (demandes, nouveaux ingredients et doublons probables, espaces en suppression), chiffres de la plateforme, etat des services, dernieres actions admin.

## 3. Definition de fini de C4

- Chaque route admin refusee sans session admin, avec une session utilisateur, avec une session admin expiree (30 min) et avant la validation du code TOTP ; teste en integration.
- Chaque action admin ecrit une entree d'audit, verifie par un test par route ; journal non modifiable verifie en base.
- Fusion d'ingredients, conversions et mot de passe temporaire couverts par des tests d'integration ; seed relance sur une base modifiee par l'admin sans rien ecraser.
- Ecrans A01 a A13 (hors A10) livres en mobile et bureau, tests de composants verts (axe sans violation), revue visuelle dans Chrome.
- Lint, typecheck et build verts ; README du chantier et roadmap a jour.
