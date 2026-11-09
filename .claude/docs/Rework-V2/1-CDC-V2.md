# Forest Manager V2 - Cahier des charges

**Version : 1.2 (1.0 validee par le proprietaire le 2026-11-05, feu vert pour coder ; 1.1 : module Planning revu au plan C5, D180 a D184, D11 amendee : midi et soir seulement ; 1.2 : plan C6, D187 a D189 : changelog en brouillon embarque, temps reel en SSE) ; decisions D01 a D142 reportees, D41 a D79 par renvoi aux documents de conception** - 2026-11-09
Statut de chaque decision : voir `3-Journal-des-Decisions.md`. Une ligne marquee `[Dxx]` renvoie a sa decision.
Les questions de la phase A sont au S10 (toutes repondues). Tant qu'une question touche une section, cette section n'est pas validable.

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
5. **Modulaire de bout en bout** : un module se declare (back + front + nav + permissions) au lieu d'etre cable en dur [D10]. Recettes est fourni a tous ; les autres modules sont accordes par la plateforme a la demande de l'OWNER [D33].
6. **Ergonomie la plus propre, optimisee et simple possible** : le moins d'ecrans et de gestes possible pour chaque tache, un seul chemin evident par action, pas d'option sans usage reel. Chaque maquette est jugee sur ce critere.

## 2. Glossaire

