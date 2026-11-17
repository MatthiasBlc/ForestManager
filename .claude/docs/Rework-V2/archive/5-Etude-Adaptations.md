# Etude - Adapter une recette a un espace

Statut : **TRANCHEE** le 2026-11-03 : adaptation liee, perimetre allege (D17). Amende D03.

## 1. Le besoin

Exemple : "Gratin de pates" avec 10 cl de creme, cree dans l'espace A. Partage dans l'espace B, ou l'on cuisine au beurre (10 g). B doit pouvoir adopter le beurre **sans toucher A**, ou l'on prefere la creme.

Sous-besoins a separer :

| #   | Besoin                                                                | Exemple                                             |
| --- | --------------------------------------------------------------------- | --------------------------------------------------- |
| B1  | Un espace adapte une recette a sa facon de cuisiner                   | B passe au beurre                                   |
| B2  | L'adaptation ne modifie jamais l'original ni les autres espaces       | A garde la creme                                    |
| B3  | Une correction de l'original peut encore interesser l'adaptation      | L'auteur corrige le temps de cuisson : 25 -> 35 min |
| B4  | Une amelioration de l'adaptation peut etre proposee a l'original      | B ajoute "gratiner 5 min sous le grill"             |
| B5  | Confidentialite : les membres de A ne voient pas forcement l'espace B | A ne doit pas lire le contenu de B                  |

## 2. Ce que fait la V1

- **Publication** (meme recette dans A et B, copies synchronisees) : une proposition acceptee dans B est propagee a la recette perso et a A (`backend/src/services/proposalService.ts:160-215`). B1 et B2 sont violes.
- **Partage = fork** : copie independante dans B. B2 est respecte, mais B3 et B4 ne le sont pas. La copie appartient a celui qui a partage ; les autres membres de B ne peuvent que lui proposer des changements.
- **D03 (premiere proposition V2, une seule recette partagee par reference)** : viole B1. A amender.

## 3. Options

### O1 - Partage strict + copie libre

Partager = meme recette partout. Pour adapter, on copie : la copie devient independante, sans lien vivant.

- Couvre B1 et B2. B3 et B4 sont perdus (le lien n'est qu'une mention "copiee depuis").
- Tres simple. C'est presque la V1 sans la synchronisation.

### O2 - Adaptation liee (recommandee)

Deux gestes distincts dans l'interface :

- **Partager** : la meme recette apparait dans B. Les membres de B suggerent des modifications a l'auteur (ce qui change pour tous).
- **Adapter pour B** : cree une recette de B, **liee a l'original** (`adaptedFromId` + la revision de depart). Les membres de B la modifient selon les regles de B. L'original n'est jamais touche.

Le lien sert a deux choses :

- **Vers le bas (B3)** : quand l'original recoit une nouvelle revision, l'adaptation affiche "L'original a change depuis votre adaptation", avec un diff **limite a ce que B n'a pas modifie**. On applique chaque changement ou on l'ignore. Rien n'est automatique.
- **Vers le haut (B4)** : "Proposer a l'original" transforme une difference de l'adaptation en suggestion sur l'original.

Confidentialite (B5) : depuis l'original, l'auteur voit "adaptee dans 2 espaces" et les noms des espaces ; le contenu de l'adaptation n'est visible que pour les membres de cet espace.

- Couvre B1 a B5.
- Prerequis : les revisions (D05) et des **identifiants stables par ligne** d'ingredient et d'etape, pour comparer ligne a ligne et non sur du texte.
- Complexite moyenne, concentree dans un seul ecran : "comparer avec l'original".

### O3 - Calque local (surcharges par espace)

Une seule recette + une couche de surcharges par espace ("dans B : creme -> beurre").

- Couvre B1, B2, B3 (les changements de l'original passent automatiquement sous le calque).
- Mais : les etapes contiennent du texte ("ajouter la creme") que le calque ne sait pas reecrire ; l'edition devient confuse (je modifie la base ou le calque ?) ; le scaling, la liste de courses et le planning doivent tous resoudre le calque. **Deconseille.**

### O4 - Famille de versions

Une "famille" Gratin de pates regroupe N versions (creme, beurre...). Chaque espace choisit sa version par defaut et peut consulter les autres versions auxquelles il a acces.

- C'est O2 avec une presentation "toutes les versions cote a cote". Peut s'ajouter plus tard sur O2 sans changer le modele (la famille = l'arbre des `adaptedFromId`).

## 4. Recommandation

**O2 maintenant, O4 en option plus tard.** On garde deux verbes simples, partager et adapter ; aucune modification ne se propage en silence ; l'option "ne pas gerer le lien" reste possible (une adaptation dont on ignore les mises a jour se comporte comme une copie O1).

Si O2 parait trop lourde pour la V2.0 : livrer O1 en conservant `adaptedFromId` et la revision de depart en base. O2 pourra alors s'activer plus tard sans migration.

## 4bis. Perimetre retenu pour la V2.0

O2 allege : lien + revision de depart en base, badge "l'original a change", ecran de comparaison en lecture seule. La reprise ligne a ligne et la remontee automatique (B3/B4 complets) sont reportees ; le modele de donnees les permet sans migration.

## 5. Questions qui en decoulent

- Qui peut modifier une adaptation dans B : son createur seulement, ou tout membre de B (recette "de l'espace") ?
- Une adaptation peut-elle etre adaptee a son tour (chaine A -> B -> C) ? Proposition : oui, le lien pointe vers le parent direct.
- Si l'original est supprime, l'adaptation vit seule (le lien devient "original supprime").
