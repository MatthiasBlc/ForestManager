# Revue du brainstorming pour la V2

Revue du 2026-11-03 de `../../0-Brainstorming.md` : pour chaque idee encore ouverte, est-elle deja couverte par la V2, et faut-il la decider **avant de coder** ?

**Statut : traitee le 2026-11-03** (decisions D34 a D40). Reste ouvert : le choix de l'outil de suivi d'erreurs, en conception technique (roadmap B6).

Critere "a decider maintenant" : l'idee change le modele de donnees, l'architecture ou le design system. L'ajouter apres coute une reprise ; la prevoir maintenant ne coute presque rien.

## 1. A decider maintenant

| Idee                                                                     | Pourquoi maintenant                                                                                                                                                             | Proposition                                                                                                                                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-langue FR / EN**                                                 | Extraire les textes apres coup oblige a repasser sur tous les ecrans. Les **noms d'ingredients, d'unites et de tags globaux** sont des donnees : les traduire change le schema. | Textes de l'interface en cles i18n des le depart (FR seul livre). Referentiels globaux avec un nom par langue. Les recettes elles-memes ne se traduisent pas.                                              |
| **PWA / hors ligne / appli mobile**                                      | Le service worker, le cache des donnees et l'installation sur l'ecran d'accueil se pensent avec l'architecture front. Une appli native (stores) serait un autre projet.         | PWA installable en V2.0 (manifest, icone, plein ecran). Hors ligne en lecture seule pour les recettes deja ouvertes et le planning de la semaine. Pas d'appli native.                                      |
| **Liste de courses**                                                     | Prevue en V2.1, mais elle impose deux choses au modele des la V2.0 : des **conversions d'unites** (3 c. a soupe + 20 ml) et un **rayon / type de magasin** par ingredient.      | Modeliser maintenant les conversions d'unites et le rayon par defaut d'un ingredient ; le module courses lui-meme reste en V2.1.                                                                           |
| **Modules non culinaires** (jeux, films)                                 | Ils valident que le socle est vraiment generique : espaces, permissions, notifications, activite et recherche ne doivent rien supposer de "recette".                            | Regle d'architecture : le socle ne connait aucun module ; chaque module (Recettes compris) se branche par le registre. On ne concoit pas ces modules maintenant.                                           |
| **Gestes mobiles** (swipe, appui long, tirer pour rafraichir, vibration) | Ce sont des comportements des composants du design system (Drawer, Sheet, listes).                                                                                              | Dans le design system : feuilles du bas fermables au glisser, appui long = menu d'actions, tirer pour rafraichir sur les listes. Vibration et retour arriere au glisser : non (support navigateur inegal). |
| **Monitoring des erreurs**                                               | Se branche des le premier deploy ; sans lui, les bugs de prod sont invisibles.                                                                                                  | Outil gratuit de suivi d'erreurs front + back (offre gratuite d'un SaaS, ou instance auto-hebergee), choisi en conception technique. Journaux pino conserves.                                              |

## 2. Deja couvert par la V2

| Idee                                         | Ou                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Planning de repas manuel et generation       | CDC S4.6, repris et etendu a l'espace perso (D02, D11)                                      |
| Sous-sections de recettes (Recipe v3)        | Recettes composees de blocs (D24)                                                           |
| Photo de communaute dans la sidebar          | Avatar d'espace dans le rail (CDC S5.2, maquette des ambiances)                             |
| Export / sauvegarde de ses recettes          | F-ACC-6 (export de ses donnees). A etendre : export d'un espace par son OWNER (question R4) |
| Recherche globale                            | Palette de commandes Ctrl K (CDC S5.1)                                                      |
| Tests E2E                                    | CDC S6.3, Playwright sur les parcours critiques                                             |
| Notification de nouvelle version (changelog) | F-NOT-4                                                                                     |

## 3. Peut attendre (aucun impact sur le socle)

| Idee                                  | Remarque                                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Modules jeux et films (API publiques) | Nouveaux modules a etudier apres la V2.0, par le registre.                                                     |
| Changelog public, markdown            | Petites evolutions du module changelog.                                                                        |
| Analytics recettes (vues, stats)      | Les tables V1 n'etaient pas utilisees. Proposition : abandon en V2.0 ; le fil d'activite suffit (question R6). |

## 4. Questions (tranchees)

- R1 (D34) Multi-langue : prevoir l'i18n des maintenant (FR seul livre) ?
- R2 (D35) PWA et hors ligne : perimetre V2.0 ?
- R3 (D36) Liste de courses : modeliser conversions d'unites et rayons des la V2.0 ?
- R4 (D37) Export : seulement ses propres recettes, ou aussi tout un espace par son OWNER ?
- R5 (D38) Gestes mobiles : lesquels dans le design system ?
- R6 (D39) Analytics recettes : abandon ou compteurs simples ?
