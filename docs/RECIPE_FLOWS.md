# Flux recettes — Reference complete

Ce document decrit tous les types de recettes possibles, les transitions entre eux, et les regles de permission associees.

---

## 1. Types de recettes (champs discriminants)

| Champ                   | Valeur  | Signification                            |
| ----------------------- | ------- | ---------------------------------------- |
| `communityId`           | `null`  | Recette personnelle                      |
| `communityId`           | UUID    | Recette communautaire                    |
| `isVariant`             | `false` | Recette "canonique"                      |
| `isVariant`             | `true`  | Variante (nee d'un refus de proposition) |
| `originRecipeId`        | `null`  | Racine (pas d'ancetre)                   |
| `originRecipeId`        | UUID    | Enfant d'une autre recette               |
| `sharedFromCommunityId` | `null`  | Creee localement ou publiee depuis perso |
| `sharedFromCommunityId` | UUID    | Forkee depuis cette communaute           |

---

## 2. Points d'entree — Creation

```
                              POINT D'ENTREE
                                    |
          .---------------------------.-------------------.
          |                           |                   |
    POST /api/recipes/    POST /communities/:id/recipes  POST /recipes/import-url
          |                           |                   |
          v                           v                   v
   [PERSONNELLE]             [COMMUNAUTAIRE NATIVE]   [PERSONNELLE]
   comId: null               comId: X                 comId: null
   origin: null              origin: perso.id         origin: null
   variant: false            variant: false           variant: false

   Note : la creation communautaire cree deux recettes en une transaction atomique :
     1. une recette personnelle (communityId: null)
     2. une copie communautaire (communityId: X, originRecipeId: perso.id)
```

---

## 3. Arbre des possibilites

### Depuis une recette PERSONNELLE

```
   [PERSONNELLE]
   comId: null
        |
        |-- publish -> com X, Y, Z...  (owner uniquement)
        |   POST /api/recipes/:id/publish
        |
        v
   [COPIE COMMUNAUTAIRE]  x N communautes en une seule requete
   comId: X
   origin: perso.id
   sharedFrom: null
   variant: false
        |
        '-- (meme comportement que COMMUNAUTAIRE, voir section suivante)

   Ce que la PERSONNELLE NE PEUT PAS faire :
     x share  (SHARE_002 : communityId est null)
     x recevoir des proposals  (PROPOSAL_001 : communityId est null)
```

### Depuis une recette COMMUNAUTAIRE (native, publiee ou forkee)

```
   [COMMUNAUTAIRE]
   comId: X
   variant: false
   -- native  : origin = personal.id, sharedFrom = null
   -- publiee : origin = personal.id, sharedFrom = null
   -- forkee  : origin = source.id,   sharedFrom = comSource
        |
        .------------------------.--------------------------.
        |                        |                         |
        v                        v                         v
   [SHARE -> com Y]        [PROPOSAL]                [EDIT / DELETE]
   POST .../share          POST .../proposals         owner ou membre
        |                       |
        v                  .----'----.
   [FORK]                  |        |
   comId: Y          [ACCEPT]   [REJECT]
   origin: src.id        |          |
   sharedFrom: X         |          v
   variant: false        |    [VARIANTE]
        |                |    comId: X (meme com)
        |         mise a jour  origin: recette.id
        |         in-place     sharedFrom: null
        |         de la        variant: true
        |         recette      creatorId: proposeur
        |         originale    steps/ing: proposedXxx
        |                      tags: copies de l'original
        |                           |
        |             .-------------'
        |             |  La VARIANTE herite des memes droits
        |             |  qu'une recette communautaire :
        |             |    ok peut recevoir des proposals  (aucun check isVariant)
        |             |    ok peut etre partagee/forkee    (aucun check isVariant)
        |             |    ok peut etre editee / supprimee
        |             v
        |        [FORK de variante]  -> meme comportement recursif
        |
        v
   [FORK (com Y)]  -> meme comportement recursif
     ok proposals
     ok fork encore vers com Z
     ok variante
```

---

## 4. Tableau de synthese des permissions

| Type de recette | Share -> com | Publish -> com | Recevoir proposal | Editer       | Supprimer    |
| --------------- | ------------ | -------------- | ----------------- | ------------ | ------------ |
| Personnelle     | non          | oui (owner)    | non               | owner        | owner        |
| Communautaire   | oui \*       | non            | oui \*\*          | owner/membre | owner/membre |
| Fork (partagee) | oui \*       | non            | oui \*\*          | owner/membre | owner/membre |
| Variante        | oui \*       | non            | oui \*\*          | owner/membre | owner/membre |

```
*  createur de la recette  OU  moderateur dans la com source  OU  moderateur dans la com cible
** tout membre de la communaute, sauf le createur de la recette lui-meme
```

---

## 5. Arbre de parente (chaine originRecipeId)

```
[Recette perso]  <--- racine de la famille
      |
      |-- originRecipeId --> [Recette com A]   (creation directe ou publish)
      |                            |
      |                            |-- originRecipeId --> [Fork com B]
      |                            |                      sharedFromCommunityId: A
      |                            |                            |
      |                            |                            '--> [Fork com C]
      |                            |                                 sharedFromCommunityId: B
      |                            |
      |                            '-- originRecipeId --> [Variante com A]
      |                                                   isVariant: true
      |                                                         |
      |                                                         '--> [Fork de variante com D]
      |
      '-- originRecipeId --> [Recette com X]   (publish vers autre communaute)
                                   |
                                   '--> originRecipeId --> [Fork com Z]

Analytics : getRecipeFamilyCommunities remonte jusqu'a la racine (BFS),
            updateAncestorAnalytics incremente shares++ sur toute la chaine lors d'un fork.
```

---

## 6. Resolution des tags lors d'un fork / publish

```
Tag GLOBAL      ---------------------------------> GLOBAL (inchange)

Tag COMMUNITY   -- tag APPROVED existe dans com cible ? --> lie directement (APPROVED)
(com source)    -- tag absent dans com cible ?          --> cree PENDING dans com cible
                                                            (attend approbation moderateur)
                                                            Notification -> moderateurs
```

---

## 7. Regles metier notables

- Un fork vers une communaute deja destinataire de cette recette est bloque (SHARE_006).
- Le publish skip silencieusement les communautes deja couvertes (pas d'erreur, juste ignorees).
- Une variante peut elle-meme etre forkee ou recevoir des proposals — il n'y a pas de profondeur maximale dans le code.
- Le publish ne peut cibler qu'une recette avec `communityId === null` (PUBLISH_002) — impossible de "re-publier" une recette deja communautaire.
- Les proposals ne sont pas possibles sur une recette personnelle (PROPOSAL_001).
- Lors d'un REJECT de proposal, la variante creee recoit les tags de la recette originale (pas les tags proposes).
