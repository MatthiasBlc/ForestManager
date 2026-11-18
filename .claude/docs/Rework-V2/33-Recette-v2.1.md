# Recette de la v2.1.0 en preprod

Feuille de verification avant la fusion `Developement` -> `master` (2026-11-18). Une case par point ; un ecart trouve devient une ligne "Ecarts" puis une case de la roadmap.

## Tags harmonises [D216]

- [x] Admin > Tags (`/admin/tags`) : tableau des familles globales (creer, renommer, ordonner), colonne Famille des tags globaux ; page et colonne Famille vues par Claude le 2026-11-18 (aucune famille encore, colonne Recettes a 0 partout en preprod), creation d'une famille laissee au proprietaire ; famille "Moment" (Course) creee par Claude, Aperitif, Entree, Plat, Dessert, Petit-dejeuner rangees dedans
- [x] Ranger les tags globaux du proprietaire (Hiver, Printemps, Ete, Automne -> "Saison" ; Midi, Soir -> "Repas"...) puis verifier le filtre OU / ET dans "Le Nid" ; fait avec "Moment" dans Coloc recette (compte testrecette1) : Dessert + Plat = 2 recettes (OU), + Vegetarien = 1 (ET)
- [ ] Planning > regle ou epinglage : champ "Tag" (feuille a choix unique, recherche)
- [ ] Reglages de l'espace > Tags (moderateur) : familles d'espace, Monter / Descendre, fusion
- [x] Editeur : section Tags, creation d'un tag d'espace ; partage avec reprise des tags d'origine ; tags groupes par famille, tag d'espace "Sucre" cree depuis la recherche, badges de la fiche tries par famille (partage non reteste)

## Listes de recettes

- [x] Ordre A a Z par defaut ; feuille Filtres > "Trier par" (6 ordres) ; filtre actif "Tri : ..." retirable ; ordre retenu apres rechargement [D217]
- [x] Bureau : bouton "..." en haut a droite de l'image d'une carte, meme menu que le clic droit, la recette ne s'ouvre pas
- [ ] Telephone : pas de bouton "...", l'appui long ouvre toujours le menu

## Espaces [D218]

- [ ] Rail (bureau) : glisser un espace sur un autre ; perso toujours en haut, "+" toujours en bas
- [ ] Rail au clavier : Tab jusqu'a un espace, Alt+Haut / Alt+Bas
- [ ] Telephone : feuille des espaces, appui long puis glisser une ligne ; un toucher simple change toujours d'espace
- [ ] Meme ordre retrouve sur l'autre appareil (ordre garde dans le compte)
- [ ] Image d'espace aux coins arrondis dans le rail

## Fleche de retour d'une recette [D219]

- [x] Depuis le planning (mobile en vue Semaine, une autre semaine que la courante) : retour au meme endroit ; vu en bureau : semaine du 9 au 15 novembre en vue Semaine, retour au meme endroit
- [ ] Depuis un widget de l'accueil (vu par Claude le 2026-11-18, compte testrecette1 : retour a l'accueil perso depuis une recette de la coloc), la recherche (Ctrl K), une notification, le fil d'activite : retour a la page d'origine
- [ ] Recette -> Historique -> retour -> retour : on revient bien a l'origine
- [ ] Lien de recette ouvert dans un nouvel onglet : retour a la liste des recettes
- [ ] Geste retour d'Android juste apres : revient sur la recette (limite connue, a juger)

## PWA de preprod [D220]

- [ ] Desinstaller la PWA de preprod du telephone, la reinstaller : nom "FM Preprod", icone a bandeau rouge PREPROD
- [x] Titre de l'onglet "Forest Manager Preprod" dans le navigateur
- [ ] La PWA de prod reste inchangee (apres la fusion)

## Changelog

- [ ] Brouillon de la v2.1.0 reformule pour les membres (texte propose en session) ; publie dans Admin > Versions apres le deploy prod

## Ecarts

- Feuille de tags sans tag a montrer : "Aucun tag ne correspond." alors que rien n'est cherche (filtres d'un espace sans recette taguee). Corrige : "Aucune recette taguee pour l'instant." (filtres) ou "Aucun tag pour l'instant." ; le message de recherche reste.

Verifie par Claude dans Chrome (bureau, compte testrecette1) le 2026-11-18 : bandeau "Nouvelle version disponible" puis Recharger ; manifeste, titre et nom iOS preprod (curl) ; vue Semaine du planning dans l'adresse (`&view=week`). Session admin expiree : page admin des tags laissee au proprietaire.