| Terme          | Definition V2                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Espace (Space) | Conteneur de contenu et de membres. Type `PERSONAL` (1 par user, 1 seul membre) ou `GROUP` ("communaute" a l'ecran).                        |
| Membre         | Lien user <-> espace avec un role (S3).                                                                                                     |
| Module         | Brique fonctionnelle (Recettes, Planning, Courses...). Accordee a un espace par la plateforme, puis activee par l'OWNER [D33].              |
| Recette        | Contenu cree par un auteur, rattache a un espace d'origine.                                                                                 |
| Partage        | Rendre une recette visible dans un autre espace **par reference** (pas de copie) [D03].                                                     |
| Adaptation     | Copie d'une recette dans un espace, liee a l'original ; modifiable sans toucher l'original [D17]. Seule facon de copier une recette [D140]. |
| Revision       | Etat date d'une recette. Chaque modification acceptee cree une revision [D05].                                                              |
| Suggestion     | Modification proposee par un membre sur une recette dont il n'est pas l'auteur [D04].                                                       |
| Referentiels   | Tags, ingredients, unites. Partages par toute la plateforme ou propres a un espace.                                                         |

## 3. Acteurs et roles

### 3.1 Roles dans un espace GROUP [D06]

| Action                                                  | MEMBER | MODERATOR | OWNER |
| ------------------------------------------------------- | :----: | :-------: | :---: |
| Voir le contenu, ajouter des recettes                   |   x    |     x     |   x   |
| Suggerer une modification                               |   x    |     x     |   x   |
| Modifier / retirer **sa** recette                       |   x    |     x     |   x   |
| Modifier / retirer la recette d'un autre [D57]          |        |     x     |   x   |
| Trancher une suggestion si l'auteur est parti           |        |     x     |   x   |
| Gerer les tags de l'espace                              |        |     x     |   x   |
| Inviter, exclure un MEMBER                              |        |     x     |   x   |
| Exclure un moderateur [D53]                             |        |           |   x   |
| Promouvoir / retrograder un moderateur [D53]            |        |           |   x   |
| Demander l'acces a un module, l'activer / le desactiver |        |           |   x   |
| Renommer, changer l'avatar                              |        |     x     |   x   |
| Supprimer l'espace, transferer la propriete             |        |           |   x   |

Regles :

- Un espace GROUP a toujours **exactement un OWNER**. Il ne peut pas partir sans transferer la propriete (ou supprimer l'espace).
- Le dernier membre qui part supprime l'espace (soft delete) apres confirmation explicite.
- Modifier la recette d'un autre : MOD et OWNER de l'espace d'origine ; dans un espace ou elle est seulement partagee, ils peuvent seulement la retirer [D57].
- Un moderateur n'exclut jamais un autre moderateur [D53].
- Les droits des modules (ex : qui peut editer le planning) se reglent par module, sur la base de ces 3 roles.

### 3.2 Espace PERSONAL

Un seul membre, OWNER. Pas d'invitation, pas de suggestions. Les modules qui ont du sens en solo (planning, courses) s'y demandent et s'y activent comme dans un groupe [D33].

### 3.3 Administration plateforme

`AdminUser` reste isole (session dediee, 2FA TOTP, audit log). Il gere : referentiels globaux, catalogue des modules, moderation de dernier recours (recettes, espaces), changelog. Il ne modifie jamais une recette : lecture et actions de moderation seulement [D52][D122][D142]. Il **n'est plus** un passage oblige pour qu'un user utilise un tag ou un ingredient [D08][D09]. Il **accorde les modules** aux espaces, sur demande de leur OWNER ou de sa propre initiative [D33].

## 4. Perimetre fonctionnel

Identifiants `F-<module>-<n>` pour que roadmap et tests s'y referent.

### 4.1 Comptes

- F-ACC-1 Inscription email + username + mot de passe. Verification de l'email si un SMTP est configure [D21] ; elle ne bloque rien (on peut rejoindre un espace sans email verifie), un rappel arrive par notification [D90].
- F-ACC-2 Connexion avec option "rester connecte" (30 jours). Sans l'option : session 1 jour glissante [D13].
- F-ACC-3 Mot de passe oublie par email si un SMTP est configure ; sinon reinitialisation par un admin [D21] : mot de passe temporaire de 24 h a usage unique, transmis par l'admin lui-meme, a changer a la connexion ; l'ancien reste valable tant que le temporaire n'a pas servi, puis les autres sessions sont fermees [D134]. L'app demarre et fonctionne sans SMTP.
- F-ACC-4 Profil : username, email, mot de passe, avatar, theme d'interface (S5.3).
- F-ACC-5 Suppression du compte (RGPD) : les contenus partages dans des espaces GROUP restent, auteur anonymise, repris par les moderateurs [D20]. L'ecran montre les consequences espace par espace et propose l'export avant de demander le mot de passe [D116].
- F-ACC-6 Export natif de ses recettes (JSON reimportable, Markdown, photos en zip) [D37].
- A la creation du compte, l'espace PERSONAL est cree automatiquement. Il montre son contenu propre et une vue "Mes recettes" (toutes les recettes dont on est l'auteur) [D82].

### 4.2 Espaces, membres, invitations

- F-SPC-1 Creer un espace GROUP (nom, description, avatar, teinte d'accent, S5.3). Le createur est OWNER.
- F-SPC-2 Inviter par **lien d'invitation** ou par username exact [D07]. Le lien a deux reglages seulement (duree 1, 7 ou 30 jours ; nombre de personnes) et se revoque dans la meme feuille [D94].
- F-SPC-3 Accepter / refuser une invitation. Les invitations en attente sont visibles dans le centre de notifications.
- F-SPC-4 Quitter, exclure, promouvoir, retrograder, transferer la propriete (S3.1). Le transfert est une proposition que le destinataire accepte ; l'ancien OWNER devient moderateur [D92]. Quitter un groupe ou l'on a partage des recettes de son espace perso : l'ecran liste ces recettes et l'on choisit de laisser ou de retirer chaque partage [D84].
- F-SPC-5 Supprimer l'espace (OWNER) : masque pour tous, restaurable 30 jours, puis purge [D22]. Confirmation en tapant le nom de l'espace, export propose dans la meme feuille [D93]. A la purge, les recettes partagees ailleurs sont rapatriees dans l'espace perso de leur auteur ; sans auteur, elles restent dans les espaces de partage, gerees par leurs moderateurs [D83].
- F-SPC-6 Modules [D33] : a la creation, seul Recettes est accorde et actif. L'OWNER consulte le catalogue des modules (statuts : disponible, beta, bientot), demande l'acces pour son espace, puis active ou desactive chaque module accorde. L'acces est attache a l'espace, pas a la personne. Memes regles pour l'espace perso. Recettes est toujours actif et ne se desactive pas [D91]. Un module "bientot" est visible au catalogue mais pas encore demandable [D123]. Un refus porte un motif visible par l'OWNER, qui peut redemander [D124]. Les donnees d'un module desactive ou retire sont conservees, masquees, et reviennent a la reactivation ; elles partent seulement avec l'espace [D85].
- F-SPC-7 Fil d'activite de l'espace.
- F-SPC-8 Export de tout l'espace par l'OWNER (memes formats), inscrit dans le fil d'activite, un par jour au maximum [D37].

### 4.3 Recettes (module coeur)

Contenu :

- F-REC-1 Titre, photo, portions (avec mise a l'echelle des quantites), temps (preparation, cuisson, repos, total calcule), ingredients (quantite, unite, ingredient), etapes ordonnees, notes, source (URL).
- F-REC-2 **Blocs** : une recette est une suite de blocs, soit locaux (titre optionnel, ingredients, etapes : "Sauce", "Assemblage"), soit **liens vers une autre recette** avec la quantite utilisee ("Sauce teriyaki : 150 ml"). Chaque recette a un **rendement** (portions par defaut, ou ml, pieces...). Une recette simple = 1 bloc local implicite ; lien **vivant** : un plat montre toujours la version actuelle de sa sous-recette ; pas de boucle, 3 niveaux maximum [D24]. Pour lier une recette, les bases sont proposees d'abord et la quantite se saisit dans l'unite de rendement de la sous-recette [D107].
- F-REC-3 Tags.

Cycle de vie [D03][D04][D05] :

- F-REC-4 Creer une recette **dans un espace** (perso ou groupe). Elle a **un** espace d'origine et **un** auteur. Plus de double creation perso + communaute.
- F-REC-5 **Partager** une recette dans d'autres espaces dont on est membre : la recette apparait dans ces espaces, c'est la meme recette (une seule source de verite, pas de synchronisation). Partager une recette composee partage ses sous-recettes, listees avant de valider [D26]. L'auteur partage directement ; un autre membre envoie une demande que l'auteur accepte, sauf si l'auteur a autorise les membres de cet espace a partager ses recettes [D81]. La demande s'ouvre en feuille depuis la notification, avec le reglage de confiance sur place [D101].
- F-REC-6 **Adapter** une recette pour un espace ("chez nous on la fait au beurre") : nouvelle recette de cet espace, liee a l'original et a sa revision de depart (`adaptedFromId`). L'original n'est jamais modifie. L'adaptation signale quand l'original a change et offre un ecran "Comparer avec l'original" en lecture seule [D17] : "Original modifie", "Ce que ton espace a change" et l'action "Proposer a l'original" [D105].
- F-REC-7 **Suggerer une modification** (membre non auteur) : diff lisible champ par champ. L'auteur (ou un moderateur si l'auteur n'est plus membre) accepte ou refuse. Accepter cree une revision. Refuser ne cree rien ; le suggereur peut, s'il le veut, transformer sa suggestion en adaptation [D140].
- F-REC-8 **Historique des revisions** consultable, avec restauration (meme droit que modifier [D55]). Le bouton d'enregistrement annonce la revision creee ("Enregistrer la revision 5") [D102]. Quitter l'editeur sans enregistrer garde un brouillon sur l'appareil [D104].
- F-REC-9 Retirer une recette d'un espace de partage (auteur ou moderateur de cet espace) sans la supprimer.
- F-REC-10 Supprimer une recette (auteur ; MOD et OWNER de l'espace d'origine si l'auteur n'en est plus membre [D57]) : elle disparait de tous les espaces ou elle est partagee, apres confirmation listant ces espaces.
- F-REC-11 Recherche et filtres : texte, tags, ingredients, temps max, auteur, espace. Tri.
- F-REC-12 Vue cuisine : etapes en grand, ecran maintenu allume, cochage des ingredients. Sur mobile, le detail d'une recette a un en-tete avec retour et une seule action principale fixee en bas (Mode cuisine) [D100].
- F-REC-13 Compteurs : nombre de fois planifiee, derniere fois cuisinee, nombre d'adaptations, espaces de partage. Pas de suivi des vues [D39].

Ce que l'on supprime de la V1 : la recette perso jumelle creee automatiquement, la synchronisation des copies, la copie independante (fork) [D140], la variante creee automatiquement au refus d'une proposition, la gestion "recette orpheline" (remplacee par la reprise par les moderateurs).

### 4.4 Referentiels (tags, ingredients, unites) [D08][D09]

- F-REF-1 Tags globaux : liste courte et curee par l'admin (ex : vegetarien, dessert, rapide).
- F-REF-2 Tags d'espace : propres a chaque espace, y compris sur une recette partagee [D19]. Tout membre peut en creer en taguant une recette ; ils sont immediatement utilisables. Les moderateurs les renomment, fusionnent, suppriment.
- F-REF-3 Ingredients : catalogue global. Un ingredient inconnu est cree a la volee et utilisable tout de suite ; l'admin fusionne les doublons a posteriori (le statut sert au tri de la file admin, pas a bloquer). Un ingredient fusionne devient un synonyme de la cible : propose a la saisie, remplace par la cible [D120].
- F-REF-4 Unites : catalogue global gere par l'admin, par dimension (poids, volume, piece, qualitatif ; les cuilleres sont des volumes) avec un facteur vers l'unite de base, et un poids par ingredient et par unite pour passer des pieces aux grammes [D46]. Sert aux recettes composees et a la liste de courses [D36].
- F-REF-5 Rayons : chaque ingredient a un rayon par defaut (fruits et legumes, boucherie...), gere par l'admin, utilise par la future liste de courses [D36]. Les rayons sont ordonnes selon le parcours en magasin ; sans rayon, l'ingredient va dans "Autres" [D125].
- Supprime : workflow PENDING des tags d'espace, suggestions de tags, preference "masquer les tags" par espace [D27].

### 4.5 Import

- F-IMP-1 Import depuis une URL (JSON-LD schema.org, comme en V1) vers un formulaire pre-rempli que l'utilisateur valide.
- F-IMP-2 Import depuis un texte colle, en V2.0 : decoupage heuristique sans LLM payant, formulaire pre-rempli a valider [D28].
- Les champs importes douteux portent un badge "A verifier" et un bandeau, sans bloquer l'enregistrement [D103].
- Securite : resolution DNS et verification d'IP privee **a chaque redirection**, taille et duree bornees.

### 4.6 Planning de repas (module)

Reprend la V1 (grille jours x repas, repas recette / texte libre / vide, verrouillage, echange par glisser-deposer, idees de repas, generation par jeux de parametres) avec ces changements :

- F-MPL-0 Calendrier continu par espace : pas de planning a creer ni d'archives, on navigue de semaine en semaine, le passe reste consultable ; la generation porte sur une periode choisie (31 jours au plus) [D180]. Un repas est vide, recette, texte libre ou "Pas de repas" [D181].

- F-MPL-1 Disponible dans l'espace PERSONAL aussi.
- F-MPL-2 Deux repas par jour, midi et soir ; chaque espace choisit de planifier l'un, l'autre ou les deux (les deux par defaut). Ni petit-dejeuner ni gouter [D11].
- F-MPL-3 Droit de modifier un repas par role minimal, MEMBER par defaut, reglable par l'OWNER ; generer et regler le planning : moderateurs et OWNER [D58].
- F-MPL-4 Une idee de repas (nom et commentaire) peut etre convertie en recette : elle ouvre l'editeur de recette pre-rempli, puis l'idee est retiree [D133, D182].
- F-MPL-5 Un slot peut pointer vers n'importe quelle recette visible dans l'espace (origine ou partagee).
- La generation (regles par tag ou recette, poids, frequences, cooldowns, exclusions, epinglages) est conservee telle quelle fonctionnellement ; son UI est refaite :
  - elle produit un apercu ; rien n'est enregistre avant "Garder ce planning" [D110] ;
  - le rapport explique chaque repas laisse vide au lieu de le remplir de force [D113] ;
  - exclusions et epinglages se reglent dans une seule grille jours x repas [D114].
  - un profil "Standard" sans regle existe d'office dans chaque espace [D183] ; poids en cinq paliers, avec un mode avance a jauge 0 a 200 % [D184].
- F-MPL-6 Sur mobile, selecteur "Jour | Semaine" : Jour = vue detaillee, Semaine = liste compacte des 7 jours (une ligne par jour, repas en pastilles, toucher un repas l'ouvre) ; grille semaine complete en bureau [D111].
- F-MPL-7 Echange de repas sur mobile en mode "echange" : bandeau, cibles en pointilles, Annuler [D112].

### 4.7 Liste de courses (module, V2.1)

- F-SHP-1 Generer une liste depuis une periode du planning (agregation des ingredients, conversion d'unites, mise a l'echelle des portions). Pieces et grammes s'additionnent grace au poids par unite, sinon deux lignes [D126].
- F-SHP-2 Articles libres, cocher "achete", archiver.
- F-SHP-3 Regroupement par rayon, dans l'ordre du parcours en magasin (F-REF-5) [D125] ; magasin favori par ingredient.
- F-SHP-4 Modifier la liste (generer, articles libres, cocher, archiver) : role minimal reglable par l'OWNER, MEMBER par defaut, comme le planning [D141].

### 4.8 Notifications et activite

- F-NOT-1 Centre de notifications persistant (comme V1), temps reel par SSE [D188], groupement.
- F-NOT-2 Preferences globales par categorie, avec un reglage personnalise par espace [D118].
- F-NOT-3 Types de notification et d'activite : cles texte declarees par chaque module dans le registre, pas d'enum en base (un nouveau module n'impose pas de migration du socle) [D41].
- F-NOT-4 Notification "nouvelle version" liee au changelog, envoyee a tous les utilisateurs si l'admin l'active a la publication (interrupteur) [D127].

### 4.9 Administration plateforme

Dashboard, referentiels, catalogue de modules (statut de chaque module), **file des demandes d'acces aux modules** (accepter / refuser, accorder ou retirer d'office), espaces, recettes (moderation), changelog, journal d'audit. Reprise de la V1 avec le design system V2.

- Le tableau de bord s'ouvre sur "A traiter" et l'etat des services [D129].
- Moderation d'un espace : acces en lecture seule pendant 30 minutes, seules les actions de moderation sont possibles (sur une recette : masquer, supprimer, ou la retirer d'un espace de partage, ou elle reste chez son auteur ; motif obligatoire, audit) [D122] ; l'OWNER est informe, avec le motif [D121]. Une recette masquee n'est plus visible que de son auteur, qui voit le motif ; l'acces est enregistre a part et expire seul [D178].
- Le journal d'audit ne se modifie ni ne se supprime ; il se filtre par categorie [D128].
- Reglages de la plateforme en lecture seule : SMTP, Bugsink et stockage restent configures par variables d'environnement (`14-Architecture.md`) ; l'ecran affiche l'etat, les valeurs non secretes et un bouton "Tester" par service [D135].
- Connexion admin sans compteur d'etapes (2 ou 3 selon que la 2FA est deja configuree) : les titres suffisent [D138].

### 4.10 Changelog

Reprise de la V1 (page utilisateur, gestion admin), generation revue [D187] :

- Chaque image API embarque le brouillon de sa version (version semver et items calcules par la CI depuis les commits) ; le demarrage le cree s'il n'existe pas.
- L'admin le reformule pour les utilisateurs dans A10 et le publie, en prevenant tout le monde ou non [D127] ; une version publiee peut etre masquee.
- La 2.0.0 (premiere version V2) s'ecrit a la main.

## 5. UX et design system

### 5.1 Principes

- **Mobile first** [D38] : chaque ecran est concu pour le telephone d'abord. Gestes : glisser pour fermer les panneaux du bas, appui long pour le menu d'actions, tirer pour rafraichir.
  Exception : pas d'appui long sur un repas du planning, F-REPAS porte ses actions [D186].
- **Une seule interface** desktop et mobile, construite avec les memes composants (pas de pages "mobile" a part).
- **Navigation stable en 3 niveaux** : espace -> module -> contenu. L'utilisateur sait toujours dans quel espace il est.
- **Le contenu d'abord** : les panneaux lateraux et les menus servent le contenu, pas l'inverse.
- **Tout se retrouve** : palette de commandes (Ctrl+K) et recherche globale, qui couvre aussi le planning et les actions [D119].
- **Installable et lisible hors ligne** [D35] : PWA (ecran d'accueil, plein ecran), recettes deja ouvertes et planning de la semaine consultables sans connexion. Hors ligne, les actions d'ecriture sont desactivees (pas masquees) avec la raison, les cartes portent un badge et les notifications restent lisibles [D106][D117].
- **Traduisible** [D34] : textes en cles de traduction, referentiels globaux nommes par langue ; francais seul en V2.0. Les textes vus par les utilisateurs (traductions, maquettes) sont en francais correct, accents compris ; l'ASCII seul vaut pour le code, les commentaires et la documentation [D87].

### 5.2 Structure d'ecran (App shell)

- **Rail des espaces** (gauche, etroit) en bureau : avatar de l'espace perso puis des groupes, bouton "+". Sur mobile : l'espace courant (avatar + nom) est un bouton de l'en-tete qui ouvre la liste des espaces en feuille (avatars, pastilles de nouveautes, "+") [D130].
- **Barre du module** : modules actifs de l'espace courant (Recettes, Planning, Courses, Membres, Reglages). Sur mobile : barre d'onglets en bas, 4 modules maximum puis "Plus" (membres, reglages et modules au-dela du quatrieme, dans l'ordre choisi par l'OWNER) [D131]. Espace perso : Accueil, Recettes, Mes recettes, Plus [D95].
- **Zone de contenu** : liste / detail, avec panneau de detail lateral sur grand ecran et page pleine sur mobile.
- **En-tete** : recherche, notifications, profil.
- Dashboard d'accueil fait de **widgets** que l'utilisateur choisit et ordonne (prochains repas, recettes recentes, invitations, activite).

### 5.3 Design system

- **shadcn/ui** (Radix + Tailwind) [D16] : composants copies dans le depot, donc modifiables, organises en 3 couches : `ui/` (primitives shadcn), `patterns/` (composites : RecipeCard, IngredientInput, SlotCell...), `modules/` (ecrans).
- **Tailwind v4** avec des **tokens CSS** (`--background`, `--foreground`, `--primary`, `--muted`, `--radius`, etc.) definis une fois.
- **Ambiances** [D32] : **Braise** en signature (charbon, ardoise, accent ambre) ; **Sous-bois** et **Potager** en alternatives dans Profil > Apparence. Polices communes, seules les couleurs changent. Chaque ambiance existe en clair et en sombre ; par defaut l'app suit le reglage du systeme.
- **Personnalisable** : ambiance, mode clair / sombre / systeme, densite (confortable / compacte), taille du texte, et **couleur d'accent par espace** (chaque espace a sa teinte, adaptee a l'ambiance, appliquee quand on y entre). L'ambiance se choisit avec un apercu reel et s'applique immediatement [D115].
- Teinte Cendre (Braise) : les remplissages pleins (bouton principal, interrupteur, case, pastille) reprennent la teinte 1 de l'ambiance pour ne pas paraitre desactives ; la navigation et les elements actifs gardent Cendre [D139].
- **Navigation** : rail des espaces a gauche facon Discord.
- Icones : un seul jeu (Lucide, livre avec shadcn). daisyUI et react-icons sont retires.
- Accessibilite : focus visible, navigation clavier complete (Radix), contraste AA, cibles tactiles de 44px.
- Un **catalogue de composants** vivant (page interne `/design` [D29]) sert de reference. Ajouts issus des maquettes : composant de choix (radio, nuancier) et etat "en suppression" du rail [D96], QuantityInput [D108], icones arrow-left et wifi-off [D109], TopBar en mode edition ("Annuler", titre, action principale) pour tous les editeurs [D136], RadioGroup avec apercu en pastilles de couleur [D137]. Detail : `10-Design-System/project/README.md`.

### 5.4 Maquettes

Inventaire des ecrans : `13-Parcours.md`. Maquettes : `16-Maquettes/` (4 canevas, liens dans le `README.md` du chantier). Donnees d'exemple : `16-Maquettes/BRIEF.md` (Matthias OWNER de Colloc [D132]).

## 6. Exigences techniques

### 6.1 Architecture

- Monorepo npm workspaces : `apps/api`, `apps/web`, `packages/shared` (schemas Zod, types, codes erreur, constantes de permissions partages entre back et front) [D15].
- **Socle generique** [D40] : comptes, espaces, membres, permissions, invitations, notifications, activite, recherche et administration ne connaissent aucun module ; Recettes se branche par le registre comme les autres.
- Backend : TypeScript, Express 5 et Prisma 7 [D80][D86]. Organisation **par module** (`modules/recipes`, `modules/meal-plan`...) avec routes, service, schemas, permissions et notifications propres. Detail : `14-Architecture.md`.
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

## 7. Modele de donnees cible

Source de verite : `11-Modele-Donnees/schema.prisma` (contraintes SQL hors Prisma listees en fin de fichier). Presentation : `11-Modele-Donnees/Modele-Donnees.html`, generee par `generer-page.py` (artefact en ligne : lien dans le `README.md` du chantier). Le CDC ne recopie pas le schema. Mis a jour en B9 avec les decisions des maquettes (D92, D94, D120, D131, D134, widgets d'accueil S5.2) [D142].

Choix structurants : revisions en instantane JSON [D30][D42] ; tags d'espace portes par le couple recette + espace, tags globaux par la recette [D19] ; types de notification et d'activite en cles texte [D41] ; compteurs calcules, pas stockes [D43]. Detail des decisions de modelisation : D41 a D47.

## 8. Migration des donnees V1 -> V2

Sans objet [D23] : la V1 n'a pas d'utilisateurs reels, la base et la stack seront remises a zero avant la mise en prod de la V2.

## 9. Strategie

**Reecriture propre dans le meme depot [D25]** : monorepo neuf (`apps/api`, `apps/web`, `packages/shared`), nouveau schema et nouvelles migrations. Les parties solides de la V1 sont reprises a la main apres relecture : securite (helmet, CSRF, rate limiting, sessions), admin 2FA, import JSON-LD, algorithme de generation du planning, CI/CD. Le code V1 est supprime des le debut de la realisation (C1.1), apres un tag `v1-final` qui sert de reference [D143].

## 10. Questions ouvertes

| #   | Question                                                                                                                                                                              | Bloque     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Q01 | REPONDU (D02) - Valides-tu l'espace PERSONAL comme un espace a part entiere (planning perso, courses perso) ?                                                                         | S2, S3, S7 |
| Q02 | REPONDU (D18) - Quand l'auteur d'une recette partagee quitte un groupe : la recette reste visible (figee, reprise par les moderateurs) ou disparait du groupe ?                       | S4.3       |
| Q03 | REPONDU (D20) - Suppression de compte : ses recettes partagees restent (auteur "ancien membre") ou sont supprimees ?                                                                  | S4.1       |
| Q04 | REPONDU (D19) - Les tags sont-ils attaches a la recette (communs a tous les espaces) ou a la recette **dans** un espace ?                                                             | S4.4, S7   |
| Q05 | REPONDU (D21) - Envoi d'emails : quel service gratuit (SMTP perso, Brevo, Resend free tier...) ? Sans email, pas de reset de mot de passe.                                            | S4.1       |
| Q06 | REPONDU (D22) - Suppression d'espace : delai de grace (ex : 30 jours restaurable) ou immediat ?                                                                                       | S4.2       |
| Q07 | REMPLACEE par D24 (recettes composees) - Sections de recette (sous-recettes) en V2.0 ou plus tard ?                                                                                   | S4.3       |
| Q08 | REPONDU (D27) - On supprime vraiment les suggestions de tags et l'option "masquer les tags" ? Les utilisais-tu ?                                                                      | S4.4       |
| Q09 | REPONDU (D28) - Import par texte colle : en V2.0 ou plus tard ?                                                                                                                       | S4.5       |
| Q10 | REPONDU (D11) - Planning : faut-il d'autres repas que midi / soir (petit-dejeuner, gouter) ?                                                                                          | S4.6       |
| Q11 | REPONDU (D29) - Catalogue de composants : page interne simple ou Storybook ?                                                                                                          | S5.3       |
| Q12 | REPONDU (D30) - Revisions : snapshot JSON (simple) ou tables normalisees (requetable) ?                                                                                               | S7         |
| Q13 | REPONDU (D23, sans objet) - Que garder de l'historique V1 des propositions et variantes ?                                                                                             | S8         |
| Q14 | REPONDU (D23) - Choix de l'OWNER des communautes existantes lors de la migration ?                                                                                                    | S8         |
| Q15 | REPONDU (D23, aucun user en V1) - Combien d'utilisateurs / communautes reels en prod aujourd'hui ? (dimensionne l'effort de migration)                                                | S8, S9     |
| Q16 | REPONDU (D23, sans objet : pas d'utilisateurs, la V1 ne sera pas corrigee) - Les failles V1 relevees (rooms socket, SSRF de l'import) : correctif immediat en V1 ou on attend la V2 ? | V1         |
