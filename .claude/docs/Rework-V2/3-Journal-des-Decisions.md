# Journal des decisions - Rework V2

Le CDC porte la conclusion, ce journal porte le debat. On l'ouvre quand une regle parait arbitraire : chercher son `D##`, lire l'entree, pas le fichier entier.

Statuts : **PROPOSEE** (par Claude, en attente) | **VALIDEE** | **REJETEE** | **AMENDEE** (renvoie a la nouvelle decision).
Une decision validee ne se modifie pas : on en ajoute une nouvelle qui l'amende.

---

### D01 - Strategie : reecrire le front, refondre le back par module, dans le meme depot - AMENDEE par D25

- **Constat** : le code V1 est plutot propre (validation Zod, ~1550 tests, securite soignee). Ce qui ne va pas, c'est le modele metier (recettes dupliquees et synchronisees, roles incomplets, moderation qui bloque) et l'interface (daisyUI brut, pages mobiles a part, pas de cache de donnees).
- **Options** : (A) faire evoluer la V1 feature par feature ; (B) reecrire tout from scratch dans un nouveau depot ; (C) reecriture du front + refonte du back par module + migration de donnees unique.
- **Choix propose** : C. Le domaine recettes change trop pour A (chaque etape devrait rester compatible avec un modele que l'on veut supprimer). B jette l'infra, l'admin, la securite, l'import et l'algorithme de generation, qui sont bons.
- **Consequence** : un gel fonctionnel de la V1 pendant le chantier ; la V2 sort en une fois, avec une migration repetee sur une copie de la prod.

### D02 - L'espace personnel est un espace (`Space.kind = PERSONAL`) - VALIDEE (2026-11-03)

- **Constat V1** : "perso" = `communityId: null`. Toute la logique est dupliquee (routes `/recipes` et `/communities/:id/recipes`, regles d'acces separees) et les modules (planning) n'existent pas en perso.
- **Choix** : un seul modele d'espace, perso et groupe ; les modules marchent partout. Question liee : Q01.

### D03 - Une recette, une source de verite ; partage par reference - AMENDEE par D17, puis D140

- **Constat V1** : creer une recette dans une communaute cree 2 recettes (perso + copie, `communityRecipeService.ts:47`) ; publier en cree N ; `syncLinkedRecipes` (`recipeService.ts:303`) recopie titre, etapes et ingredients mais pas les tags ni la suppression. Les forks et variantes ne sont pas synchronises. Resultat : l'utilisateur voit sa recette en double et ne sait pas laquelle il modifie.
- **Choix** : la recette vit dans son espace d'origine ; elle est **partagee** (reference) dans d'autres espaces ; la **copie** est un geste explicite qui cree une recette independante.

### D04 - Suggestions : refuser ne cree rien - VALIDEE (2026-11-03), conversion en copie remplacee par D140

- **Constat V1** : refuser une proposition cree automatiquement une variante au nom du proposeur (`proposalService.ts:277`). Le depart du createur fait auto-refuser ses propositions, donc cree des variantes en cascade (`orphanHandling.ts`). Seul le createur peut trancher (`proposals.ts:354`) : une recette dont l'auteur est parti accepte encore des propositions que personne ne pourra jamais traiter.
- **Choix** : accepter -> nouvelle revision ; refuser -> rien ; le suggereur peut convertir en copie s'il le veut. Si l'auteur n'est plus membre, les moderateurs tranchent.

### D05 - Historique par revisions - VALIDEE (2026-11-03)

- **Constat V1** : aucun historique ; une proposition acceptee ecrase la recette.
- **Choix** : chaque modification cree une `RecipeRevision`. Permet diff, restauration, suggestions basees sur une revision precise. Format : Q12.

### D06 - Roles OWNER / MODERATOR / MEMBER - VALIDEE (2026-11-03)

- **Constat V1** : pas de retrogradation, un moderateur ne peut pas en exclure un autre (`members.ts:251`), aucun moderateur ne peut supprimer une recette d'un membre (`membershipService.ts:57`), on ne peut pas supprimer une communaute sauf en etant le dernier a partir.
- **Choix** : matrice du CDC S3.1, un OWNER unique, transfert de propriete.

### D07 - Invitations par lien - VALIDEE (2026-11-03)

- **Constat V1** : il faut connaitre le username exact ; `GET /api/users/search` permet a tout user connecte de lister les usernames par prefixe.
- **Choix** : lien d'invitation (expiration, nombre d'usages, revocable) + invitation par username exact sans autocompletion globale.

### D08 - Tags d'espace libres, moderes a posteriori - VALIDEE (2026-11-03)

- **Constat V1** : un tag d'espace cree par un membre est PENDING jusqu'a validation d'un moderateur ; suggestions de tags a deux niveaux (PENDING_OWNER puis PENDING_MODERATOR) ; resolution de tags a chaque fork. Beaucoup de code (tagService, tagSuggestions, communityTags) pour un geste simple.
- **Choix** : creation libre, gestion a posteriori par les moderateurs (renommer, fusionner, supprimer). Question liee : Q04, Q08.

### D09 - Ingredients utilisables immediatement - VALIDEE (2026-11-03)

- **Constat V1** : un nouvel ingredient est PENDING et attend l'admin plateforme.
- **Choix** : creation immediate, l'admin fusionne les doublons a posteriori.

### D10 - Modules declares, activables par l'OWNER - AMENDEE par D33

- **Constat V1** : `Feature` / `CommunityFeature` n'est accorde que par le SuperAdmin ; le planning est le seul module gate (`requireFeature("MEAL_PLAN")`) ; le front cable chaque page en dur.
- **Choix** : registre de modules (code, routes, nav, permissions, notifications, widgets). La plateforme dit quels modules sont disponibles ; l'OWNER les active dans son espace.

### D13 - Sessions : 1 jour glissant, 30 jours avec "rester connecte" - VALIDEE (2026-11-03)

- **Constat V1** : 1 h glissante. Sur mobile, on est deconnecte a chaque utilisation espacee.

### D15 - Monorepo avec package partage - VALIDEE (2026-11-03)

- **Constat V1** : types et regles dupliques entre `backend/src/schemas` et `frontend/src/models` ; `frontend/src/network/api.ts` fait 739 lignes.
- **Choix** : `packages/shared` (Zod, types, codes erreur, permissions) importe par l'API et le front.

### D16 - Design system shadcn/ui + Tailwind v4, tokens et accent par espace - VALIDEE (2026-11-03)

- **Constat V1** : daisyUI (themes `coffee` / `winter`), classes `forest-accent` utilisees mais definies nulle part (`routes/adminRoutes.tsx`), composants mobiles separes, 3 jeux d'icones possibles via react-icons.
- **Choix** : CDC S5.3.

_D12 (notifications) et D14 (analytics) : non utilises. Leurs sujets sont couverts par D41 et D118 (notifications) et D39 (statistiques). D11 est ecrite plus bas (planning)._

### D17 - Adapter une recette a un espace sans toucher l'original - VALIDEE (2026-11-03), perimetre allege

- **Constat** : remarque du proprietaire (exemple creme / beurre). En V1, une proposition acceptee sur une recette publiee se propage a tous les espaces (`proposalService.ts:160-215`). D03 seul (partage par reference) ne permet pas a un espace d'adapter une recette.
- **Etude** : `archive/5-Etude-Adaptations.md` (options O1 a O4).
- **Choix valide** : adaptation liee. Deux gestes : **partager** (meme recette) ou **adapter** (copie liee a l'original et a sa revision de depart).
- **Perimetre V2.0 (allege)** : badge "l'original a change depuis votre adaptation" + ecran "Comparer avec l'original" en lecture seule. Pas de reprise ligne a ligne ni de remontee automatique : on reporte a la main, et on peut faire une suggestion classique a l'original.
- **Pourquoi allege** : le besoin de depart (B adapte sans toucher A) ne demande qu'une copie liee. La reprise ligne a ligne exige des identifiants stables par ligne et une fusion a trois sources, pour un cas rare (une recette de famille change peu). Le modele de donnees est le meme : la version complete pourra venir sans migration.

### D18 - Recette d'un auteur parti : reprise par les moderateurs - VALIDEE (2026-11-03)

- La recette reste visible dans l'espace, l'auteur est affiche "ancien membre". Les moderateurs peuvent la modifier, trancher ses suggestions ou la retirer.

### D19 - Tags propres a chaque espace - VALIDEE (2026-11-03)

- Les tags d'espace sont attaches a la recette **dans** un espace : une meme recette partagee peut etre taguee differemment dans chaque espace. Les tags globaux (vegetarien, dessert...) restent communs a la recette.

### D20 - Suppression de compte : contenus partages conserves, auteur anonymise - VALIDEE (2026-11-03)

- Les recettes partagees ou adaptees dans des espaces GROUP restent, auteur affiche "ancien membre", reprises par les moderateurs (meme regle que D18). L'espace personnel est supprime.

### D21 - Emails optionnels, service gratuit sans carte bancaire - VALIDEE (2026-11-03)

- Cible : un service SMTP gratuit sans carte bancaire (type Brevo), choisi en conception.
- **L'application doit fonctionner sans email configure** : si le SMTP n'est pas parametre, l'inscription ne demande pas de verification, "mot de passe oublie" est masque et un admin peut reinitialiser un mot de passe a la main. Rien ne plante au demarrage.

### D22 - Suppression d'espace avec delai de 30 jours - VALIDEE (2026-11-03)

- L'espace est masque pour tous, les membres sont prevenus, l'OWNER peut restaurer pendant 30 jours ; ensuite purge (photos comprises).

### D23 - Pas de migration de donnees V1 -> V2 - VALIDEE (2026-11-03)

- La V1 n'a pas d'utilisateurs reels. La base et la stack deployee seront remises a zero avant la mise en prod de la V2.
- Consequences : pas de script de migration ; la V2 part de son propre schema et de nouvelles migrations ; la strategie D01 est a reexaminer (la contrainte de reprise des donnees disparait).
- Regle conservee pour plus tard : l'OWNER d'un espace est son createur, sinon le moderateur le plus ancien.

### D24 - Recettes composees de blocs (locaux ou liens vers d'autres recettes) - VALIDEE (2026-11-03)

- **Constat** : idee du proprietaire (escalope milanaise + compotee de tomates cerises ; sauce teriyaki reutilisee dans plusieurs plats). Rejoint la question des sections de recette.
- **Etude** : `archive/6-Etude-Recettes-Composees.md`.
- **Choix valide** : une recette = blocs ordonnes, locaux (ingredients + etapes) ou liens vers une autre recette avec une quantite exprimee dans le rendement de celle-ci ; **lien vivant** (le plat montre toujours la version actuelle de la sous-recette) ; blocs locaux et liens des la V2.0 ; pas de boucle, 3 niveaux maximum. Maquette : `7-Proposition-Recettes-Composees.html`.

### D25 - Strategie : reecriture propre dans le meme depot - VALIDEE (2026-11-03)

- **Contexte** : D23 supprime la contrainte de reprise des donnees, qui etait la principale raison de refondre le backend existant plutot que de le reecrire (D01).
- **Choix** : nouveau code de zero dans ce depot (monorepo `apps/api`, `apps/web`, `packages/shared`), nouveau schema, nouvelles migrations. Les parties solides de la V1 (securite, admin 2FA, import JSON-LD, algorithme de generation, CI/CD) sont reprises a la main, relues, pas copiees en bloc. Historique git et CI conserves ; le code V1 est supprime a la fin du chantier.

### D11 - Repas du planning configurables par espace - VALIDEE (2026-11-03)

- Chaque espace choisit ses repas parmi petit-dejeuner, midi, gouter, soir (midi et soir par defaut). La grille, les exclusions, les epinglages et la generation suivent ce reglage.
- **Amendee le 2026-11-09 (plan C5, choix du proprietaire)** : deux repas par jour, midi et soir ; ni petit-dejeuner ni gouter. L'espace choisit de planifier midi, soir ou les deux (les deux par defaut). La maquette F-CREER-PLANNING (devenue F-REGLAGES-PLANNING) proposait encore les quatre.

### D26 - Partager une recette composee partage ses sous-recettes - VALIDEE (2026-11-03)

- L'ecran de partage liste les sous-recettes qui seront partagees avec la recette composee. Le reste de D24 (blocs, lien vivant ou fige) attend la maquette de proposition.

### D27 - Suppression des suggestions de tags et du masquage des tags - VALIDEE (2026-11-03)

- Avec des tags d'espace libres (D08, D19), tout membre tague directement dans son espace ; les moderateurs nettoient a posteriori. Les suggestions de tags et l'option "masquer les tags" disparaissent.

### D28 - Import depuis un texte colle en V2.0 - VALIDEE (2026-11-03)

- Decoupage heuristique sans LLM payant (blocs ingredients / etapes, lecture de "200 g de farine"), puis formulaire pre-rempli corrige et valide par l'utilisateur.

### D29 - Catalogue de composants en page interne `/design` - VALIDEE (2026-11-03)

- Route de l'app visible en dev et pour l'admin, montrant chaque composant dans tous ses etats et themes. Pas de Storybook.

### D30 - Revisions stockees en instantane JSON - VALIDEE (2026-11-03)

- Chaque revision enregistre une photo complete de la recette (blocs, ingredients, etapes). La version courante reste en tables normales pour la recherche et les filtres.

### D31 - Ordre du travail de design : design system d'abord, maquettes ensuite - VALIDEE (2026-11-03)

- Design system (couleurs, themes clair / sombre, accents d'espace, typographie, composants de base, app shell avec rail d'espaces facon Discord) avant le modele de donnees.
- Maquettes de toutes les vues apres validation du modele de donnees, des permissions et des parcours, dont elles dependent.
- Repart d'une page blanche visuelle ; seule la navigation par rail d'espaces a gauche est imposee.

### D32 - Direction visuelle : Braise en signature, Sous-bois et Potager en alternatives - VALIDEE (2026-11-03)

- **Braise** (charbon, ardoise, accent ambre de braise) est l'ambiance signature : icone, page d'accueil, captures, ambiance par defaut.
- **Sous-bois** et **Potager** sont proposees en alternatives dans Profil > Apparence. Polices communes a toutes les ambiances ; seules les couleurs changent.
- Mode par defaut : **suivre le systeme** (clair ou sombre). Braise est soignee dans les deux modes ; l'utilisateur peut forcer l'un ou l'autre.
- Consequence : 6 palettes (3 ambiances x clair / sombre) a verifier dans la page `/design`, contrastes AA compris.
- Maquette de comparaison : `archive/8-Directions-Visuelles.html`.

### D33 - Modules accordes par la plateforme sur demande de l'OWNER - VALIDEE (2026-11-03)

- **Constat** : remarque du proprietaire sur D10. Les modules sont un levier de l'application (premiere brique gratuite, d'autres peut-etre payantes un jour au cas par cas) : un espace n'a pas acces a tout.
- **Regles** :
  - A la creation d'un espace (perso ou groupe), seul le module **Recettes** est accorde et actif.
  - L'OWNER voit le **catalogue des modules** de la plateforme avec leur statut (ex : disponible, beta, bientot).
  - L'OWNER **demande l'acces** a un module pour son espace. Les super admins recoivent la demande et l'acceptent ou la refusent.
  - L'acces est accorde **a l'espace demandeur** (pas a la personne) : il reste si l'espace change d'OWNER ; chaque espace fait sa propre demande.
  - Une fois l'acces accorde, l'OWNER **active ou desactive** le module dans son espace quand il veut.
  - L'espace personnel suit exactement les memes regles.
  - Le super admin peut aussi accorder ou retirer un module de sa propre initiative ; tout est trace dans l'audit.
- **Technique** : le registre de modules de D10 est conserve (routes, navigation, permissions, notifications, widgets declares par module) ; seule la gouvernance change.
- **Monetisation** : le modele garde de quoi brancher un jour un tarif par module, sans rien implementer en V2.0.

### D34 - Multi-langue prevu des le depart, francais seul livre - VALIDEE (2026-11-03)

- Tous les textes de l'interface passent par des cles de traduction ; dates, nombres et unites sont formates selon la langue.
- Referentiels globaux (ingredients, unites, tags globaux, noms de modules) : un nom par langue en base.
- Les contenus des utilisateurs (recettes, tags d'espace) ne se traduisent pas.
- V2.0 livree en francais ; l'anglais = ajouter les traductions, sans toucher au code.

### D35 - PWA installable avec lecture hors ligne - VALIDEE (2026-11-03)

- Installable sur l'ecran d'accueil (manifest, icone, plein ecran). Pas d'appli native sur les stores.
- Hors connexion : consultation des recettes deja ouvertes et du planning de la semaine. Toute modification demande une connexion ; l'interface le signale clairement.
- Mode cuisine : l'ecran reste allume pendant la recette.

### D36 - Conversions d'unites et rayons modelises des la V2.0 - VALIDEE (2026-11-03)

- Le schema V2.0 porte les conversions entre unites (poids, volume, cuilleres) et un rayon par defaut pour chaque ingredient (fruits et legumes, boucherie...), geres par l'admin.
- Les conversions servent deja aux recettes composees (quantite d'une sous-recette dans son unite de rendement). Le module liste de courses reste en V2.1.

### D37 - Export natif : ses recettes, et tout l'espace pour l'OWNER - VALIDEE (2026-11-03)

- Chaque utilisateur exporte ses propres recettes : c'est un droit (portabilite de ses donnees), pas une option a accorder.
- L'OWNER exporte toutes les recettes de son espace : garantie de garder ses recettes si la plateforme s'arrete. Il ne recupere que ce que les membres voient deja, donc pas de module a accorder.
- Transparence : l'export d'un espace apparait dans le fil d'activite ("X a exporte l'espace") ; un export d'espace par jour au maximum.
- Formats : JSON (reimportable) et Markdown (lisible), photos dans une archive zip.
- Choix fait par Claude sur demande du proprietaire, qui hesitait (natif ou accorde par le super admin). Confirme tel quel par le proprietaire le 2026-11-05 (D142) : definitif.

### D38 - Mobile first et gestes tactiles - VALIDEE (2026-11-03)

- **Mobile first** : chaque ecran est concu et developpe d'abord pour le telephone, puis enrichi pour le grand ecran.
- Gestes integres au design system : glisser vers le bas pour fermer les panneaux du bas, appui long sur une carte (recette, repas) pour son menu d'actions (le bouton "..." reste visible), tirer pour rafraichir sur les listes.
- Exclus de la V2.0 : glisser depuis le bord (conflits avec le defilement) et vibration (absente sur iPhone).

### D39 - Statistiques : compteurs utiles, pas de suivi des vues - VALIDEE (2026-11-03)

- Choix laisse a Claude par le proprietaire.
- On n'enregistre pas qui regarde quoi (pas d'interet pour un cercle prive, et des donnees personnelles en moins).
- On affiche ce que l'application sait deja : nombre de fois ou la recette a ete planifiee et date de la derniere fois (sert au generateur et a "pas cuisinee depuis longtemps"), nombre d'adaptations, espaces ou elle est partagee. Sur l'accueil : "vos recettes les plus cuisinees".
- Les tables V1 `RecipeView` et `RecipeAnalytics` ne sont pas reprises.

### D40 - Socle generique : aucun module n'est code en dur - VALIDEE (2026-11-03)

- Le socle (comptes, espaces, membres, permissions, invitations, notifications, activite, recherche, administration) ne connait aucun module.
- Recettes se branche par le registre de modules comme tous les autres (D10, D33), meme s'il est fourni a tous les espaces.
- Objectif : un futur module sans rapport avec la cuisine (jeux, films) s'ajoute sans toucher au socle.

---

## Phase B - decisions de conception (validees en bloc le 2026-11-03)

Le detail de chacune est dans le document qui l'a proposee ; ce journal porte le statut. Validees en bloc par le proprietaire, sauf les arbitrages ci-dessous.

### Modele de donnees (`11-Modele-Donnees/`)

- **D41 - Types de notification et d'activite en cles texte declarees par les modules** - VALIDEE (2026-11-03). Pas d'enum en base : un nouveau module n'impose pas de migration du socle (precise F-NOT-3).
- **D42 - Suggestions et revisions au meme format (instantane JSON)** - VALIDEE (2026-11-03). Remplace les tables de proposition de la V1.
- **D43 - Compteurs de recettes calcules depuis le planning, pas stockes** - VALIDEE (2026-11-03).
- **D44 - Compte supprime : ligne utilisateur anonymisee conservee** - VALIDEE (2026-11-03).
- **D45 - Referentiels globaux traduits par tables de traduction ; tags d'espace en nom simple** - VALIDEE (2026-11-03).
- **D46 - Conversions : dimension et facteur vers la base, poids par ingredient et par unite** - VALIDEE (2026-11-03).
- **D47 - Partage automatique des sous-recettes trace (viaRecipeId)** - VALIDEE (2026-11-03).

### Permissions (`12-Permissions.md`)

- **D50 - Pas d'annuaire d'utilisateurs** - VALIDEE (2026-11-03).
- **D51 - Suppression du compte d'un OWNER : transfert automatique, plafond de 20 espaces possedes** - VALIDEE (2026-11-03).
- **D52 - Super admin : acces au contenu seulement pour une moderation motivee et tracee** - VALIDEE (2026-11-03).
- **D53 - Seul l'OWNER exclut ou retrograde un moderateur** - VALIDEE (2026-11-03).
- **D54 - Catalogue des modules visible par tous les membres, demande par l'OWNER** - VALIDEE (2026-11-03).
- **D55 - Restaurer une revision = meme droit que modifier** - VALIDEE (2026-11-03).
- **D56 - Seul l'auteur partage sa recette dans un autre espace** - AMENDEE par D81.
- **D57 - Recette d'un auteur parti : MOD et OWNER de l'espace d'origine la reprennent** - VALIDEE (2026-11-03).
- **D58 - Planning : role minimal reglable pour modifier un repas (MEMBER par defaut) ; generation et reglages aux moderateurs** - VALIDEE (2026-11-03), MEMBER confirme.
- **D59 - Un ancien membre qui revient retrouve ses droits d'auteur** - VALIDEE (2026-11-03).

### Parcours (`13-Parcours.md`)

- **D60 - Ouverture sur le dernier espace et module visites** - VALIDEE (2026-11-03).
- **D61 - Ecran de bienvenue a 3 choix apres l'inscription** - VALIDEE (2026-11-03). Une visite guidee est notee comme idee future.
- **D62 - Lien d'invitation : apercu de l'espace, survit a l'inscription, confirmation** - VALIDEE (2026-11-03).
- **D63 - Une seule porte d'entree pour creer ou importer une recette** - VALIDEE (2026-11-03).
- **D64 - Suggestion redigee en mode suggestion, acceptee ou refusee en entier** - VALIDEE (2026-11-03).
- **D65 - Partage regle dans une feuille a cases** - VALIDEE (2026-11-03).
- **D66 - Espace en suppression grise dans le rail de l'OWNER avec compte a rebours** - VALIDEE (2026-11-03).
- **D67 - Mode cuisine : une etape a la fois** - VALIDEE (2026-11-03).
- **D68 - Hors ligne : bandeau, ecriture desactivee, brouillon local** - VALIDEE (2026-11-03).
- **D69 - Echange de repas : glisser en desktop, menu puis cible sur mobile** - VALIDEE (2026-11-03).

### Architecture et tests (`14-Architecture.md`, `15-Plan-Tests.md`)

- **D70 - Monorepo npm workspaces** - VALIDEE (2026-11-03).
- **D71 - Registre de modules statique (manifestes API et web)** - VALIDEE (2026-11-03).
- **D72 - API REST /api/v1, Zod partage, format d'erreur unique, pagination par curseur** - VALIDEE (2026-11-03).
- **D73 - i18next, un namespace par module** - VALIDEE (2026-11-03).
- **D74 - PWA : vite-plugin-pwa, donnees hors ligne par TanStack Query persiste** - VALIDEE (2026-11-03).
- **D75 - Suivi d'erreurs : SDK Sentry, recepteur Bugsink auto-heberge** - VALIDEE (2026-11-03).
- **D76 - CI/CD : preprod au push de Developement, images version + SHA, sauvegarde avant prod** - VALIDEE (2026-11-03).
- **D77 - Outils de test : Vitest, Supertest sur vraie base, Testing Library + MSW, Playwright + axe** - VALIDEE (2026-11-03).
- **D78 - CI bloquante et seuils de couverture** - VALIDEE (2026-11-03).
- **D79 - Donnees de test partagees, sans appel a Internet en CI** - VALIDEE (2026-11-03).

### Arbitrages du proprietaire (2026-11-03)

- **D80 - Backend en TypeScript avec Express 5** - VALIDEE. Rust envisage puis ecarte : pour quelques foyers (moins d'une requete par seconde), la performance n'est pas un enjeu ; on perdrait le package partage (schemas et types communs au front et au back), l'experience acquise sur la V1 et beaucoup de temps d'apprentissage. Versions : dernieres stables compatibles (TypeScript 6.0, Prisma 7, React 19, Express 5, Tailwind 4).
- **D81 - Partager la recette de quelqu'un d'autre : demande + confiance par espace** - VALIDEE (amende D56). Tout membre qui voit une recette peut demander a la partager dans un autre de ses espaces ; l'auteur accepte ou refuse. L'auteur peut autoriser une fois pour toutes les membres d'un espace a partager ses recettes sans lui demander (il est informe). Il faut etre membre des deux espaces. Auteur parti : les moderateurs de l'espace d'origine decident. Exemple : partager dans Famille une recette creee par sa compagne dans Foyer.
- **D82 - Espace perso : contenu propre + vue "Mes recettes"** - VALIDEE. La vue liste toutes les recettes dont on est l'auteur, dans tous ses espaces, avec leur espace d'origine.
- **D83 - Espace d'origine purge : recettes partagees ailleurs rapatriees dans l'espace perso de l'auteur** - VALIDEE. Sans auteur (compte supprime), elles restent dans les espaces de partage, gerees par leurs moderateurs.
- **D84 - Quitter un groupe ou l'on a partage des recettes de son espace perso : on demande** - VALIDEE. L'ecran "Quitter" liste ces recettes et l'utilisateur choisit de laisser ou de retirer chaque partage.
- **D85 - Donnees d'un module desactive ou retire : conservees indefiniment, masquees** - VALIDEE. Elles reviennent a la reactivation ; elles partent seulement avec l'espace.
- Confirmes au passage : suivi d'erreurs Bugsink auto-heberge (D75), photos servies par liens signes de courte duree, E2E a chaque push et PR sur Chromium + WebKit, seuils de couverture 90 / 80 / 60 % (D77, D78), super admin limite a la moderation motivee (D52), transfert automatique a la suppression du compte d'un OWNER (D51), ouverture sur le dernier espace visite (D60), suggestion acceptee en entier (D64), echange de repas par menu sur mobile (D69).
- **D86 - Prisma 7 confirme comme ORM** - VALIDEE (2026-11-03). Drizzle compare : il declare index partiels et CHECK dans le schema, mais Prisma est maitrise, le schema V2 est deja ecrit et valide, et ses limites se contournent (contraintes ecrites une fois en SQL dans la premiere migration, requetes recursives et recherche floue en TypedSQL), couvertes par les tests.
- **D87 - Textes d'interface en francais correct (accents, accords)** - VALIDEE (2026-11-04). La regle "ASCII uniquement" vaut pour le code, les commentaires et la documentation. Les textes vus par les utilisateurs (fichiers de traduction i18n, maquettes) sont en francais correct, accents compris.

## Phase B5 - decisions issues des maquettes (validees le 2026-11-04)

### Acces et espaces (canevas 1)

- **D90 - La verification de l'email ne bloque rien** - VALIDEE (2026-11-04), amendee par le proprietaire : on peut rejoindre un espace sans email verifie ; un rappel arrive par notification dans l'app.
- **D91 - Le module Recettes est toujours actif, il ne se desactive pas** - VALIDEE (2026-11-04).
- **D92 - Le transfert de propriete est une proposition que le destinataire accepte ; l'ancien OWNER devient moderateur** - VALIDEE (2026-11-04).
- **D93 - Supprimer un espace se confirme en tapant son nom, avec l'export propose dans la meme feuille** - VALIDEE (2026-11-04).
- **D94 - Lien d'invitation : deux reglages seulement (duree 1, 7 ou 30 jours ; nombre de personnes), revocation dans la meme feuille** - VALIDEE (2026-11-04).
- **D95 - Navigation de l'espace perso : Accueil, Recettes, Mes recettes, Plus** - VALIDEE (2026-11-04).
- **D96 - Ajouter au design system un composant de choix (radio, nuancier) et l'etat "en suppression" du rail** - VALIDEE (2026-11-04).

### Recettes (canevas 2)

- **D100 - Detail d'une recette sur mobile : en-tete avec retour, une seule action principale fixee en bas (Mode cuisine)** - VALIDEE (2026-11-04).
- **D101 - Une demande de partage s'ouvre en feuille depuis la notification, avec le reglage de confiance sur place** - VALIDEE (2026-11-04).
- **D102 - Le bouton d'enregistrement annonce la revision creee ("Enregistrer la revision 5")** - VALIDEE (2026-11-04).
- **D103 - Champs importes douteux : badge "A verifier" et bandeau, sans bloquer l'enregistrement** - VALIDEE (2026-11-04).
- **D104 - Quitter l'editeur sans enregistrer garde un brouillon sur l'appareil** - VALIDEE (2026-11-04).
- **D105 - Comparer avec l'original : "Original modifie" et "Ce que ton espace a change", plus "Proposer a l'original"** - VALIDEE (2026-11-04).
- **D106 - Hors ligne, les actions d'ecriture sont desactivees (pas masquees) et les cartes portent un badge** - VALIDEE (2026-11-04).
- **D107 - Lier une recette : les bases d'abord, quantite saisie dans l'unite de rendement de la sous-recette** - VALIDEE (2026-11-04).
- **D108 - Ajouter un composant QuantityInput au design system** - VALIDEE (2026-11-04).
- **D109 - Ajouter les icones arrow-left et wifi-off au design system** - VALIDEE (2026-11-04).

### Planning et profil (canevas 3)

- **D110 - La generation produit un apercu ; rien n'est enregistre avant "Garder ce planning"** - VALIDEE (2026-11-04).
- **D111 - Planning sur mobile : selecteur "Jour | Semaine"** - VALIDEE (2026-11-04), amendee : Jour = vue detaillee ; Semaine = liste compacte des 7 jours, une ligne par jour avec ses repas en pastilles, toucher un repas l'ouvre. Grille semaine complete en bureau.
- **D112 - Echange de repas sur mobile en mode "echange" (bandeau, cibles en pointilles, Annuler)** - VALIDEE (2026-11-04).
- **D113 - Le rapport de generation explique chaque repas laisse vide au lieu de le remplir de force** - VALIDEE (2026-11-04).
- **D114 - Exclusions et epinglages dans une seule grille jours x repas** - VALIDEE (2026-11-04).
- **D115 - Choix de l'ambiance avec apercu reel, applique immediatement** - VALIDEE (2026-11-04).
- **D116 - Suppression de compte : consequences espace par espace et export propose avant le mot de passe** - VALIDEE (2026-11-04).
- **D117 - Hors ligne, notifications lisibles et actions desactivees avec la raison** - VALIDEE (2026-11-04).
- **D118 - Preferences de notifications globales par categorie, reglage personnalise par espace** - VALIDEE (2026-11-04).
- **D119 - La recherche Ctrl K couvre aussi le planning et les actions** - VALIDEE (2026-11-04).

### Administration (canevas 4)

- **D120 - Un ingredient fusionne devient un synonyme : propose a la saisie, remplace par la cible** - VALIDEE (2026-11-04).
- **D121 - L'OWNER est informe, avec le motif, quand un admin ouvre son espace pour moderation** - VALIDEE (2026-11-04).
- **D122 - Acces de moderation en lecture seule, 30 minutes, seules les actions de moderation possibles** - VALIDEE (2026-11-04). Complete le 2026-11-05 : les actions de moderation sur une recette sont masquer, supprimer et retirer d'un espace de partage (plus doux que supprimer : la recette reste chez son auteur), toujours avec motif obligatoire et trace dans le journal d'audit.
- **D123 - Un module "bientot" est visible au catalogue mais pas encore demandable** - VALIDEE (2026-11-04).
- **D124 - Refuser une demande d'acces exige un motif visible par l'OWNER, qui peut redemander** - VALIDEE (2026-11-04).
- **D125 - Les rayons suivent le parcours en magasin ; sans rayon, l'ingredient va dans "Autres"** - VALIDEE (2026-11-04).
- **D126 - La liste de courses additionne pieces et grammes grace au poids par unite, sinon deux lignes** - VALIDEE (2026-11-04).
- **D127 - Publier une version du changelog peut notifier tous les utilisateurs (interrupteur a la publication)** - VALIDEE (2026-11-04).
- **D128 - Le journal d'audit ne se modifie ni ne se supprime ; il se filtre par categorie** - VALIDEE (2026-11-04).
- **D129 - Le tableau de bord admin s'ouvre sur "A traiter" et l'etat des services** - VALIDEE (2026-11-04).

### Arbitrages du 2026-11-04

- **D130 - Selecteur d'espace mobile dans l'en-tete** - VALIDEE. Sur mobile, l'espace courant (avatar + nom) est un bouton de l'en-tete qui ouvre la liste des espaces en feuille (avatars, pastilles de nouveautes, "+"). Remplace la bande d'espaces en haut. Le rail vertical reste en bureau. Choix fait par Claude a la demande du proprietaire ("au plus solide"), confirme tel quel le 2026-11-05 (D142) : definitif.
- **D131 - Barre d'onglets mobile : 4 modules maximum puis "Plus"** - VALIDEE. "Plus" regroupe membres, reglages et modules au-dela du quatrieme, dans l'ordre choisi par l'OWNER ; moins de modules = moins d'onglets.

### Arbitrages apres B5b (2026-11-04)

- **D132 - Donnees d'exemple : Matthias est OWNER de Colloc** - VALIDEE. Les maquettes de demande de module (E-MODULES, F-DEMANDE-MODULE) le supposaient ; ajoute au brief.
- **D133 - Une idee de repas devient une recette dans l'editeur de recette pre-rempli** - VALIDEE. Une seule maquette : E-RECETTE-EDITION-Idee (canevas Recettes) ; E-IDEES y renvoie par "Transformer en recette". F-IDEE-RECETTE (canevas Planning) est supprimee.
- **D134 - Reinitialisation d'un mot de passe sans SMTP : mot de passe temporaire de 24 h, a usage unique** - VALIDEE. Precise D21. L'admin le genere et le transmet lui-meme ; l'utilisateur doit en choisir un nouveau a la connexion. L'ancien mot de passe reste valable tant que le temporaire n'a pas servi ; ensuite les autres sessions sont fermees.
- **D135 - Reglages de la plateforme en lecture seule** - VALIDEE. SMTP, Bugsink et stockage restent configures par variables d'environnement (14-Architecture) ; l'ecran admin affiche l'etat, les valeurs non secretes et un bouton "Tester" par service.
- **D136 - TopBar en mode edition** - VALIDEE. Le design system fournit l'en-tete des editeurs : "Annuler" a gauche, titre, action principale a droite ("Enregistrer", "Envoyer"). Remplace les en-tetes faits main.
- **D137 - RadioGroup avec apercu** - VALIDEE. Une option peut afficher un apercu en pastilles de couleur ; E-APPARENCE l'utilise pour le choix de l'ambiance.
- **D138 - Pas de compteur d'etapes a la connexion admin** - VALIDEE. Le nombre d'etapes varie (2 ou 3 selon que la 2FA est deja configuree) : les titres suffisent.
- **D139 - Teinte Cendre : le bouton principal n'est pas grise** - VALIDEE (2026-11-04, revue du rendu). En Braise, la teinte 5 est grise et un bouton plein gris parait desactive : les remplissages pleins (bouton principal, interrupteur, case, pastille) reprennent la teinte 1 de l'ambiance dans un espace Cendre ; la navigation et les elements actifs gardent Cendre.

## Phase B9 - validation finale (2026-11-05)

Points ouverts releves a la preparation de B9 (relecture croisee du CDC, du schema et des documents de conception), tranches par le proprietaire le 2026-11-05 : toutes les recommandations sont retenues.

### D140 - Pas de copie independante : l'adaptation est la seule facon de copier une recette - VALIDEE (2026-11-05)

- **Constat** : le CDC gardait une "Copie (fork)" independante (glossaire S2, F-REC-7, roadmap C3) et D04 laissait le suggereur "convertir en copie". Elle n'existe ni dans le schema, ni dans `12-Permissions.md`, ni dans les parcours ou les maquettes : partout, la seule copie est l'adaptation (D17), et 12 dit deja "transformer sa suggestion refusee en adaptation".
- **Options** : (A) supprimer la copie independante ; (B) l'ajouter partout (schema, permissions, parcours, maquettes).
- **Choix** : A. Deux gestes seulement, partager et adapter (principe "un seul chemin evident par action"). Une adaptation dont on ignore les mises a jour se comporte deja comme une copie (`archive/5-Etude-Adaptations.md`, O1). Une suggestion refusee peut devenir une adaptation dans l'espace du suggereur.
- **Consequence** : amende D03 (la "copie" explicite devient l'adaptation) et remplace la conversion en copie de D04. Retire du CDC (S2, F-REC-7) et de la roadmap (C3). Aucun changement de schema.

### D141 - Liste de courses : role minimal reglable pour la modifier, MEMBER par defaut - VALIDEE (2026-11-05)

- **Constat** : les droits de la liste de courses (V2.1) etaient seulement "proposes" dans `12-Permissions.md` (memes droits que modifier le planning), sans decision au journal.
- **Options** : (A) role minimal reglable par l'OWNER, MEMBER par defaut, comme les repas du planning (D58) ; (B) droits fixes.
- **Choix** : A. Un seul reglage `editRole` (MEMBER par defaut, l'OWNER peut restreindre) couvre generer depuis le planning, ajouter des articles libres, cocher et archiver. Il sera modelise avec le module en V2.1, sur le modele de `MealPlanSettings.editRole`.

### D142 - Validation B9 : schema a jour des maquettes, super admin sans modification, statuts au journal, confirmations - VALIDEE (2026-11-05)

- **Constat** : la preparation de B9 a releve cinq autres ecarts entre le CDC, le journal et les documents de conception.
- **Choix**, point par point :
  - **Schema** : `11-Modele-Donnees/schema.prisma` est mis a jour avant la 1.0 (pas en C1) avec les decisions B5 : proposition de transfert de propriete (`SpaceOwnershipTransfer`, D92) ; expiration obligatoire du lien d'invitation (`SpaceInviteLink.expiresAt` non nullable, D94) ; ingredient `MERGED` = synonyme propose a la saisie et remplace par la cible (D120) ; ordre des modules choisi par l'OWNER (`SpaceModule.sortOrder`, D131) ; mot de passe temporaire de 24 h a usage unique (`AuthTokenKind.TEMP_PASSWORD`, D134) ; choix et ordre des widgets d'accueil (`User.homeWidgets`, CDC S5.2).
  - **Super admin** : il ne modifie jamais une recette. Lecture et actions de moderation seulement (masquer, retirer, supprimer, avec motif), conformement a D52 et D122. `12-Permissions` est corrige.
  - **Statuts des documents de conception** : 12, 13, 15 et le schema ne portent plus de statut propre (PROPOSEE, BROUILLON...) mais renvoient au journal (un statut a un seul endroit). Les questions P1 a P7 de 12 sont marquees tranchees avec leur `D##` (P1 = D83, P2 = D85).
  - **D37** (export natif) et **D130** (selecteur d'espace mobile) : confirmes tels quels, definitifs.
  - **D12 et D14** : jamais ecrites, marquees non utilisees ; leurs sujets sont couverts par D41, D118 et D39.

## Phase C1 - plan du socle (2026-11-05)

Questions posees avec le plan `17-Plan-C1.md`, tranchees par le proprietaire le 2026-11-05.

### D143 - La V2 remplace la V1 des C1 - VALIDEE (2026-11-05)

- **Constat** : le plan proposait de faire vivre la V2 a cote de la V1 (ports differents, V1 intacte jusqu'a C8). Le proprietaire indique que la V1 n'est plus utilisee et qu'elle est obsolete.
- **Options** : (A) coexistence jusqu'a C8 ; (B) remplacement immediat.
- **Choix** : B. Tag `v1-final` puis suppression du code et de l'infra V1 en C1.1 ; la V2 prend les noms courts des scripts et les ports d'origine. Les parties a reprendre plus tard se relisent depuis le tag. Plus aucun deploy jusqu'a C7 : les stacks V1 tournent sans etre redeployees.
- **Consequence** : amende la strategie du CDC (S9, "code V1 supprime a la fin du chantier") et la regle "V1 figee" de `CLAUDE.md`.

### D144 - C1 livre l'API seule - VALIDEE (2026-11-05)

- **Choix** : C1 = API, package partage et squelette Vite vide. Les ecrans du socle arrivent en C2 avec le design system, pour n'ecrire aucun ecran jetable. Les tests d'integration prouvent C1.

### D145 - PostgreSQL 17 - VALIDEE (2026-11-05)

- **Choix** : la base repart de zero (D23), on passe de 15 a 17.

### D146 - Stockage MinIO et avatars en C3 - VALIDEE (2026-11-05)

- **Choix** : avatars d'utilisateur et d'espace livres en C3 avec les photos de recettes : un seul chantier stockage. C1 reste centre sur comptes, espaces, invitations et modules.

### D147 - CI et deploy V2 repris de la V1 : meme Portainer, memes stacks, Traefik - VALIDEE (2026-11-05)

- **Constat** : le plan C1.10 ne prevoyait qu'une CI de verification. Le proprietaire demande de reprendre le processus de la V1 (`.github/workflows/deploy.yml`, `deploy_prod.sh`, `docker-compose.preprod.yml` et `.prod.yml` au tag `v1-final`) et de deployer sur le meme Portainer, idealement dans les memes stacks.
- **Choix** : la V2 reprend la chaine V1 en l'ameliorant, sans en changer les points de contact :
  - memes secrets GitHub (`REGISTRY_*`, `IMAGE_NAME`, `PORTAINER_URL`, `PORTAINER_API`, `STACK_ID`, `DEV_STACK_ID`, `ENDPOINT_ID`, `POSTGRES_*`, `SESSION_SECRET`, `ADMIN_SESSION_SECRET`), nouveaux secrets seulement si une fonction l'exige ;
  - memes images (`<registre>/<IMAGE_NAME>/backend` et `/frontend`), memes noms de services et de conteneurs (`forestmanager-*`, `forestmanager-dev-*` en preprod), meme alias `forestmanager-backend` vise par le nginx du front ;
  - memes stacks Portainer mises a jour par API (`deploy_prod.sh` : envsubst puis PUT de la stack), memes reseaux externes (`proxy` pour Traefik, `minio-net`), memes labels Traefik (entrypoint `https`, certresolver `cloudflare`, memes domaines) ;
  - meme declenchement : PR vers `master` = preprod, push sur `master` = prod, changelog et tag apres la prod.
- **Ameliorations prevues** : contexte de build monorepo (`docker/*.Dockerfile`), images taguees `sha-<court>` en plus de `latest` (B6), verification unique dans le conteneur de test (`docker/compose.test.yml`, identique en local et en CI), volume PostgreSQL neuf en 17 (remise a zero D23).
- **Consequence** : C1.10 ecrit le workflow complet et les compose preprod et prod dans `docker/`. D143 tient toujours : rien ne se deploie avant C7, puisque rien ne part vers `master` avant.

### D148 - Store de sessions maison et colonne `UserSession.userId` - VALIDEE (2026-11-05, realisation C1.5)

- **Constat** : changer de mot de passe doit fermer les autres sessions (F-ACC-4), la reinitialisation et la suppression du compte toutes ses sessions. Le schema cible ne reliait pas une session a son compte (donnees serialisees seulement), et la V1 dependait de `@quixo3/prisma-session-store`.
- **Choix** : store express-session ecrit dans `core/auth/session.ts` sur la table `UserSession`, avec une colonne `userId` indexee (sans cle etrangere : les sessions d'un compte sont supprimees explicitement). Purge horaire des sessions expirees. Schema cible mis a jour.

### D149 - Exclusion distinguee d'un depart : `Membership.excludedAt` - VALIDEE (2026-11-05, realisation C1.6)

- **Constat** : un membre exclu ne revient que par invitation directe, jamais par un lien (D07, D53) ; un membre parti de lui-meme peut revenir par un lien. Le schema cible n'avait que `leftAt` et ne permettait pas de les distinguer.
- **Choix** : colonne `excludedAt` sur `Membership`, renseignee a l'exclusion et effacee au retour. Au depart, le role revient a MEMBER et les propositions de transfert de propriete en cours qui le concernent sont annulees. Schema cible mis a jour.

### D150 - Invitation par username : meme reponse que le compte existe ou non - VALIDEE (2026-11-05, realisation C1.7)

- **Constat** : le parcours P02 affichait "Aucun compte avec ce nom" pour un username inconnu, ce qui permet de tester l'existence des comptes. Le plan C1.7 demande une reponse identique (D07, D50).
- **Choix** : `POST /spaces/:id/invitations` repond toujours 202 sans corps (compte inconnu, supprime, deja membre ou deja invite). Rate limit de 30 invitations par heure. La liste des invitations en attente de l'espace (moderateurs) ne montre que les invitations reelles : fuite residuelle acceptee, limitee par le rate limit et reservee aux moderateurs. P02 mis a jour : message neutre "Si ce compte existe, il recevra l'invitation".
- **Liens** : un code inconnu, expire, revoque, epuise ou d'un espace supprime repond pareil (SPACE_014). Rejoindre par un lien accepte l'invitation directe en attente pour le meme espace.

### D151 - TDD par defaut en phase C - VALIDEE (2026-11-05, demande du proprietaire)

- **Choix** : a partir de C1.8, chaque regle s'ecrit test d'abord (constate rouge), puis code, puis nettoyage. Exceptions : outillage, configuration, Docker, CI.

### D152 - Registre : statut initial declare par le manifeste, modules a venir declares - VALIDEE (2026-11-05, realisation C1.8)

- **Constat** : l'architecture (S3.2) ajoutait tout code nouveau en `COMING_SOON`, alors que le seed creait Recettes en `AVAILABLE`. Retirer du catalogue un code absent du registre aurait aussi retire Planning et Courses, qui n'ont pas encore de code.
- **Choix** : chaque manifeste API declare son entree de catalogue (`catalog.status` initial, `isDefault`, `sortOrder`). Le seed appelle `syncCatalog` : code nouveau -> statut declare ; code absent -> `RETIRED` (donnees conservees, D85) ; code revenu apres retrait -> statut declare. Le statut n'est jamais reecrit ensuite (il appartient au super admin). Planning et Courses ont des manifestes minimaux (`COMING_SOON`, aucune route). `alwaysOn` dans le contrat partage porte D91.
- **Reporte** : la surcharge du role minimal d'une permission `configurable` (D58) attend les reglages de module (C5) ; `requirePermission` applique le role par defaut du manifeste.

### D153 - Suppression du compte : heritier au plafond, anonymisation - VALIDEE (2026-11-05, realisation C1.9)

- **Heritier (D51)** : MODERATOR le plus ancien, sinon MEMBER le plus ancien, en sautant ceux qui possedent deja 20 espaces. Si tous sont au plafond, le premier herite quand meme : le plafond freine la creation abusive, il ne doit pas faire disparaitre l'espace de ses membres.
- **Anonymisation (D20)** : username `deleted-<id>` et email `deleted-<id>@invalid` (l'ancien username et l'ancien email redeviennent libres), mot de passe vide, jetons et sessions supprimes. Invitations, liens, transferts et demandes d'acces en cours a son nom sont annules. Espace perso supprime avec purge a la tache horaire suivante (les crochets des modules s'appliquent). Les espaces groupe deja supprimes qu'il possedait ne sont plus restaurables.

### D154 - Perimetre de C2 : ecrans du socle complets, sans notifications ni Recettes - VALIDEE (2026-11-05, plan C2)

- **Choix** : C2 livre l'outillage web, le design system en code, les themes, l'app shell, le registre web et tous les ecrans du socle branches sur l'API de C1, plus une coquille PWA. Notifications, Ctrl K et widgets complets en C6 ; persistance hors ligne et avatars en C3 ; E2E en C7. Detail : `18-Plan-C2.md`.

### D155 - Composants : le design system porte en TSX avec son CSS, comportements Radix - VALIDEE (2026-11-05, plan C2)

- **Constat** : le design system valide (B4) existe deja en composants React (`components/bundle.js`) et en CSS base sur les tokens (`bundle.css`), utilises par les maquettes. Repartir des primitives shadcn generiques obligerait a redessiner chaque composant pour retrouver ce rendu.
- **Choix** : porter ces composants en TSX types dans `apps/web/src/ui` et `patterns`, garder leur CSS, et confier les comportements accessibles a Radix (Dialog, DropdownMenu, Toast, Switch, RadioGroup). Tailwind 4 (theme lu dans les tokens) pour la mise en page des ecrans. C'est la demarche shadcn de D16 (code possede, Radix, Tailwind, tokens) appliquee au design system valide.

### D156 - Polices auto-hebergees - VALIDEE (2026-11-05, plan C2)

- **Choix** : Sora, Manrope et IBM Plex Mono servies par l'application (`@fontsource`), au lieu de Google Fonts : CSP stricte, aucune requete vers un tiers.

### D157 - Tests de composants : jsdom, MSW, reponses validees par les schemas partages - VALIDEE (2026-11-05, plan C2)

- **Choix** : Vitest + jsdom + Testing Library + MSW. Les reponses mockees sont construites par des fabriques et validees contre les schemas Zod du partage ; axe-core verifie les ecrans ; chaque composant est rendu dans les six themes.

### D158 - Taille du texte et densite cote application - VALIDEE (2026-11-05, realisation C2.3)

- **Constat** : le design system est en px et ne prevoit ni densite ni taille du texte, alors que le profil les propose (F-ACC-4, `textScale` 90 a 130 %, `density`).
- **Choix** : la taille du texte agrandit toute l'interface (`zoom` sur `body`, comme un zoom du navigateur : les requetes de conteneur s'adaptent) ; la densite compacte resserre les espacements (`--space-3` a `--space-6`) sans toucher aux cibles tactiles de 44px. Preferences posees sur `<html>` (`data-theme`, `data-density`, `--text-scale`), la teinte de l'espace aussi (`data-space`) pour que les portails (feuilles, menus) la recoivent.

### D159 - Hors ligne en C2 : ecritures refusees par le client, bandeau global - VALIDEE (2026-11-05, realisation C2.9)

- **Constat** : D106 demande des actions d'ecriture desactivees avec la raison quand on est hors ligne. En C2, aucune donnee n'est encore lisible hors ligne (la persistance TanStack Query arrive avec les recettes, C3).
- **Choix** : en C2, un bandeau global annonce le hors ligne et le client API refuse toute ecriture sans reseau (`OFFLINE`, message clair, aucune file d'attente conforme a D35). La desactivation bouton par bouton se fait en C3, avec la persistance hors ligne et le badge des cartes. Service worker : coquille en precache (polices latines seulement), mise a jour proposee par un bandeau, jamais de reponse de l'API en cache ; icone provisoire (un "F" ambre sur fond Braise) en attendant un logo.

### D160 - Referentiels minimaux livres avec les recettes (C3), gestion admin en C4 - VALIDEE (2026-11-05, plan C3)

- **Constat** : la roadmap place les referentiels en C4 avec l'admin, mais une recette ne s'ecrit pas sans unites ni ingredients.
- **Choix** : C3 livre les tables et le seed des unites, des rayons et des tags globaux, l'autocompletion et la creation a la volee des ingredients (D09), les tags d'espace et leur moderation par les moderateurs (D08). C4 ajoute la gestion par le super admin (fusion D120, traductions, poids par unite, ordre des rayons, tags globaux).

### D161 - C3 en tranches verticales - VALIDEE (2026-11-05, plan C3)

- **Choix** : chaque sous-etape de C3 livre l'API et les ecrans d'une meme fonction (au lieu de toute l'API puis tous les ecrans), pour montrer un resultat utilisable a chaque etape et valider le contrat partage au plus tot. Detail : `19-Plan-C3.md`.

### D162 - Plan C3 ecrit sans validation formelle - EN ATTENTE DE RELECTURE (2026-11-05)

- **Constat** : le proprietaire a demande de poursuivre C1, C2 et C3 sans questions pendant la session du 2026-11-05.
- **Choix** : le plan C3 est ecrit et suivi ; le proprietaire le relit a la prochaine session (perimetre, decoupage, D160, D161). Meme chose pour le plan C2 (D154 a D157), deja realise.

### D163 - Enregistrement d'une recette : verrou optimiste sur la revision - VALIDEE (2026-11-05, realisation C3.2)

- **Constat** : deux personnes peuvent modifier la meme recette en meme temps (auteur et moderateur, deux appareils). Sans controle, la seconde ecrase la premiere sans le savoir ; le bouton "Enregistrer la revision N" (D102) suppose deja de connaitre la revision de depart.
- **Choix** : la modification envoie la revision sur laquelle elle a ete faite ; si la recette a avance entre-temps, l'API refuse (`RECIPE_004`, 409) et l'editeur propose de recharger, le brouillon local (D104) restant sur l'appareil. Les revisions (instantane CREATE puis EDIT) sont ecrites des C3.2 ; C3.3 ajoute l'historique et la restauration.

### D164 - Liens de recettes composees : les liens deja presents survivent - VALIDEE (2026-11-05, realisation C3.4)

- **Constat** : une sous-recette peut etre supprimee, ou ne plus etre visible dans l'espace du plat (partage retire, C3.5). Si l'enregistrement exigeait que chaque lien soit visible, le plat ne serait plus modifiable sans retirer le lien, et une restauration (D55) echouerait.
- **Choix** : un **nouveau** lien doit viser une recette visible et non supprimee de l'espace ; un lien **deja present** dans la recette (ou dans la revision restauree) est garde tel quel. Le bloc s'affiche "Recette supprimee" ou "Recette non disponible" avec sa quantite. La quantite d'un lien garde son unite : si le rendement de la sous-recette change d'unite, elle est convertie dans la meme dimension, sinon le rapport direct des quantites s'applique (`linkFactor`). Supprimer une recette liee previent : "utilisee dans N recettes" (`usedBy`).
- **Reporte** : recuperer le contenu d'une sous-recette supprimee en bloc local (etude 6) ; "Demander le partage" sur un bloc non disponible (C3.5).

### D165 - Partage des recettes : regles de realisation - VALIDEE (2026-11-06, realisation C3.5)

- **Constat** : D03, D26, D81, D83 et D84 laissent des cas ouverts : origine d'une recette dont l'auteur n'existe plus, portee de la confiance, place des demandes sans notifications (C6), message de la maquette F-PARTAGER-Demande absent du schema, depart d'un membre alors que le socle ne connait pas les modules (D40).
- **Choix** (selecteur du 2026-11-05 pour les trois premiers points) :
  - **Purge de l'origine** : une recette partagee ailleurs, ou liee par une recette gardee, part dans l'espace perso de son auteur ; sans auteur, son **plus ancien espace de partage** devient son origine et ses moderateurs la gerent (D18). Les autres recettes de l'espace sont effacees.
  - **Demandes** : un **bandeau** "N demandes de partage" en tete de "Mes recettes" (espace perso : toutes celles de l'auteur) et de la liste d'un groupe (recettes nees dans ce groupe, pour ses moderateurs quand l'auteur est parti). Il ouvre F-DEMANDE-PARTAGE.
  - **Message** : "Un mot pour l'auteur", 280 caracteres, facultatif (`RecipeShareRequest.message`).
  - **Confiance** : elle porte sur l'espace ou le demandeur voit la recette (`sourceSpaceId`) ; le reglage se fait dans la feuille de la demande (D101) et tombe quand l'auteur quitte cet espace.
  - **Partage direct** par l'auteur (s'il est encore membre de l'origine) ou, auteur parti, par les MOD et OWNER de l'origine. L'auteur modifie, supprime et retire aussi depuis un espace de partage.
  - **Sous-recettes** (D26) : seules celles du meme auteur partent avec le plat ; retirer le plat retire celles partagees avec lui si aucune autre recette de l'espace ne les utilise.
  - **Depart** (D84) : le module Recettes fournit l'apercu (recettes creees ici, recettes perso partagees ici) ; l'ecran retire les partages choisis avant le depart. Rien n'est retire d'office, ni a l'exclusion.

### D166 - Adaptation et suggestions : regles de realisation - VALIDEE (2026-11-06, realisation C3.6)

- **Constat** : D04, D17, D105 et D140 laissent ouverts l'espace cible d'une adaptation, le mot du refus montre par la maquette E-SUGGESTION-Refusee (absent du schema), l'endroit ou le decideur trouve les suggestions avant les notifications (C6) et ce que voit un membre de l'espace de l'adaptation qui ne voit pas l'original.
- **Choix** (selecteur du 2026-11-06 pour les trois premiers points) :
  - **Cibles** : tout espace ou l'utilisateur peut creer une recette (module actif, `recipes.create`), y compris l'espace courant et l'espace perso : l'adaptation est la seule copie (D140).
  - **Refus** : un mot facultatif du decideur (280 caracteres, `RecipeSuggestion.decisionMessage`), montre au suggereur.
  - **Suggestions en attente** : bandeau "N suggestions a examiner" sur "Mes recettes" et la liste d'un groupe (comme D165), et bandeau sur le detail de la recette.
  - **Contenu adapte** : contenu de la revision actuelle de l'original, ses tags globaux (pas ses tags d'espace, D19), ses liens gardes meme non visibles dans l'espace cible (D164). Revision 1 `CREATE` a l'auteur de l'adaptation.
  - **Suggerer** : tout membre qui voit la recette sauf son auteur, moderateurs compris (12-Permissions) ; une seule suggestion en attente par personne et par recette (`RECIPE_013`, index partiel). Contenu complet propose, sans tags (non versionnes, D19).
  - **Accepter une suggestion basee sur une ancienne revision** : les parties changees par la suggestion (chaque champ, chaque bloc, ou tous les blocs si leur nombre differe) sont appliquees a la version actuelle ; une partie changee aussi depuis la base est signalee en conflit, et la suggestion l'emporte si on accepte. Revision `SUGGESTION` au nom du suggereur, verrou optimiste (D163).
  - **Annulation** : statut `CANCELLED` (ajoute au schema cible) quand le suggereur quitte ou est exclu de l'espace ou il a suggere.
  - **Transformer en adaptation** : seulement une suggestion refusee, par son auteur, vers un de ses espaces ; adaptation liee a la revision de depart de la suggestion.
  - **Comparer** : lisible par tout membre qui voit l'adaptation, meme sans voir l'original (l'adaptation en est deja une copie). L'API renvoie l'original a la revision vue, l'original actuel et l'adaptation ; les differences se calculent dans `packages/shared` (`diffContents`), partagees avec les suggestions. "Marquer comme vu" : qui peut modifier l'adaptation. Original supprime : plus de badge, comparaison avec la seule revision vue.

### D167 - Photos et avatars : stockage S3 - VALIDEE (2026-11-06, realisation C3.7)

- **Constat** : le plan C3 prevoit une URL presignee PUT de 60 s ; une URL PUT ne borne pas la taille du fichier. Q-ARCH-4 est tranche (liens signes de courte duree), mais un lien signe nouveau a chaque reponse empeche le navigateur de garder l'image en cache. Les images MinIO ne sont plus telechargeables publiquement (Docker Hub et quay.io refusent en 2026-11) : impossible d'en lancer une neuve en dev, en test ou en CI. La photo et les revisions (D13) ne sont pas reliees.
- **Choix** (selecteur du 2026-11-06 pour les trois premiers points) :
  - **Bucket** : celui de la V1 (`forestmanager-images-preprod` / `-prod`) rendu **prive** (lecture publique retiree a la main avant la mise en prod V2) ; les images V1 restantes ne sont plus lisibles.
  - **Photo hors revisions** : changer ou retirer la photo est immediat, sans revision ; restaurer une revision garde la photo actuelle ; une suggestion ne propose pas de photo ; une adaptation copie la photo de l'original. Droit : celui de modifier la recette.
  - **Envoi par POST signe** (60 s) au lieu de PUT : le stockage refuse un fichier de plus de 2 Mo ou qui n'est pas de type `image/*`. Le fichier arrive dans une zone d'attente `uploads/<userId>/<uploadId>`, puis l'API le verifie (signature, dimensions bornees : 2048 px pour une photo, 512 px pour un avatar) en l'attachant et le range a sa place avec le type lu dans le contenu.
  - **WebP, ou JPEG sur Safari** (ajout du 2026-11-06, realisation web) : le navigateur convertit en WebP quand il sait l'encoder ; Safari ne l'encode pas (le canvas rend du PNG), il envoie alors du JPEG. L'API accepte ces deux formats, verifies par leur contenu ; PNG refuse (trop lourd).
  - **Cles uniques par version** : `recipes/<recipeId>/<uuid>.webp` (ou `.jpg`), `users/<userId>/<uuid>.webp`, `spaces/<spaceId>/<uuid>.webp` ; l'ancienne image est effacee apres le changement.
  - **Lecture** : URL signee GET dont la date de signature est arrondie a l'heure (valable 2 h) : la meme URL pendant une heure, donc le cache du navigateur sert.
  - **Menage** par balayage horaire : les envois en attente de plus d'une heure, et tout objet que la base ne reference plus (compte supprime, espace purge, image remplacee) et vieux de plus d'une heure. Les recettes supprimees depuis plus de 30 jours perdent leur photo.
  - **Stockage facultatif** (comme les emails, D21) : sans variables `MINIO_*`, `features.uploads` vaut false et le front masque les choix de photo.
  - **Serveur de dev, de test et de CI : RustFS** (`rustfs/rustfs`, compatible S3, licence Apache 2). La preprod et la prod gardent le MinIO deja installe (D147). En dev, le bucket est servi par le proxy de Vite (meme origine, pas de CORS).

### D168 - Import de recettes : regles de realisation - VALIDEE (2026-11-06, realisation C3.8)

- **Constat** : le plan C3 fixe l'import par lien (JSON-LD, anti-SSRF) et par texte colle, sans dire ou vit l'analyse, ce que devient une recette importee avant relecture, ni quoi faire des unites absentes du referentiel.
- **Choix** :
  - **Analyse partagee** (`packages/shared/src/recipes/import.ts`) : lignes d'ingredients (unites francaises vers les codes du referentiel, dl converti en cl, "a gout" vers `to-taste`, detail apres la virgule en note), JSON-LD (`@graph`, tableaux, `mainEntity`, sections d'etapes, HTML et entites), texte colle. Le texte est analyse sur l'appareil, sans appel a l'API ; seule la lecture d'une page passe par l'API.
  - **Rien n'est enregistre a l'import** : l'API renvoie la recette lue, l'editeur s'ouvre pre-rempli (bandeau "Recette importee", nombre de quantites a verifier) ; l'enregistrement cree la revision 1 de source `IMPORT`.
  - **Anti-SSRF** (`apps/api/src/core/net/page-fetcher.ts`) : http et https seulement, 5 redirections, a chaque saut toutes les adresses du nom doivent etre publiques (privees, locales, partagees, link-local, metadata, reservees, multicast, IPv6 locales et mappees refusees) et la connexion se fait sur l'adresse verifiee (pas de rebinding DNS) ; 10 s au total, 3 Mo apres decompression ; 20 imports par 15 min.
  - **Unite inconnue** (pot, brin, feuille...) : le mot reste dans le nom de l'ingredient, a corriger a la relecture.
  - **Reporte** : photo de la page importee (lecture d'image distante, a voir avec le menage du stockage).

### D169 - Hors ligne : cache persistant limite et relu par schema - VALIDEE (2026-11-06, realisation C3.9)

- **Constat** : D35 et D106 demandent les recettes deja ouvertes lisibles sans reseau, sans dire quoi garder sur l'appareil ni comment survivre a une nouvelle version de l'application.
- **Choix** :
  - **Ce qui est garde** (IndexedDB, 14 jours) : session, configuration, espaces, unites et le detail de chaque recette ouverte. Pas les listes (filtrees et paginees), ni l'historique, ni les recherches : hors ligne, la liste d'un espace montre les recettes ouvertes sur l'appareil ("Disponibles hors ligne : N recettes ouvertes recemment", badge "Hors ligne"), filtrees sur place.
  - **Relecture par schema** : chaque donnee relue repasse par son schema Zod ; une forme perimee est ecartee, sans numero de version a tenir a jour.
  - **Vidage** : deconnexion, connexion et suppression du compte vident le client, donc l'appareil.
  - **Ecritures** : desactivees, pas masquees, et reliees au bandeau qui donne la raison (`useWriteGuard`, `aria-describedby`) ; menu du detail desactive en entier ; le client API les refuse de toute facon (D159). Mode cuisine disponible hors ligne.

### D170 - Administration dans la meme SPA, sous /admin, chargee a part - VALIDEE (2026-11-06, plan C4)

- **Constat** : les maquettes A01 a A13 decrivent une interface admin a part entiere ; elle peut vivre dans `apps/web` ou dans une application separee.
- **Options** : meme SPA avec des routes `/admin` chargees dans un bundle separe ; workspace `apps/admin` avec son build et son image.
- **Choix** : meme SPA (comme la V1), routes `/admin` chargees a la demande, shell AdminNav, session admin dans un cookie distinct. Un seul build, un seul nginx, design system reutilise directement ; l'isolation est portee par l'API (session et `requireAdmin`), pas par le deploiement.

### D171 - Changelog en C6 - VALIDEE (2026-11-06, plan C4)

- **Choix** : l'ecran admin A10, la page utilisateur et la generation par la CI restent en C6 comme le prevoit la roadmap. C4 n'affiche pas d'entree "Changelog" dans la navigation admin.

### D172 - Acces de moderation : audit en C4, OWNER prevenu en C6 - VALIDEE (2026-11-06, plan C4)

- **Constat** : D121 demande que l'OWNER soit informe, avec le motif, quand un admin ouvre son espace ; les notifications n'existent qu'a partir de C6.
- **Options** : audit seul en C4 et notification en C6 ; bandeau provisoire dans l'espace en C4.
- **Choix** : C4 enregistre l'acces et son motif dans le journal d'audit et pose un point d'accroche ; C6 y branche la notification. Une case sous C6 dans la roadmap evite l'oubli.

### D173 - C4 en tranches verticales - VALIDEE (2026-11-06, plan C4)

- **Choix** : comme C3 (D161), chaque sous-etape de C4 livre l'API et les ecrans d'une meme fonction : compte admin et shell, modules, referentiels, utilisateurs, espaces et moderation, journal et reglages. Detail : `20-Plan-C4.md`.

### D174 - Connexion admin : regles de realisation - VALIDEE (2026-11-06, realisation C4.1)

- **Constat** : le CDC et `14-Architecture.md` fixent une session admin isolee de 30 min non glissante avec 2FA TOTP, sans dire comment l'isoler de la session des utilisateurs, ni comment traiter le rejeu d'un code ou la creation du premier compte.
- **Choix** :
  - **Session isolee** : routeur `/api/v1/admin` monte avant la session des utilisateurs, cookie `fm.admin.sid` (httpOnly, SameSite strict, chemin `/api/v1/admin`), table `AdminSession`. Un compte utilisateur n'ouvre rien cote admin, et l'inverse. L'etape mot de passe ouvre une session d'attente de 5 min ; le code valide ouvre une session neuve de 30 min que les requetes ne prolongent jamais.
  - **Code TOTP** : tolerance d'un pas (30 s) ; un code deja accepte est refuse (`AdminUser.totpLastStep`, ecrit sous condition en SQL) ; 3 codes faux ferment la tentative (retour au mot de passe). Rate limit : 5 mots de passe et 10 codes par 15 min.
  - **Audit** : connexions (`auth.login`, `auth.totp-enabled`, `auth.totp-failed`, `auth.totp-locked`, `auth.logout`) avec l'IP. La categorie d'une entree se deduit du prefixe de l'action (`auditCategory` dans `packages/shared`) ; une action sans categorie est refusee. Trigger en base qui refuse UPDATE et DELETE sur `AdminAuditLog` [D128].
  - **Premier compte** : script `apps/api/src/scripts/create-admin.ts` (`npm run admin:create`), dans `src/` pour etre present dans l'image de prod ; meme politique de mot de passe que les utilisateurs, argon2id.

### D175 - Modules cote admin : regles de realisation - VALIDEE (2026-11-06, realisation C4.2)

- **Constat** : le plan C4 fixe la file des demandes et le catalogue, sans dire ce que deviennent une demande en attente quand l'admin accorde d'office, ni l'etat "active" d'un module retire puis rendu.
- **Choix** :
  - **Accorder** (demande ou d'office) : l'acces est rendu sans activer le module ; l'OWNER l'active. Accorder d'office accepte la demande en attente du meme espace.
  - **Retirer** : `revokedAt` seulement ; le choix "active" de l'OWNER est garde et revient avec l'acces (D85).
  - **Module par defaut** (Recettes) : ni statut modifiable, ni acces retirable (`ADMIN_007`).
  - **Refus** : motif obligatoire (500 caracteres), lu par l'OWNER dans les modules de son espace ; la notification viendra en C6 (D172). Une demande deja traitee ou annulee repond `ADMIN_006`.
  - **Recherche d'espace** pour accorder : `GET /admin/spaces/lookup` (espaces groupe actifs, nom et OWNER, 10 resultats), reprise par la liste des espaces en C4.5.

### D176 - Referentiels cote admin : regles de realisation - VALIDEE (2026-11-09, realisation C4.3)

- **Constat** : le plan C4 fixe les ecrans A05 a A08 et la fusion D120, sans dire ce que garde la cible d'une fusion, quand un nouveau est un "doublon probable", ni comment renommer un tag global sans que le seed le recree.
- **Choix** :
  - **Doublon probable** : nouvel ingredient dont le nom francais ressemble (pg_trgm, similarite >= 0,45) a celui d'un ingredient verifie. Le detail propose les 5 ingredients les plus proches comme cibles de fusion, plus une recherche.
  - **Fusion d'ingredients** : la cible garde ses propres attributs (rien n'est copie du fusionne : rayon, unite, poids, anglais) ; les synonymes du fusionne passent a la cible (un seul niveau de synonymes). La recherche de l'admin trouve un ingredient par ses synonymes.
  - **Ajout par l'admin** : l'ingredient est cree verifie (ACTIVE). "Marquer comme verifie" enregistre le formulaire et verifie dans le meme appel.
  - **Poids par unite** (D46) : seulement pour les unites de pieces (COUNT) ; masses et volumes se convertissent deja. Un champ par unite de pieces, vide = pas de poids.
  - **Codes stables** : le code d'une unite, d'un rayon (tire du nom a la creation) et le slug d'un tag global ne changent plus ; renommer ne touche que les noms. Le seed retrouve donc tout et ne recree ni un tag renomme ni un tag supprime.
  - **Tags globaux** : nom unique sans casse ni accents parmi les tags vivants (`ADMIN_009`) ; fusionner deplace les recettes et masque le tag (`mergedIntoId`, `deletedAt`) ; supprimer le retire de toutes les recettes.
  - **Rayons** : l'ordre s'enregistre en entier (`PUT /admin/aisles/order`, chaque rayon une fois, `ADMIN_012`) ; les boutons Monter / Descendre l'envoient.
  - **Testeur d'addition** (A06) : `addQuantities` de `packages/shared/src/units/` (masses et volumes par la base puis unite la plus lisible, pieces en grammes avec le poids de l'ingredient, sinon une ligne par unite), le calcul que reprendra la liste de courses.

### D177 - Comptes cote admin et mot de passe temporaire : regles de realisation - VALIDEE (2026-11-09, realisation C4.4)

- **Constat** : D134 fixe le principe (24 h, usage unique, l'ancien reste valable, autres sessions fermees ensuite) et le schema la session restreinte, sans dire comment elle est restreinte, ni la forme du mot de passe.
- **Choix** :
  - **Forme** : trois mots courts sans accents et quatre chiffres (`tison-7342-cendre-houx`, environ 31 bits), facile a dicter ; seul son hash argon2id est garde (`AuthToken.tokenHash`). Un nouveau temporaire remplace celui qui n'a pas servi. La reponse n'est jamais mise en cache (`no-store`).
  - **Connexion** : le mot de passe habituel est essaye d'abord, puis les temporaires valables du compte. Le temporaire ouvre une session courte (pas de "rester connecte") marquee `passwordChoice` : `requireAuth` repond `AUTH_011` partout ; seuls `GET /me` (avec `mustChoosePassword: true`), `POST /auth/choose-password` et la deconnexion passent.
  - **Choix du mot de passe** : meme politique que l'inscription ; le temporaire est consomme (`usedAt`) dans la meme transaction que le nouveau hash, les autres sessions sont fermees et la session courante tourne (nouvel identifiant). Temporaire expire entre-temps : `AUTH_014`, la session restreinte est fermee et l'ecran revient a la connexion.
  - **Web** : `PasswordChoiceGate` n'affiche que "Choisis ton mot de passe" tant que `mustChoosePassword` (hors `/admin`).
  - **Liste A12** : comptes non supprimes, par derniere connexion ; espaces groupe dont le compte est membre actif ; filtres "OWNER d'un espace" (groupe) et "Inactifs depuis 6 mois" (derniere connexion, ou inscription si jamais connecte) ; pagination admin plafonnee a 100, au-dela on affine la recherche. Le rappel "E-mails non configures" vient de `GET /config`.

### D178 - Moderation : acces en table dediee, recette masquee visible de son auteur - VALIDEE (2026-11-09, realisation C4.5, choix du proprietaire)

- **Constat** : le plan C4 laissait deux points a trancher : la forme de l'acces de moderation en base et l'etat "masquee" d'une recette (absent du schema cible).
- **Options** : acces dans une table dediee ou dans la session admin ; recette masquee visible de son auteur avec le motif, cachee pour tous, ou pas d'etat masque.
- **Choix** (recommandations retenues) :
  - **Acces** : table `ModerationAccess` (admin, espace, motif parmi 4, precision obligatoire, ouverture, expiration a 30 min). Chaque route de moderation exige un acces valable de cet admin a cet espace non supprime (`ADMIN_013`) ; "Fermer l'acces" l'expire tout de suite. C6 y branchera la notification de l'OWNER (D172).
  - **Masquer** : `Recipe.hiddenAt` et `hiddenReason`. La recette disparait des listes et du detail pour tous les membres, sauf son auteur qui la voit avec le bandeau "Masquee par la moderation" et le motif. L'admin peut la reafficher (audit `recipe.unhidden`).
  - **Autres actions**, motif obligatoire et audit : retirer d'un espace de partage (la recette reste chez son auteur ; refuse dans l'espace d'origine, `ADMIN_014`), supprimer une recette (comme la suppression par l'auteur), supprimer un espace groupe (suppression masquee de 30 jours, D22 ; l'espace perso ne se supprime pas). La vue de moderation lit les recettes en lecture seule, masquees comprises.
  - **Restaurer** un espace en suppression depuis la liste, a la demande de l'OWNER, avant la purge (`ADMIN_015` sinon).

### D179 - Journal, reglages et tableau de bord admin : regles de realisation - VALIDEE (2026-11-09, realisation C4.6)

- **Constat** : D128, D129 et D135 fixent les ecrans A11, A02 et A13 ; le SDK Sentry (D75) n'est pas encore dans le code, et le plan ne dit pas si tester un service s'audite.
- **Choix** :
  - **Journal** : du plus recent au plus ancien, filtre par categorie (prefixe de l'action, `auditPrefixes`), pagination par offset avec "Voir les plus anciennes". Libelles, cible et detail des actions calcules cote web (`core/admin/format.ts`) depuis les donnees de l'entree.
  - **Reglages** : lus des variables d'environnement, jamais de secret (adresse SMTP sans identifiants, cles de stockage nommees mais masquees). Tester l'e-mail envoie un message a l'adresse de l'admin ; tester le stockage ecrit, relit et supprime un petit objet. Un test ne modifie rien : pas d'entree d'audit. Le suivi d'erreurs est affiche "Pas encore branche" ; son branchement (SDK Sentry front et back, DSN Bugsink, test depuis A13) est ajoute a C7.
  - **Tableau de bord** : "A traiter" = demandes de modules, nouveaux ingredients (et jusqu'a 3 doublons probables), espaces en suppression ; chiffres de la plateforme ; etat des services ; version (package.json racine) ; 5 dernieres actions. A02m est le meme ecran en mobile.

## Phase C5 - plan du module Planning (2026-11-09)

Revue du module avant le plan (CDC S4.6, P10, matrice B2, schema cible, maquettes du canevas Planning, specs V1 `SPEC_MEAL_PLAN.md` et `SPEC_MEAL_GENERATION.md`). Les quatre points a trancher l'ont ete par le proprietaire, recommandations retenues.

### D180 - Planning en calendrier continu, sans planning date ni archives - VALIDEE (2026-11-09, plan C5, choix du proprietaire)

- **Constat** : le modele V1 (un planning actif a dates libres cree par un moderateur, les anciens archives) oblige a creer un planning chaque semaine, bloque un MEMBER tant qu'aucun planning n'existe (alors que D58 donne la main aux membres), redemande dans F-CREER-PLANNING les repas et portions deja dans `MealPlanSettings`, et demande des regles de chevauchement, un index "un seul actif" et un cooldown "inter-plannings" qui lit l'archive precedente. Ajouter un repas dans les reglages laisse le planning en cours sans ces cases.
- **Options** : calendrier continu par espace ; plannings dates et archives comme la V1.
- **Choix** : calendrier continu. Les repas sont ranges par espace et par date (`MealSlot (spaceId, date, mealTime)`), sans entite `MealPlan`. On navigue de semaine en semaine ; le passe tient lieu d'archives (lecture et modification avec les memes droits). La generation porte sur une periode choisie (31 jours au plus). Les cooldowns lisent les repas deja places autour de la periode, la frequence "par semaine" suit les semaines du calendrier (`weekStartsOn`). La future liste de courses prendra aussi une periode.
- **Consequences** : F-CREER-PLANNING, les archives et `MealPlanStatus` disparaissent ; E-PLANNING-vide montre la semaine vide avec "Touche un repas pour le remplir" et "Generer". Les reglages du planning (repas de la journee, portions, debut de semaine, role minimal) vivent dans une feuille de reglages du module.

### D181 - Un etat "Pas de repas" remplace le drapeau disabled - VALIDEE (2026-11-09, plan C5, choix du proprietaire)

- **Constat** : trois facons de dire "pas de repas ici" : `disabled` sur la case, l'exclusion du profil et un repas vide verrouille.
- **Choix** : un repas est vide (pas de ligne), recette, texte libre ou "Pas de repas" (`SKIPPED`, la generation le saute). Les exclusions du profil restent pour ce qui revient chaque semaine. Plus de drapeau `disabled`, plus de repas vide verrouille : le verrou ne porte que sur une recette ou un texte.

### D182 - Idee de repas en texte libre, retiree a la conversion - VALIDEE (2026-11-09, plan C5, choix du proprietaire)

- **Constat** : `MealIdea` avait deux liens vers une recette (`recipeId`, `convertedRecipeId`) ; une idee liee a une recette existante doublait le poids de cette recette au tirage.
- **Choix** : une idee est un nom et un commentaire. "Transformer en recette" ouvre l'editeur pre-rempli (D133) ; une fois la recette enregistree, l'idee est retiree (soft delete). A la generation, une idee tiree donne un repas en texte libre (poids 1, aucune regle de tag ne s'y applique, comme la V1). La mention "Liee a ..." de la maquette E-IDEES disparait.

### D183 - Profil de generation "Standard" cree d'office - VALIDEE (2026-11-09, plan C5, choix du proprietaire)

- **Choix** : chaque espace a toujours exactement un profil par defaut. Un profil "Standard" sans regle (delai de 3 jours, idees incluses) est cree au premier acces au planning de l'espace s'il n'en a aucun. Supprimer le profil par defaut demande d'en designer un autre ; le dernier profil ne se supprime pas. "Generer" et "Proposer un autre repas" marchent des le premier jour.

### D184 - Planning : regles de realisation fixees au plan - VALIDEE (2026-11-09, plan C5, defauts annonces au proprietaire)

- **Tags fusionnes ou supprimes** : la fusion d'un tag le masque (`mergedIntoId`, `deletedAt`) sans cascade. Regles et epinglages sont resolus a la lecture : un tag fusionne suit sa cible, un tag supprime rend la regle inactive, affichee "Tag supprime" dans le profil. Pas de crochet entre modules.
- **Recette devenue invisible** (retiree du partage, supprimee, masquee par la moderation) : le repas reste et s'affiche en texte avec le dernier titre connu (garde dans `MealSlot.text` a chaque choix de recette) ; la generation ne la propose plus.
- **Pool de la generation** : recettes visibles dans l'espace (origine ou partagees, F-MPL-5), non supprimees, non masquees, jamais une recette de base (D24) ; tags pris en compte : globaux et tags de cet espace (D19) ; idees si le profil les inclut.
- **Garder ce planning** (D110) sans etat serveur : l'apercu renvoie la proposition et l'etat de chaque case au moment du tirage ; a l'enregistrement, une case modifiee entre-temps par un membre n'est pas ecrasee et le resultat la signale.
- **Echange** (D69, D112) : tout le contenu change de case, verrou compris (le verrou suit le repas). Echanger avec une case vide revient a deplacer le repas.
- **Poids** (complete par le proprietaire) : par defaut cinq paliers (Jamais x0, Moins souvent x0,5, Normal x1, Plus souvent x1,5, Beaucoup plus x2), valeurs deja montrees par les maquettes. Un mode "Avance" dans la regle ouvre une jauge de 0 a 200 % par pas de 5 % pour un reglage fin. En base, un nombre de 0 a 2 ; une regle dont le poids n'est pas un palier s'affiche en pourcentage et s'ouvre en mode avance. Les poids se multiplient comme en V1.
- **Algorithme** : celui de la V1 (passe principale, rattrapage des minimums, rapport), avec une graine aleatoire injectable pour des tests deterministes ; ordre de priorite des contraintes V1 conserve ; la generation ne refuse jamais, elle explique chaque case laissee vide (D113).
- **Temps reel** : pas de socket en C5 ; relecture au retour sur l'onglet et en tirant l'ecran (P10). La salle `space:<id>` arrive avec C6.
- **Services entre modules** (`14-Architecture.md`, `provides` / `requires`) : Recettes fournit le catalogue des recettes visibles d'un espace (recherche et generation) ; le Planning fournit les compteurs D39 ("planifiee N fois", "derniere fois le ..."), que Recettes affiche seulement si le module est present et actif.
- **Droits** (D58, F-MPL-3) : modifier, echanger, verrouiller, remplacer un repas = role minimal `editRole` ; le role minimal se regle par l'OWNER seul ; les autres reglages, les profils et la generation : MODERATOR et OWNER.
- **Catalogue** : le statut d'un module n'est ecrit qu'a la creation de sa ligne (D175) ; sur une base existante, passer le Planning de "Bientot" a "Disponible" se fait dans A04.

### D185 - C5 en tranches verticales - VALIDEE (2026-11-09, plan C5)

- **Choix** : comme C3 et C4, chaque sous-etape livre l'API, le partage et les ecrans d'une meme fonction. Detail : `21-Plan-C5.md`.
