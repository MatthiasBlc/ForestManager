# Plan - C9 Module liste de courses [D228]

Choix du proprietaire au selecteur le 2026-11-18 (tous ceux recommandes), puis revus d'apres sa liste Google Keep actuelle : groupes par endroit ou acheter (Pharmacie, Menager, Primeur, Boucher, Marche, Alimentaire, Epicerie asiatique, Ikea, Autre), beaucoup d'articles hors cuisine, rarement une quantite. Base : CDC S4.7 (F-SHP), droits [D141], rayons [D125], addition des quantites [D126], conversions et poids par unite deja en base [D36, D46]. La V1 n'avait pas de liste de courses : rien a reprendre.

D228 est au journal et le CDC (S4.7) est a jour.

## Decisions (D228)

- **Une seule liste par espace**, toujours a jour : on ouvre le module, on est sur la liste. Disponible aussi dans l'espace perso [D02].
- **Depuis le planning : apercu a cocher.** On choisit une periode (par defaut de demain a la fin de la semaine du planning, 31 jours au plus comme la generation [D180]) ; l'apercu liste les ingredients additionnes, tous coches ; on decoche ce qu'on a deja, puis "Ajouter N articles". Les repas deja ajoutes sont signales. Meme geste que le reimport et "Depuis mes recettes" [D203, D225].
- **Doublons additionnes** : un ingredient deja dans la liste (non achete) recoit la quantite sur sa ligne ; detail "pour : Curry, Quiche" en touchant la ligne. Pieces et grammes additionnes par le poids par unite, sinon deux lignes [D126] (`addQuantities` de `packages/shared/src/units`).
- **Sous-recettes depliees** : leurs ingredients, mis a l'echelle de la quantite utilisee ; on decoche dans l'apercu si on en a une toute faite. Sous-recette non visible : signalee "ingredients manquants" [D24, D26].
- **Articles a la main** : un seul champ avec suggestions du catalogue d'ingredients ; sinon le texte tel quel (eponge, taie d'oreiller). Quantite et unite facultatives : le plus souvent un simple libelle.
- **Sections de l'espace** (remplacent les rayons figes et le "magasin favori" du CDC) : chaque espace a ses sections (Primeur, Boucher, Pharmacie, Ikea...), ordonnees a la main comme les familles de tags. A l'activation du module, elles sont creees depuis les rayons de la plateforme, dans l'ordre du parcours [D125] ; renommables, supprimables, on en ajoute. Un ingredient va dans la section de son rayon ; deplace dans une autre section, l'espace s'en souvient (un texte libre aussi, par son nom normalise) ; sinon "Autres", toujours en fin.
- **Ordre** : seules les sections se reordonnent ; dans une section, ordre d'ajout, les achetes en fin de section. Un article change de section depuis sa ligne.
- **Retirer les achetes** (l'"archiver" du CDC) : un bouton vide la liste de ce qui est coche, avec Annuler dans le toast ; pas d'historique.
- **Hors ligne : lecture et coches.** La liste s'affiche hors ligne et on coche "achete" ; les coches partent au retour du reseau (la derniere coche gagne ; article retire entre-temps : coche ignoree). Generer, ajouter, retirer attendent le reseau, comme ailleurs [D35]. En ligne, les changements des autres membres arrivent en temps reel.
- **Droits** : un `editRole` (MEMBER par defaut, reglable par l'OWNER) couvre generer, ajouter, cocher, retirer [D141]. Lire : tout membre.
- **Module** : `shopping` passe de "bientot" a disponible, accorde par la plateforme a la demande de l'OWNER [D33].

## Ergonomie (mobile first, critere de la maquette)

Deux usages, deux moments : **remplir** (a la maison, au fil de la semaine) et **cocher** (en magasin, une main, peu de reseau). Chaque geste est juge sur le telephone d'abord, le bureau ensuite (meme page, plus large).

- **Cocher** : toute la ligne est la cible (pas seulement la case), hauteur confortable au pouce ; l'article coche se barre et glisse en fin de section, sans confirmation. Retour haptique si disponible.
- **Ajouter** : champ toujours visible en bas de l'ecran (zone du pouce), le clavier reste ouvert apres chaque ajout pour enchainer ("lait", entree, "piles", entree). Suggestions d'ingredients et d'articles deja vus dans l'espace ; la quantite se tape dans le meme champ ("2 citrons", "500 g farine") avec le parseur de l'import texte, jamais un formulaire.
- **Section** : l'article ajoute va dans sa section memorisee ; la changer depuis la ligne (appui long ou "..." -> liste des sections), un geste.
- **Lire** : sections repliables avec leur compteur restant ; une section entierement cochee se replie seule ; en tete, un seul compteur "12 a acheter".
- **Actions rares hors du chemin** : "Depuis le planning", "Retirer les achetes (N)", "Gerer les sections" dans la barre ou le menu du module, pas sur chaque ligne. Aucune boite de confirmation : Annuler dans le toast.
- **Hors ligne** : bandeau discret, coches toujours possibles, compteur "3 coches en attente" jusqu'a l'envoi.
- **Ecran allume** en magasin (wake lock, comme le mode cuisine) : a confirmer a la maquette.
- La maquette est jugee sur le nombre de gestes : ajouter 5 articles, generer une semaine, faire les courses d'une section.

## Modele (propose, le schema fera foi)

- `ShoppingSettings` : `spaceId` (id), `editRole` (defaut MEMBER), sur le modele de `MealPlanSettings`.
- `ShoppingSection` : `spaceId`, `name`, `sortOrder`, `aisleId?` (rayon de la plateforme dont elle est issue : y range les ingredients de ce rayon). Supprimer une section renvoie ses articles dans "Autres" (section implicite, sans ligne).
- `ShoppingItem` : `spaceId`, `sectionId?` (null = "Autres"), `ingredientId?` ou `label?` (texte libre, l'un ou l'autre), `quantity?`, `unitId?`, `checkedAt?`, `checkedById?`, `createdById?`, dates. Article ephemere : hard delete (pas de `deletedAt`, retirer = supprimer).
- `ShoppingPlacement` (memoire de l'espace) : `spaceId`, `ingredientId?` ou `labelKey?` (nom normalise), `sectionId` ; ecrite quand on deplace un article. Ordre de recherche d'une section : placement, puis section du rayon de l'ingredient, puis "Autres".
- `ShoppingItemSource` (pivot, cascade) : article, repas (`mealSlotId?`, `SetNull`), recette et son titre, date et moment du repas, quantite apportee. Sert au detail "pour : ..." et au signal "repas deja ajoute".

## Regles de calcul

- Recette d'un repas : ingredients mis a l'echelle `servings du repas (ou defaultServings) / rendement de la recette` ; rendement non exprime en portions -> quantites telles quelles et ligne "a verifier".
- Repas TEXT, SKIPPED ou recette invisible : hors liste, cites dans l'apercu ("3 repas sans recette").
- Lignes "a gout" (quantite nulle) : une ligne sans quantite, cochee comme les autres.
- Ingredients optionnels : dans l'apercu, decoches par defaut.
- Unite inconnue de l'ingredient ou dimension differente : ligne separee [D126].

## API (sous `/spaces/:spaceId/shopping`)

- `GET` : articles, avec rayon et sources.
- `POST /items`, `PATCH /items/:itemId` (quantite, unite, coche), `DELETE /items/:itemId`.
- `POST /from-plan/preview` (`from`, `to`) -> lignes additionnees (cle stable par ingredient et unite), repas deja ajoutes, repas ignores, sous-recettes manquantes.
- `POST /from-plan` (`from`, `to`, cles cochees) : recalcule cote serveur et fusionne, en une transaction.
- `POST /checked/clear` -> articles retires ; `POST /items/restore` pour l'Annuler du toast.
- `GET/POST /sections`, `PATCH/DELETE /sections/:sectionId`, `PUT /sections/order` (meme droit `editRole`) ; `PATCH /items/:itemId` accepte `sectionId` et ecrit le placement.
- `GET/PUT /settings` (`editRole`, OWNER).
- Evenement temps reel `shopping.changed` sur la salle de l'espace ; activite : une ligne par generation, pas par coche.

## Etapes (TDD)

1. Shared : schemas, codes erreur `SHOPPING_0xx`, permissions, et la fonction pure d'agregation (lignes de repas -> lignes de liste, fusion avec l'existant) testee a part.
2. API : migration, manifeste et catalogue, settings, articles, apercu et ajout depuis le planning (depliage par `composition.ts`), retirer et restaurer, temps reel ; tests d'integration et matrice de droits B2.
3. Maquette (artefact, copie locale ici d'abord), inspiree de la liste Keep du proprietaire : page liste par section, champ d'ajout, feuille "Depuis le planning", etat hors ligne ; validee par le proprietaire avant le code web.
4. Web : module (nav, page), liste par section (achetes en fin de section), gestion des sections (ajout, renommage, ordre), ajout, feuille d'apercu, retirer avec Annuler, reglages du module, temps reel, file des coches hors ligne (IndexedDB) ; tests composants.
5. E2E : planning -> liste -> cocher -> retirer ; deux membres en temps reel si faisable.
6. Docs : D228 au journal, CDC S4.7 reecrit, Parcours (F-SHP), Permissions, Plan de tests ; F-REF-5 (rayons : servent a initialiser les sections) ; cocher la roadmap.

## Points laisses ouverts (a trancher a la maquette)

- Le planning change apres l'ajout : rien d'automatique (l'apercu signale les repas deja ajoutes ; on peut rajouter). A confirmer a l'usage.
- Entree depuis le planning (bouton "Liste de courses" dans la barre du planning [D209]) en plus de la feuille dans le module.
