# Projet futur

Nous allons travailler sur chacun de ces points les uns après les autres.

Le but est de bien définir chaque point avant de passer à l'implémentation.
Tout doit être cohérent avec l'application et son fonctionnement actuel. Ce sont des évolutions, ou parfois des reworks complets de certaines parties du projet afin de les pousser à leur maximum.
Tout doit être clair et maitrisé, pensé pour être maintenable et évoluer dans le temps.
Toute la logique business doit être validé et sans zone d'ombre restante avant d'écrire du code.

Le Rework V2 a traite toutes les idees precedentes : livrees en V1, integrees au CDC V2, ou abandonnees (tri dans `Rework-V2/archive/9-Revue-Brainstorming.md`, version complete de ce fichier dans le tag git `v1-final`). Restent ici les idees encore ouvertes, pour apres la V2.0.

## Brique on joue à quoi ?

> **Statut V2** : apres la V2.0. Prepare par le socle generique (D40) et l'acces aux modules sur demande (D33).

Nous sommes ici une nouvelle feature majeure. (penser à utiliser le système de feature)

(utiliser api publique pour trouver des jeux et faire une liste)

## Brique On regarde quoi et ou ?

> **Statut V2** : apres la V2.0. Prepare par le socle generique (D40) et l'acces aux modules sur demande (D33).

Nous sommes ici une nouvelle feature majeure. (penser à utiliser le système de feature)

(utiliser api publique pour trouver des films/séries et faire une liste, s'inspirer de Netflix pour l'interface)

## Visite guidee pour les nouveaux utilisateurs

Idee notee pendant l'etude V2 : en V2.0, un ecran de bienvenue a 3 choix suffit (D61). Une visite guidee (rail des espaces, modules, ajout de recette) pourra venir ensuite si les nouveaux utilisateurs se perdent.

## Idees futures liees au changelog

> **Statut V2** : la notification de nouvelle version est dans la V2. Changelog public et markdown : plus tard.

- **Changelog public** : rendre le changelog accessible sans connexion (flag `isPublic` sur le modele)
- **Markdown dans le contenu** : enrichir les items avec du markdown (liens, gras, etc.)

---

# Texte de presentation du projet (brouillon)

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
