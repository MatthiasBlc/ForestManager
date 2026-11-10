# Plan C6b - Recherche globale, export, widgets d'accueil

Statut : voir le journal (D191 a D194). Les sous-etapes sont des cases dans `4-Roadmap.md`.
References : `1-CDC-V2.md` S4 (F-ACC-6, F-SPC-5, F-SPC-8), S5.1 et S5.2 [D119], `11-Modele-Donnees/schema.prisma` (`DataExport`, `ExportScope`, `ExportStatus`, `User.homeWidgets`), `13-Parcours.md` (P12, P14, P15, P16, D60), `16-Maquettes/3-Planning-Profil/` (F-RECHERCHE, F-RECHERCHE-bureau, F-EXPORT, E-PROFIL, F-SUPPRIMER-COMPTE), `16-Maquettes/1-Acces-Espaces/` (E-ACCUEIL, D-ACCUEIL, E-REGLAGES-ESPACE, F-SUPPRIMER-ESPACE), journal D37, D39, D40, D119, D189.

## 1. Perimetre

**Dans C6b** [D189] : recherche globale et CommandPalette (P16, F-RECHERCHE), export de ses recettes et de tout un espace (F-EXPORT, P12, D37) avec l'activite "X a exporte l'espace", widgets d'accueil choisis et ordonnes (E-ACCUEIL, `User.homeWidgets`).

**Hors C6b** :

- Reimport du JSON d'export : V2.1 [D192]. C6b fige le format (versionne, valide par Zod, aller-retour teste).
- Export du planning, des idees ou des profils de generation : D37 ne porte que les recettes.

**Ecarts aux maquettes** : la feuille "Personnaliser l'accueil" n'a pas de maquette [D193] ; elle reprend la liste ordonnee de E-MODULES (interrupteur + monter / descendre).

## 2. Decoupage [D194]

Tranches verticales, comme C3 a C6 : chaque sous-etape livre l'API, le partage (schemas, codes `SEARCH_` / `EXPORT_` / `HOME_`) et les ecrans, tests ecrits d'abord [D151].

### C6b.1 Recherche globale [D191]

- Contrat de module : `ApiModule.search` facultatif, `(ctx, { userId, spaceIds, query, limit }) => SearchGroup[]`. Le socle ne connait aucun module [D40] : il fournit Espaces et Membres, Recettes fournit Recettes et Ingredients, le Planning fournit les repas.
- API : `GET /api/v1/search?q=` (2 caracteres minimum, sans accents ni casse par `unaccent` / trigramme comme la liste des recettes), perimetre = espaces ou l'utilisateur est membre actif et ou le module est actif ; 5 resultats par groupe ; chaque resultat porte `spaceId` et le nom de l'espace (P16). Recettes : visibles et non masquees [D03], une seule ligne par recette (espace courant d'abord, sinon l'origine), adaptations marquees. Ingredients : nombre de recettes visibles qui l'utilisent. Planning : repas de 2 semaines en arriere a 4 semaines en avant dont la recette ou le texte correspond. Rate limit leger.
- Actions (D119) : declarees cote web, `WebModule.actions` et actions du socle (nouvelle recette, generer le planning, creer un espace, inviter, profil, apparence...), filtrees par les droits deja connus du client et par le texte tape, sans appel API.
- Web : `ui/command-palette.tsx` (composant du design system porte ici, C2.2) sur Radix Dialog : Ctrl K / Cmd K partout dans le shell, loupe de la TopBar (masquee depuis C2.4) ; plein ecran en mobile ; groupes, fleches + Entree, Echap ; vide = actions et dernieres recettes ouvertes. Choisir un ingredient ouvre E-RECETTES de l'espace filtre sur cet ingredient (`ingredientIds`, C3.2).

### C6b.2 Export [D37, D192]

