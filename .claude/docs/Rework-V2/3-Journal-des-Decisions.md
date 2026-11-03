# Journal des decisions - Rework V2

Le CDC porte la conclusion, ce journal porte le debat. On l'ouvre quand une regle parait arbitraire : chercher son `D##`, lire l'entree, pas le fichier entier.

Statuts : **PROPOSEE** (par Claude, en attente) | **VALIDEE** | **REJETEE** | **AMENDEE** (renvoie a la nouvelle decision).
Une decision validee ne se modifie pas : on en ajoute une nouvelle qui l'amende.

---

### D01 - Strategie : reecrire le front, refondre le back par module, dans le meme depot - PROPOSEE

- **Constat** : le code V1 est plutot propre (validation Zod, ~1550 tests, securite soignee). Ce qui ne va pas, c'est le modele metier (recettes dupliquees et synchronisees, roles incomplets, moderation qui bloque) et l'interface (daisyUI brut, pages mobiles a part, pas de cache de donnees).
- **Options** : (A) faire evoluer la V1 feature par feature ; (B) reecrire tout from scratch dans un nouveau depot ; (C) reecriture du front + refonte du back par module + migration de donnees unique.
- **Choix propose** : C. Le domaine recettes change trop pour A (chaque etape devrait rester compatible avec un modele que l'on veut supprimer). B jette l'infra, l'admin, la securite, l'import et l'algorithme de generation, qui sont bons.
- **Consequence** : un gel fonctionnel de la V1 pendant le chantier ; la V2 sort en une fois, avec une migration repetee sur une copie de la prod.

### D02 - L'espace personnel est un espace (`Space.kind = PERSONAL`) - VALIDEE (2026-11-03)

- **Constat V1** : "perso" = `communityId: null`. Toute la logique est dupliquee (routes `/recipes` et `/communities/:id/recipes`, regles d'acces separees) et les modules (planning) n'existent pas en perso.
- **Choix** : un seul modele d'espace, perso et groupe ; les modules marchent partout. Question liee : Q01.

### D03 - Une recette, une source de verite ; partage par reference - AMENDEE par D17

- **Constat V1** : creer une recette dans une communaute cree 2 recettes (perso + copie, `communityRecipeService.ts:47`) ; publier en cree N ; `syncLinkedRecipes` (`recipeService.ts:303`) recopie titre, etapes et ingredients mais pas les tags ni la suppression. Les forks et variantes ne sont pas synchronises. Resultat : l'utilisateur voit sa recette en double et ne sait pas laquelle il modifie.
- **Choix** : la recette vit dans son espace d'origine ; elle est **partagee** (reference) dans d'autres espaces ; la **copie** est un geste explicite qui cree une recette independante.

### D04 - Suggestions : refuser ne cree rien - PROPOSEE

- **Constat V1** : refuser une proposition cree automatiquement une variante au nom du proposeur (`proposalService.ts:277`). Le depart du createur fait auto-refuser ses propositions, donc cree des variantes en cascade (`orphanHandling.ts`). Seul le createur peut trancher (`proposals.ts:354`) : une recette dont l'auteur est parti accepte encore des propositions que personne ne pourra jamais traiter.
- **Choix** : accepter -> nouvelle revision ; refuser -> rien ; le suggereur peut convertir en copie s'il le veut. Si l'auteur n'est plus membre, les moderateurs tranchent.

### D05 - Historique par revisions - PROPOSEE

- **Constat V1** : aucun historique ; une proposition acceptee ecrase la recette.
- **Choix** : chaque modification cree une `RecipeRevision`. Permet diff, restauration, suggestions basees sur une revision precise. Format : Q12.

### D06 - Roles OWNER / MODERATOR / MEMBER - PROPOSEE

- **Constat V1** : pas de retrogradation, un moderateur ne peut pas en exclure un autre (`members.ts:251`), aucun moderateur ne peut supprimer une recette d'un membre (`membershipService.ts:57`), on ne peut pas supprimer une communaute sauf en etant le dernier a partir.
- **Choix** : matrice du CDC S3.1, un OWNER unique, transfert de propriete.

### D07 - Invitations par lien - PROPOSEE

- **Constat V1** : il faut connaitre le username exact ; `GET /api/users/search` permet a tout user connecte de lister les usernames par prefixe.
- **Choix** : lien d'invitation (expiration, nombre d'usages, revocable) + invitation par username exact sans autocompletion globale.

### D08 - Tags d'espace libres, moderes a posteriori - PROPOSEE

- **Constat V1** : un tag d'espace cree par un membre est PENDING jusqu'a validation d'un moderateur ; suggestions de tags a deux niveaux (PENDING_OWNER puis PENDING_MODERATOR) ; resolution de tags a chaque fork. Beaucoup de code (tagService, tagSuggestions, communityTags) pour un geste simple.
- **Choix** : creation libre, gestion a posteriori par les moderateurs (renommer, fusionner, supprimer). Question liee : Q04, Q08.

### D09 - Ingredients utilisables immediatement - PROPOSEE

- **Constat V1** : un nouvel ingredient est PENDING et attend l'admin plateforme.
- **Choix** : creation immediate, l'admin fusionne les doublons a posteriori.

### D10 - Modules declares, activables par l'OWNER - PROPOSEE

- **Constat V1** : `Feature` / `CommunityFeature` n'est accorde que par le SuperAdmin ; le planning est le seul module gate (`requireFeature("MEAL_PLAN")`) ; le front cable chaque page en dur.
- **Choix** : registre de modules (code, routes, nav, permissions, notifications, widgets). La plateforme dit quels modules sont disponibles ; l'OWNER les active dans son espace.

### D13 - Sessions : 1 jour glissant, 30 jours avec "rester connecte" - PROPOSEE

- **Constat V1** : 1 h glissante. Sur mobile, on est deconnecte a chaque utilisation espacee.

### D15 - Monorepo avec package partage - PROPOSEE

- **Constat V1** : types et regles dupliques entre `backend/src/schemas` et `frontend/src/models` ; `frontend/src/network/api.ts` fait 739 lignes.
- **Choix** : `packages/shared` (Zod, types, codes erreur, permissions) importe par l'API et le front.

### D16 - Design system shadcn/ui + Tailwind v4, tokens et accent par espace - PROPOSEE

- **Constat V1** : daisyUI (themes `coffee` / `winter`), classes `forest-accent` utilisees mais definies nulle part (`routes/adminRoutes.tsx`), composants mobiles separes, 3 jeux d'icones possibles via react-icons.
- **Choix** : CDC S5.3.

_D11, D12 et D14 sont reserves (planning, notifications, analytics) : a ecrire quand les questions Q10 et suivantes seront tranchees._

### D17 - Adapter une recette a un espace sans toucher l'original - VALIDEE (2026-11-03), perimetre allege

- **Constat** : remarque du proprietaire (exemple creme / beurre). En V1, une proposition acceptee sur une recette publiee se propage a tous les espaces (`proposalService.ts:160-215`). D03 seul (partage par reference) ne permet pas a un espace d'adapter une recette.
- **Etude** : `5-Etude-Adaptations.md` (options O1 a O4).
- **Choix valide** : adaptation liee. Deux gestes : **partager** (meme recette) ou **adapter** (copie liee a l'original et a sa revision de depart).
- **Perimetre V2.0 (allege)** : badge "l'original a change depuis votre adaptation" + ecran "Comparer avec l'original" en lecture seule. Pas de reprise ligne a ligne ni de remontee automatique : on reporte a la main, et on peut faire une suggestion classique a l'original.
- **Pourquoi allege** : le besoin de depart (B adapte sans toucher A) ne demande qu'une copie liee. La reprise ligne a ligne exige des identifiants stables par ligne et une fusion a trois sources, pour un cas rare (une recette de famille change peu). Le modele de donnees est le meme : la version complete pourra venir sans migration.

### D18 - Recette d'un auteur parti : reprise par les moderateurs - VALIDEE (2026-11-03)

- La recette reste visible dans l'espace, l'auteur est affiche "ancien membre". Les moderateurs peuvent la modifier, trancher ses suggestions ou la retirer.

### D19 - Tags propres a chaque espace - VALIDEE (2026-11-03)

- Les tags d'espace sont attaches a la recette **dans** un espace : une meme recette partagee peut etre taguee differemment dans chaque espace. Les tags globaux (vegetarien, dessert...) restent communs a la recette.
