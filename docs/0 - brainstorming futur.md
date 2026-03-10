# Projet futur

Nous allons travailler sur chacun de ces points les uns après les autres.

Le but est de bien définir chaque point avant de passer à l'implémentation.
Tout doit être cohérent avec l'application et son fonctionnement actuel. Ce sont des évolutions, ou parfois des reworks complets de certaines parties du projet afin de les pousser à leur maximum.
Tout doit être clair et maitrisé, pensé pour être maintenable et évoluer dans le temps.
Toute la logique business doit être validé et sans zone d'ombre restante avant d'écrire du code.

# ~~Rework du système d'ingrédients~~ DONE (Phase 11)

Implemente : unites structurees, gouvernance PENDING/APPROVED, moderation admin, propositions avec ingredients, notifications WebSocket.

# ~~Le système de notifications doit être amélioré~~ DONE (Phase 12)

persistance, fonctionne y compris offline (je me connecte je dois voir les notifs reçues lorsque j'étais offline)

# ~~Rework des pages recettes (v2)~~ DONE (Phase 13)

Implemente : servings avec scaling dynamique des quantites, etapes structurees ordonnees, temps de prep/cuisson/repos avec total auto, propositions granulaires (servings/temps/steps), badges temps et servings sur les cartes.

# ~~Système d'upload de photos~~ DONE (Phase 14)

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

# système d'importation de recettes

Je ne sais pas si c'est vraiment nécessaire, mais il serait bien pratique de pouvoir importer des recettes depuis un copier coller. Le problème est que le format d'origine varie beaucoup. Un LLM pourrait aider à parser le format d'origine et à le convertir en format interne mais je ne veux pas de solution payante. Dans un monde idéal j'aimerais pouvoir coller un texte ou un lien, que le llm préremplit le formulaire de recette, l'utilisateur vérifie, ajuste et valide.
S'il existe une solution autre qu'un LLM c'est l'idéal mais pour le coup je ne maitrise pas du tout le sujet. Que peux-tu me proposer comme solutions ? Si c'est trop complexe, je suis ouvert à des solutions moins sophistiquées, et je suis également ouvert à ne pas réaliser cette fonctionnalité.

# audit refactorisation complete back + front + zed ? + npm audit + lint + tests parfait

# Update des docs et petit ménage dans Progress.md ?

## système + page de changelog automatique

(Bouton à ajouter dans le footer du menu sidebar lorsqu'un user est connecté)
Le changelog représente des blocs de texte type "blog" du plus récent au plus ancien. Lorsqu'une merge à Master est faite et validée, lors de la phase de "deploy_prod", un résumé de tout les commits de manière organisé (Nouvelle feature, updates, bug) doit être généré et stocké en base.
L'idée est d'avoir un véritable changelog automatisé. Pas besoin de retranscrire tout ce qui touche au tests, déploiement, update de docs etc. Il faut retranscrire uniquement ce qui impacte une correction ou une évolution de l'expérience utilisateur.
Dans l'interface admin, il faut pouvoir modifier et supprimer ces message (toujours avec une confirmation de validation)

- Mise en place d'un système de version propre pour suivre les patch du changelog ?

## upload de photo suite

faire ne sorte que les photos de communauté, s'il y en a une, soient utilisée pour la miniature de la communauté dans la sidebar

## Gestionnaire de planning de repas dans une communauté

automatique + drag and drop (à a Trello ? )
Sur chaques cartes, il doit y avoir un bouton (qui demande confirmation au clic) pour remplacer le repas proposé un autre tout en conservant les critères de génération.
possibilité de créer des règles d'automatisation selon des tags (possibilité avancée de mettre des poids sur les tags), cooldown avant qu'une recette ne revienne, repas du midi, repas du soir, pouvoir mettre des poids sur les recettes afin de favoriser ou non leur récurence etc pouvoir faire plusieurs template de génération (par saison par exemple)etc.

Il faut pouvoir modifier le planning à tout moment, soit en drag and drop des menus d'un repas sur l'autre afin de réorganiser le planning à tout moment dans la semaine, soit en modifiant directement le menu d'un repas.

Pouvoir ajouter une liste de recettes (le nom pourrait être suffisant) / d'idée et de pouvoir faire en sorte que le générateur de planning puisse les utiliser.
De fait cela permet d'ajouter de nouvelles idées qui peuvent devenir des recettes au fur et à mesure du temps afin de générer de nouvelles recettes.

## Brique liste de courses

Création d'une liste de courses associée au planning.
Possibilité d'ajouter un lien web à un ingrédient,
Possibilité de compléter avec des articles non liés à une recette.
Possibilité de marquer un article comme acheté.
Archiver une liste.
avoir des sous listes suivant les "type de shop favoris" (type de shop = supermarché, boucherie, poissonnerie, etc).
poivoir associer les ingrédients et articles à un shop favori.

## Brique on joue à quoi ?

(utiliser api publique pour trouver des jeux et faire une liste)

## Brique On regarde quoi et ou ?

(utiliser api publique pour trouver des films/séries et faire une liste, s'inspirer de Netflix pour l'interface)

## Multi langue ?

passer le site en multilangue fr et EN ?

## Tests E2E

Tests end-to-end avec Playwright ou Cypress qui simulent un vrai navigateur : un utilisateur se connecte, cree une recette, invite un membre, etc. Teste toute la chaine (front -> API -> DB). Lourd a mettre en place (infra, CI, maintenance) mais detecte des bugs que les tests unitaires/integration ne voient pas.

## Monitoring

Metriques en production (temps de reponse, erreurs), alertes, dashboard type Grafana ou service comme Sentry pour tracker les erreurs en prod. Utile quand l'app est deployee et utilisee a plus grande echelle.

## PWA / Offline support

Service worker, manifest, cache des pages, installable sur mobile. Consultation des recettes sans connexion.

## Recherche globale

Barre de recherche unique (navbar) qui cherche simultanement dans les recettes, communautes, tags, ingredients, membres. Resultats groupes par type.

## Analytics recettes

Comptage vues (RecipeView, RecipeAnalytics)
Affichage statistiques sur recettes
Dashboard analytics utilisateur