- Migration : `DataExport` (schema cible), cascade a la purge d'un espace et a la suppression d'un compte (fichiers effaces par `storageKeys` ou la purge).
- Format (`packages/shared/src/schemas/export.ts`) : archive zip toujours (`recettes.json` ou un fichier `.md` par recette, `photos/` si demande). JSON : `{ format: "forest-manager/recipes", version: 1, exportedAt, recipes }`, recettes avec blocs, ingredients nommes (pas d'identifiant interne), etapes, tags par nom, sous-recettes liees par leur reference dans l'archive. Test aller-retour : chaque recette exportee se relit par le schema.
- API : `POST /me/exports` (`scope` `MY_RECIPES` ou `SPACE` + `spaceId`, `format`, `photos`) ; `SPACE` reserve a l'OWNER, un par espace sur 24 h glissantes (`EXPORT_001` avec la date du prochain possible) ; `GET /me/exports/:id` (statut) ; `GET /me/exports/:id/download` (flux depuis MinIO, demandeur seul). Generation dans l'API juste apres la reponse (pas de file d'attente, une seule instance), fichier `exports/<id>.zip` dans MinIO, `expiresAt` = 24 h, passage en `EXPIRED` et effacement par la tache horaire ; `FAILED` journalise. Sans MinIO configure : `EXPORT_002` (export indisponible) ; export inconnu, d'un autre ou expire : `EXPORT_003`. `MY_RECIPES` = recettes dont on est l'auteur, tous espaces ; `SPACE` = recettes visibles dans l'espace.
- Activite `core.space.exported` (type declare en C6) a la creation d'un export d'espace.
- Dependance zip : `fflate` (sans dependance), version de plus de deux semaines.
- Web : F-EXPORT (portee si l'utilisateur est OWNER de l'espace courant, format JSON / Markdown, interrupteur "Inclure les photos", "Preparer l'export", attente par relecture du statut, "Telecharger", rappel de l'activite et de la limite). Entrees : profil "Exporter mes recettes", reglages de l'espace "Exporter l'espace" (OWNER), propositions de F-SUPPRIMER-ESPACE et F-SUPPRIMER-COMPTE (reportees de C2.6 et C2.8).

### C6b.3 Widgets d'accueil [D193]

- Contrat : widgets declares par cle `<module>.<nom>` (`core.*` pour le socle), verifies au demarrage cote API (chargeur de donnees) et cote web (`WebModule.widgets` : titre, composant, defaut). Un widget dont le module n'est actif dans aucun espace de l'utilisateur est ignore (contrainte du schema).
- Widgets V2.0 (maquettes E-ACCUEIL et D-ACCUEIL) : Invitations et transferts en attente (`core.pending`, toujours en tete quand il y en a), Prochains repas (`meal-plan.upcoming`, par espace avec le Planning), Tes recettes les plus cuisinees (`recipes.most-cooked`, nombre de repas passes planifies, D39), Recemment ajoutees dans tes espaces (`recipes.recent`), Activite recente des groupes (`core.activity`, coupe par defaut).
- API : `GET /me/home` renvoie les widgets choisis avec leurs donnees (un appel par ecran) ; `PATCH /me/preferences` accepte `homeWidgets` (liste ordonnee de cles connues, `null` = defaut du registre).
- Web : E-ACCUEIL recompose (salutation, widgets dans l'ordre choisi, une colonne en mobile, deux en bureau comme D-ACCUEIL, etats vides des maquettes), bouton "Personnaliser l'accueil" -> feuille (interrupteur + monter / descendre, "Retablir par defaut"), enregistree a chaque changement comme l'apparence [D115]. Le temps reel relit l'accueil (`invalidate`) quand un espace change.

## 3. Definition de fini de C6b

- Tests API, web et partages verts, lint, typecheck et build verts ; format d'export couvert par un aller-retour.
- Export verifie de bout en bout avec MinIO dans la stack de dev (fichier telecharge, ouvert, photos presentes), limite d'un export d'espace par jour, expiration.
- Revue visuelle dans Chrome (bureau et mobile) : CommandPalette (clavier et mobile plein ecran), F-EXPORT et ses quatre entrees, accueil et feuille "Personnaliser".
- `13-Parcours.md` (P12, P16, D60) et CDC a jour ; schema cible et page du modele de donnees si le schema change.
- Parcours E2E 14 de `15-Plan-Tests.md` (clavier seul et palette Ctrl K) detaille dans ce plan, et export ajoute a un parcours (code et joue en C7).
