# Projet futur

Nous allons travailler sur chacun de ces points les uns après les autres.

Le but est de bien définir chaque point avant de passer à l'implémentation.
Tout doit être cohérent avec l'application et son fonctionnement actuel. Ce sont des évolutions, ou parfois des reworks complets de certaines parties du projet afin de les pousser à leur maximum.
Tout doit être clair et maitrisé, pensé pour être maintenable et évoluer dans le temps.
Toute la logique business doit être validé et sans zone d'ombre restante avant d'écrire du code.

# Rework V2 - EN ETUDE (2026-11-03)

> Refonte complete decidee : reecriture propre dans ce depot, sans migration (pas d'utilisateurs en V1). Dossier `Rework-V2/` : analyse de la V1, cahier des charges, journal des decisions (D01 a D40), roadmap. Chaque idee encore ouverte ci-dessous porte une ligne **Statut V2**.

Idees nees pendant l'etude, deja integrees a la V2 :

- **Adapter une recette a un espace** (D17) : "chez nous on la fait au beurre" sans toucher la recette d'origine ; l'adaptation signale quand l'original change.
- **Recettes a base de recettes** (D24) : escalope milanaise + compotee de tomates cerises, sauce teriyaki partagee entre plusieurs plats.
- **Modules accordes sur demande** (D33) : seul Recettes est fourni ; l'OWNER demande l'acces aux autres modules, un super admin accepte. Premiere brique gratuite, d'autres peut-etre payantes un jour.
- **Trois ambiances visuelles** (D32) : Braise en signature, Sous-bois et Potager au choix dans Profil > Apparence. Rail des espaces a gauche facon Discord.
- **Espace perso = un espace comme les autres** (D02) : planning et courses aussi en solo.

# ~~Rework du système d'ingrédients~~ DONE (Phase 11)

Implemente : unites structurees, gouvernance PENDING/APPROVED, moderation admin, propositions avec ingredients, notifications WebSocket.

# ~~Le système de notifications doit être amélioré~~ DONE (Phase 12)

persistance, fonctionne y compris offline (je me connecte je dois voir les notifs reçues lorsque j'étais offline)

# ~~Rework des pages recettes (v2)~~ DONE (Phase 13)

Implemente : servings avec scaling dynamique des quantites, etapes structurees ordonnees, temps de prep/cuisson/repos avec total auto, propositions granulaires (servings/temps/steps), badges temps et servings sur les cartes.

# ~~Système d'upload de photos~~ DONE (Phase 15)

usage :
miniature user ?
photos de recettes
icone / photo des communautés

Proposition :

"Cloudflare R2 – choix & contraintes
Nous utilisons Cloudflare R2 comme solution de stockage d’images (recettes + communautés).
Pourquoi R2
Free tier : 10 GB de stockage, 1M d’opérations/mois
0€ d’egress
API compatible S3
Adapté à un projet indé / early-stage
Règles d’implémentation
Aucun fichier ne transite par le backend
Upload via URL signée (presigned PUT)
Le backend stocke uniquement l’URL publique
Optimisation du free tier
Formats autorisés : image/webp, image/jpeg, image/png
Taille max : 5 MB
Dimensions max : 1600px
Conversion en WebP prioritaire
1 image par recette / communauté (pas de galerie)
Organisation des fichiers
recipes/{recipeId}/cover.webp
communities/{communityId}/avatar.webp
Sécurité
URL signée avec durée courte (≤ 60s)
Validation MIME + taille côté backend
Suppression des images associées à la suppression d’une recette ou communauté
Base de données
Ajouter imageUrl nullable sur Recipe et Community"

Qu'en penses-tu ? est-ce que tu vois une meilleure option, mon projet étant (pour l'instant) petit, très indépendant et je voudrais éviter au maximum les investissements financiers ?
Dans la mesure du possible je ne veux pas fournir de carte bancaire pour être certain de ne pas dépenser pour cette feature.
Si je n'ai pas le choix comment faire pour m'assurer à 100% que je ne dépasserai pas ?
Est-ce qu'il existe une solution en local ?
Je cherche tout à de même à avoir une solution la plus professionnelle et sécurisée possible.

# ~~système d'importation de recettes~~ DONE (Phase 16)

Je ne sais pas si c'est vraiment nécessaire, mais il serait bien pratique de pouvoir importer des recettes depuis un copier coller. Le problème est que le format d'origine varie beaucoup. Un LLM pourrait aider à parser le format d'origine et à le convertir en format interne mais je ne veux pas de solution payante. Dans un monde idéal j'aimerais pouvoir coller un texte ou un lien, que le llm préremplit le formulaire de recette, l'utilisateur vérifie, ajuste et valide.
S'il existe une solution autre qu'un LLM c'est l'idéal mais pour le coup je ne maitrise pas du tout le sujet. Que peux-tu me proposer comme solutions ? Si c'est trop complexe, je suis ouvert à des solutions moins sophistiquées, et je suis également ouvert à ne pas réaliser cette fonctionnalité.

# ~~audit refactorisation complete~~ DONE (Phase 17)

back + front
Clean code
Dry
optimisation du code
zod ? est-ce nécessaire ?
abstraction
app.ts et app.tsx optimisés, clair et lisisbles
mvp parfait, la suite ne sera que des itérations
audit performances
Audit sécurité complet
npm audit
lint
tests

# ~~Corrections des imports depuis Hello Fresh~~ DONE

exemple : https://www.hellofresh.fr/recipes/aubergine-laquee-au-miso-and-oeuf-64fb2da9786cce2df0e01899
(pas de nom d'ingrédients, des balises html dans les étapes etc )

# ~~Update des docs et petit ménage dans Progress.md ?~~ DONE

docs/mvp/ supprime, roadmaps des features terminees supprimees, PROGRESS/CLAUDE.md simplifies.
Les specs fonctionnelles (SPEC\_\*.md) sont conservees dans docs/features/ comme reference.

# ~~Version mobile inutilisable~~ DONE

Spec complete : `docs/features/mobile-rework/SPEC_MOBILE_REWORK.md`
Bottom tab bar, bottom sheets, breakpoints md:, touch targets 44px, safe areas, layout adaptatif par composant.

# ~~codes erreur doublons : string literal~~ DONE

Des codes erreurs utilisent des string literal au lieu de constantes car le code erreur est le même. Peut être qu'il faudrait créer de nouveaux code erreur pour ces cas spécifiques et les centraliser pour éviter les string literal et les doublons.

## ~~systeme + page de changelog automatique~~ SPEC DONE

Spec complete : `docs/features/changelog/SPEC_CHANGELOG.md`
Generation auto via CI, versioning semver, page user blog-like, CRUD admin, API key CI, conventional commits.

---------------------------------------- Special feature 1----------------------------

## Gestionnaire de planning de repas dans une communauté

> **Statut V2** : livre en V1 (planning manuel). Repris en V2 : disponible aussi dans l'espace perso (D02), repas de la journee configurables (D11), droits d'edition par role, idees de repas convertibles en recettes, acces au module accorde par un super admin sur demande (D33).

Nous sommes ici à notre première nouvelle feature majeure. (penser à utiliser le système de feature)
Ici deux features différentes : la première va être la gestion d'un planning de repas, (manuellement)
La deuxième va être la gestion de plusieurs jeux de paramètres de génération automatisé du planning.
Il va falloir se concentrer sur la première mais mettre de côté les informations concernant la seconde, la conserver en tête et la faire dans un second temps

automatique + drag and drop pour réorganiser le planning (à a Trello ? )
Sur chaques cartes, il doit y avoir un bouton (qui demande confirmation au clic) pour remplacer le repas proposé un autre tout en conservant les critères de génération.
Dans chaque communauté, il ne peut y avoir qu'un seul planning, mais il peut y avoir plusieurs jeu de paramètres de génération pour pouvoir faire plusieurs template de génération (par saison par exemple)etc.
Pour générer un planning, un jeu de paramètres de génération offre la possibilité de créer des règles d'automatisation selon des tags (possibilité avancée de mettre des poids sur les tags, voire même sur des recettes spécifiques de la communauté), cooldown avant qu'une recette ne revienne, dédier des recettes aux repas du midi, repas du soir, pouvoir mettre des poids sur les recettes afin de favoriser ou non leur récurence etc.
Il faut aussi pouvoir préciser des repas à ne pas entrer dans la plannification dans le jeu de donnée (exemple, si la communauté ne mange jamais ensemble le mardi soir, ça ne sert à rien de générer un menu pour ce repas là).

Il faut pouvoir modifier le planning à tout moment, soit en drag and drop des menus d'un repas sur l'autre afin de réorganiser le planning à tout moment dans la semaine, soit en modifiant directement le menu d'un repas (champ libre de recherche parmis les recettes de la communauté, puis du user (en proposant d'ajouter sa recette à la commu si ce n'est pas le cas) puis champ libre si besoin (en cas de champ libre, il faut un second champ pour pouvoir ajouter des commentaires visible lorsque l'on clique sur la carte du menu).

il faut aussi un nombre de personne standard qui sera utilisé pour calculer les quantités d'ingrédients (future feature liste de courses). Ce chiffre doit pouvoir être modifié (comme sur les recette) facilement sur chaque repas.

Pouvoir ajouter une liste de recettes (le nom + un commentaire facultatif pourrait être suffisant) / d'idée et de pouvoir faire en sorte que le générateur de planning puisse les utiliser.
De fait cela permet d'ajouter de nouvelles idées qui peuvent devenir des recettes au fur et à mesure du temps afin de générer de nouvelles recettes.

## Feature génération automatique du planning de repas

> **Statut V2** : livre en V1. Algorithme repris tel quel en V2, interface refaite. Une recette de base (sauce) n'est pas proposee seule par le generateur (D24).

Mettre ici tout ce qu'il faut conserver pour la feature génération automatique du planning de repas.

---------------------------------------- Fin --------------------------------------------------

## Brique liste de courses

> **Statut V2** : module en V2.1. Le modele (conversions d'unites, rayon par defaut de chaque ingredient) est prevu des la V2.0 (D36).

Nous sommes ici une nouvelle feature majeure. (penser à utiliser le système de feature)

Création d'une liste de courses associée au planning.
Possibilité d'ajouter un lien web à un ingrédient,
Possibilité de compléter avec des articles non liés à une recette.
Possibilité de marquer un article comme acheté.
Archiver une liste.
avoir des sous listes suivant les "type de shop favoris" (type de shop = supermarché, boucherie, poissonnerie, etc).
poivoir associer les ingrédients et articles à un shop favori.

## upload de photo suite

> **Statut V2** : couvert. L'avatar d'un espace est son icone dans le rail des espaces, a gauche.

faire ne sorte que les photos de communauté, s'il y en a une, soient utilisée pour la miniature de la communauté dans la sidebar

## Mobile v2 (post rework mobile v1)

> **Statut V2** : mobile first (D38). Retenus : glisser pour fermer les feuilles du bas, appui long pour le menu d'actions, tirer pour rafraichir. Ecartes : glisser depuis le bord (conflits avec le defilement), vibration (absente sur iPhone).

- **Swipe gestures** : swipe depuis le bord gauche pour ouvrir le drawer sidebar, swipe down pour fermer les bottom sheets, swipe-back pour naviguer en arriere. Necessite une gestion fine des conflits avec le scroll horizontal/vertical.
- **Long-press sur RecipeCard** : ouvrir l'ActionSheet (Edit, Delete, Share) via long-press au lieu du bouton "...". Pattern standard iOS/Android. Conflit potentiel avec le scroll de la liste a gerer.
- **Pull-to-refresh** : sur les listes (recettes, communautes, notifications). Necessite un composant custom ou une lib.
- **Haptic feedback** : `navigator.vibrate()` sur les actions de confirmation (suppression, validation de proposition). Support navigateur variable.

## Bouton pour exporter ses recettes ou celles d'une de nos communautés (backup local)

> **Statut V2** : export natif de ses recettes, et de tout l'espace pour son OWNER, trace dans le fil d'activite, un par jour (D37). Formats JSON, Markdown, photos en zip.

## Version application ?

> **Statut V2** : PWA installable sur l'ecran d'accueil, lecture hors ligne des recettes ouvertes et du planning de la semaine (D35). Pas d'appli native sur les stores.

comment faire une application mobile ?
Est-ce nécessaire ?

## Recipe Rework v3 - Sous-sections de recettes

> **Statut V2** : remplace par les recettes composees (D24) : une recette est une suite de blocs, locaux (ingredients + etapes) ou liens vivants vers d'autres recettes (sauce reutilisee dans plusieurs plats). Maquette : `Rework-V2/7-Proposition-Recettes-Composees.html`.

Certaines recettes sont composees de plusieurs sous-recettes (ex: enchiladas = viande + sauce + assemblage), chacune avec ses propres ingredients et etapes. Aujourd'hui tout est aplati en une seule liste d'ingredients et une seule liste d'etapes. Penser également à séparer les ingrédients en sous catégories

L'idee serait d'introduire un concept de `RecipeSection` (ou groupe) :

- Une recette peut avoir N sections ordonnees (ex: "Sauce", "Viande", "Assemblage")
- Chaque section a ses propres ingredients et ses propres etapes
- Les recettes simples (1 seule section) gardent le meme rendu qu'aujourd'hui
- L'import de recettes detecterait automatiquement les sous-sections
- Le formulaire de creation permettrait d'ajouter/supprimer des sections
- Impact DB : nouveau modele `RecipeSection` entre `Recipe` et `RecipeIngredient`/`RecipeStep`
- Impact front : formulaire multi-sections, affichage avec separateurs visuels, scaling par section

## Brique on joue à quoi ?

> **Statut V2** : apres la V2.0. Prepare par le socle generique (D40) et l'acces aux modules sur demande (D33).

Nous sommes ici une nouvelle feature majeure. (penser à utiliser le système de feature)

(utiliser api publique pour trouver des jeux et faire une liste)

## Brique On regarde quoi et ou ?

> **Statut V2** : apres la V2.0. Prepare par le socle generique (D40) et l'acces aux modules sur demande (D33).

Nous sommes ici une nouvelle feature majeure. (penser à utiliser le système de feature)

(utiliser api publique pour trouver des films/séries et faire une liste, s'inspirer de Netflix pour l'interface)

## Multi langue ?

> **Statut V2** : i18n prevue des le depart, francais seul livre ; referentiels globaux nommes par langue (D34).

passer le site en multilangue fr et EN ?

## Tests E2E

> **Statut V2** : Playwright sur les parcours critiques, inclus dans la V2.

Tests end-to-end avec Playwright ou Cypress qui simulent un vrai navigateur : un utilisateur se connecte, cree une recette, invite un membre, etc. Teste toute la chaine (front -> API -> DB). Lourd a mettre en place (infra, CI, maintenance) mais detecte des bugs que les tests unitaires/integration ne voient pas.

## Monitoring

> **Statut V2** : un outil gratuit de suivi d'erreurs (front + back) sera choisi en conception technique.

Metriques en production (temps de reponse, erreurs), alertes, dashboard type Grafana ou service comme Sentry pour tracker les erreurs en prod. Utile quand l'app est deployee et utilisee a plus grande echelle.

## PWA / Offline support

> **Statut V2** : voir "Version application" (D35).

Service worker, manifest, cache des pages, installable sur mobile. Consultation des recettes sans connexion.

## Recherche globale

> **Statut V2** : palette de commandes Ctrl K, recherche dans recettes, ingredients, membres, espaces.

Barre de recherche unique (navbar) qui cherche simultanement dans les recettes, communautes, tags, ingredients, membres. Resultats groupes par type.

## Visite guidee pour les nouveaux utilisateurs

Idee notee pendant l'etude V2 : en V2.0, un ecran de bienvenue a 3 choix suffit (D61). Une visite guidee (rail des espaces, modules, ajout de recette) pourra venir ensuite si les nouveaux utilisateurs se perdent.

## Analytics recettes

> **Statut V2** : pas de suivi des vues. Compteurs utiles : nombre de fois planifiee, derniere fois cuisinee, adaptations, espaces de partage (D39).

Comptage vues (RecipeView, RecipeAnalytics)
Affichage statistiques sur recettes
Dashboard analytics utilisateur

### Idees futures liees au changelog

> **Statut V2** : la notification de nouvelle version est dans la V2. Changelog public et markdown : plus tard.

- **Notification de nouveau changelog** : badge/notification in-app quand une nouvelle version est publiee. Potentiellement une categorie `CHANGELOG` dans NotificationCategory.
- **Changelog public** : rendre le changelog accessible sans connexion (flag `isPublic` sur le modele)
- **Markdown dans le contenu** : enrichir les items avec du markdown (liens, gras, etc.)

---

Hello !

J'ai un petit projet perso à vous partager ! Il se trouve que je suis développeur et que de temps en temps ça m'arrive de réfléchir (oui oui je vous jure!) et même de créer des petits projets.

Mon projet actuel est un projet de gestion de communauté privées. Que ce soit votre famille, un groupe d'amis, vos colloc etc, libre à vous de vous regrouper comme vous le souhaitez !

Pour commencer je m'intéresse à un sujet : la cuisine et plus particulièrement la gestion des recettes.
On a tous des recettes dans des carnets, des postits, des words, des mails, des liens, des photos etc etc et il n'est pas toujours facile de les retrouver.
L'idée ici est d'avoir votre propre espace pour stocker toutes vos recettes, puis les partager à vos proches dans vos communautés !
Partager des recettes devient simple, les retrouver tout autant !

Mais ce projet n'a pas pour but de s'arreter là ! La prochaine étape sera de permettre de générer à partir de règles personnalisées au niveau de la communauté des propositions de menus pour la semaine à partir de vos recettes, et pourquoi pas la liste de courses associée !

Certain veulent partager les recettes du TOM, il suffit de créer une communauté TOM et que l'on y partage les recettes dedans et hop, tout le monde y a accès !

Des idées j'en ai plein, mais je suis curieux de vos avis, et de vos retours !
(PS : le design n'est pas mon métier donc la version actuelle est un peu "brute")
