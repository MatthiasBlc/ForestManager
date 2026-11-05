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
