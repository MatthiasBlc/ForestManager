# Projet futur

Nous allons travailler sur chacun de ces points les uns après les autres.
Le but est de bien définir chaque point avant de passer à l'implémentation.
Tout doit être cohérent avec l'application et son fonctionnement actuel. Ce sont des évolutions, ou parfois des reworks complets de certaines parties du projet afin de les pousser à leur maximum.
Tout doit être clair et maitrisé, pensé pour être maintenable et évoluer dans le temps.
Toute la logique business doit être validé et sans zone d'ombre restante avant d'écrire du code.

# Rework du système de tags

avoir une liste par défaut globale à la création d'une communauté, et permettre à chaque communauté de créer ses propres tags complémentaires ???
-> vu que les recettes sont associé à un user, comment faire de manière logique ?

# Rework du système d'ingrédients

Problèmes similaires au système de tags :
-> vu que les recettes sont associé à un user, comment faire de manière logique ?

# Rework des pages recettes (v2)

nombre de personne pour les ingrédients,
étapes claires et structurées
temps de préparation, temps de cuisson, de repos, temps total

sélecteur du nombre de persones avec calcul automatique des quantités

# Système d'upload de photos

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
Je cherche tout à de même à avoir une solution la plus professionnelle et sécurisée possible.

## Gestionnaire de planning de repas dans une communauté

automatique + drag and drop (à a Trello ? )
possibilité de créer des règles d'automatisation selon des tags, cooldown avant qu'une recette ne revienne, repas du midi, repas du soir, pouvoir mettre des poids sur les recettes afin de favoriser ou non leur récurence etc pouvoir faire plusieurs template de génération (par saison par exemple)etc.

Il faut pouvoir modifier le planning à tout moment, soit en drag and drop des menus d'un repas sur l'autre afin de réorganiser le planning à tout moment dans la semaine, soit en modifiant directement le menu d'un repas.

### Brique liste de courses

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
