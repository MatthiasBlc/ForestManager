# Protocoles de tests manuels - Rework Tags (Phase 10)

> **Feature** : Tags 3 niveaux (Global / Communaute / Pending) + validation moderateurs + suggestions
> **Spec** : `SPEC_TAGS_REWORK.md`
> **Branche** : `TagsRework`

---

## Pre-requis

### Environnement

```bash
npm run docker:up:build
```

### Comptes necessaires

| Compte | Role | Comment l'obtenir |
|--------|------|-------------------|
| **SuperAdmin** | Administrateur plateforme | `npx ts-node scripts/createAdmin.ts` (dans container backend) |
| **UserA** | MODERATOR dans CommunauteAlpha | Creer communaute (auto-MODERATOR) |
| **UserB** | MEMBER dans CommunauteAlpha | Invite par UserA |
| **UserC** | MODERATOR dans CommunauteBeta | Creer CommunauteBeta |
| **UserD** | MEMBER dans CommunauteBeta, pas dans Alpha | Invite par UserC |

### Donnees de base

1. SuperAdmin cree 3 tags globaux : `dessert`, `rapide`, `vegetarien`
2. UserA cree CommunauteAlpha, invite UserB
3. UserC cree CommunauteBeta, invite UserD
4. Quelques recettes existent dans chaque communaute

---

## T1 - Tags globaux (SuperAdmin)

### T1.1 - Creation tag global

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Se connecter au panel admin | Dashboard admin visible |
| 2 | Aller dans "Tags" | Liste des tags avec filtre scope |
| 3 | Filtre scope = "Global" | Seuls les tags GLOBAL affiches |
| 4 | Creer un tag "italien" | Tag cree, scope=GLOBAL, status=APPROVED, visible dans la liste |
| 5 | Creer un tag "ITALIEN" (majuscules) | Erreur : nom deja utilise (normalisation lowercase) |
| 6 | Creer un tag " pizza " (espaces) | Tag "pizza" cree (trim applique) |

### T1.2 - Renommage et suppression tag global

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Renommer "pizza" en "pizzeria" | Tag renomme, nom mis a jour partout |
| 2 | Renommer "pizzeria" en "italien" | Erreur : nom deja utilise |
| 3 | Supprimer "pizzeria" | Tag supprime, retire de toutes les recettes associees |

### T1.3 - Fusion de tags globaux

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Creer tags "gateau" et "patisserie" | Les 2 tags existent |
| 2 | Associer "gateau" a 2 recettes | RecipeTags crees |
| 3 | Fusionner "gateau" dans "patisserie" | "gateau" supprime, ses RecipeTags pointent vers "patisserie" |

### T1.4 - Filtre scope dans panel admin

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Filtre "All" | Tags globaux + communaute visibles |
| 2 | Filtre "Global" | Seuls les tags scope=GLOBAL |
| 3 | Filtre "Community" | Seuls les tags scope=COMMUNITY (avec nom communaute) |
| 4 | Recherche "dess" | Tags dont le nom contient "dess" (ex: dessert) |

---

## T2 - Tags communaute (Moderateur)

### T2.1 - Creation tag communaute par moderateur

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Connecte en tant que UserA | Dashboard visible |
| 2 | Aller dans CommunauteAlpha > Tags (side panel) | Liste tags communaute (APPROVED + PENDING) |
| 3 | Creer tag "fait-maison" | Tag cree : scope=COMMUNITY, communityId=Alpha, status=APPROVED |
| 4 | Le tag apparait dans la liste | Status "Approved", nom affiche |
| 5 | Creer tag "dessert" (meme nom qu'un global) | Erreur : un tag global avec ce nom existe deja |
| 6 | Creer tag "fait-maison" a nouveau | Erreur : nom deja utilise dans cette communaute |

### T2.2 - Renommage et suppression tag communaute

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Renommer "fait-maison" en "artisanal" | Tag renomme |
| 2 | Supprimer "artisanal" | Tag supprime, hard delete RecipeTags associes |
| 3 | Verifier recettes qui avaient ce tag | Le tag n'apparait plus sur les recettes |

### T2.3 - Isolation entre communautes

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserA cree tag "special" dans Alpha | Tag cree dans Alpha |
| 2 | UserC cree tag "special" dans Beta | Tag cree dans Beta (pas de conflit) |
| 3 | Verifier que Alpha ne voit pas le tag de Beta | Le tag "special" de Beta n'apparait pas dans Alpha |

---

## T3 - Tags pending (creation par membre)

### T3.1 - Creation de tag inconnu sur recette communautaire

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Connecte en tant que UserB (MEMBER, Alpha) | Dashboard visible |
| 2 | Creer recette dans CommunauteAlpha | Formulaire recette communautaire |
| 3 | Ajouter tags : "dessert" (global), "epice" (inconnu) | Formulaire accepte les 2 tags |
| 4 | Sauvegarder la recette | Recette creee avec les 2 tags |
| 5 | Verifier tag "dessert" sur la recette | Style normal (badge couleur standard) |
| 6 | Verifier tag "epice" sur la recette | Style pending (badge different : gris, contour pointille ou label "pending") |
| 7 | Verifier en DB : tag "epice" | scope=COMMUNITY, communityId=Alpha, status=PENDING, createdById=UserB |

### T3.2 - Reutilisation d'un tag pending

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserB cree une 2eme recette dans Alpha avec tag "epice" | Pas de nouveau tag cree, reutilise le pending existant |
| 2 | UserA (moderateur) cree recette dans Alpha avec tag "epice" | Idem, reutilise le pending existant |
| 3 | Verifier en DB | Un seul tag "epice" PENDING, 3 RecipeTags pointent vers lui |

### T3.3 - Notification moderateur sur tag pending

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserB cree recette avec nouveau tag inconnu "fusion" | Tag pending cree |
| 2 | UserA (connecte, moderateur Alpha) | Recoit notification WebSocket `tag:pending` |
| 3 | Notification visible (toast ou indicateur) | Contenu : nom du tag, communaute |

### T3.4 - Validation de tag pending par moderateur

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserA va dans Alpha > Tags | Tag "epice" visible avec status=PENDING |
| 2 | Cliquer "Approve" sur "epice" | Tag passe en status=APPROVED |
| 3 | Verifier toutes les recettes ayant "epice" | Style normal (plus de badge pending) |
| 4 | UserB recoit notification `tag:approved` | Toast "Votre tag epice a ete valide" |

### T3.5 - Rejet de tag pending par moderateur

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserA va dans Alpha > Tags | Tag "fusion" visible avec status=PENDING |
| 2 | Cliquer "Reject" sur "fusion" | Tag hard delete |
| 3 | Verifier les recettes qui avaient "fusion" | Tag completement disparu (RecipeTags supprimes en cascade) |
| 4 | UserB recoit notification `tag:rejected` | Toast "Votre tag fusion a ete rejete" |

---

## T4 - Autocomplete scope-aware

### T4.1 - Autocomplete dans une communaute

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserB edite recette dans CommunauteAlpha | Formulaire edition |
| 2 | Champ tags : taper "des" | Suggestions : "dessert" (global), pas de tags d'autres communautes |
| 3 | Taper "fait" (si tag communaute Alpha "fait-maison" existe) | Suggestion : "fait-maison" (communaute Alpha) |
| 4 | Taper "spec" (si tag "special" existe aussi dans Beta) | Suggestion : "special" (Alpha uniquement, pas Beta) |
| 5 | Tags PENDING ne sont pas proposes dans l'autocomplete | Seuls APPROVED (global + communaute) |

### T4.2 - Autocomplete recette personnelle

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserB cree recette personnelle (hors communaute) | Formulaire creation |
| 2 | Champ tags : taper "des" | Suggestions : "dessert" (global) |
| 3 | Tags COMMUNITY des communautes de UserB sont proposes | Si showTags=true pour cette communaute |
| 4 | Tags COMMUNITY de communautes dont UserB n'est pas membre | Non proposes |

---

## T5 - Tag Suggestions (recette d'autrui)

### T5.1 - Suggestion d'un tag existant

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserA possede une recette dans Alpha | Recette visible par UserB |
| 2 | UserB ouvre la recette de UserA | Bouton "Suggest a tag" visible |
| 3 | UserB suggere le tag "rapide" (global, existe) | TagSuggestion creee : status=PENDING_OWNER |
| 4 | UserA recoit notification `tag-suggestion:new` | Toast visible |
| 5 | UserA ouvre sa recette > section suggestions | Suggestion "rapide" par UserB visible |
| 6 | UserA clique "Accept" | Tag "rapide" ajoute a la recette directement (existe deja) |
| 7 | TagSuggestion passe en APPROVED | Statut mis a jour |
| 8 | UserB recoit notification `tag-suggestion:approved` | Toast visible |

### T5.2 - Suggestion d'un tag inconnu (workflow 2 etapes)

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserB suggere "bio" sur recette de UserA (tag inconnu) | TagSuggestion : status=PENDING_OWNER |
| 2 | UserA accepte la suggestion | Tag "bio" cree en PENDING dans Alpha |
| 3 | TagSuggestion passe en PENDING_MODERATOR | En attente du moderateur |
| 4 | RecipeTag cree (tag pending, style different sur la recette) | Badge pending visible |
| 5 | Moderateurs Alpha recoivent notification `tag-suggestion:pending-mod` | Toast notification |
| 6 | UserA (moderateur) approuve le tag "bio" via Tags panel | Tag passe en APPROVED |
| 7 | TagSuggestion passe en APPROVED | Cascade terminee |
| 8 | Tag "bio" affiche en style normal sur la recette | Badge standard |

### T5.3 - Rejet de suggestion par owner

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserB suggere "micro-ondes" sur recette de UserA | TagSuggestion : status=PENDING_OWNER |
| 2 | UserA clique "Reject" sur la suggestion | TagSuggestion : status=REJECTED |
| 3 | Aucun tag cree | Pas de tag "micro-ondes" dans la DB |
| 4 | UserB recoit notification `tag-suggestion:rejected` | Toast visible |

### T5.4 - Rejet de tag pending apres suggestion acceptee

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserB suggere "exotique" (inconnu), UserA accepte | Tag "exotique" PENDING + TagSuggestion PENDING_MODERATOR |
| 2 | UserA (moderateur) rejette le tag "exotique" | Tag hard delete + RecipeTags supprimes |
| 3 | TagSuggestion passe en REJECTED | Cascade rejet moderateur |

### T5.5 - Cas limites suggestions

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserA essaie de suggerer un tag sur sa propre recette | Erreur TAG_007 : auto-suggestion interdite |
| 2 | UserB suggere "rapide" une 2eme fois (meme recette) | Erreur TAG_006 : suggestion deja existante |
| 3 | UserD (pas membre Alpha) essaie de suggerer sur recette Alpha | Erreur 403 : pas membre de la communaute |

---

## T6 - Fork inter-communaute et tags

### T6.1 - Fork avec tags globaux uniquement

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserA cree recette dans Alpha avec tags "dessert", "rapide" (globaux) | Recette creee |
| 2 | UserA partage (fork) vers Beta (UserA doit etre membre Beta) | Fork cree dans Beta |
| 3 | Verifier recette forkee dans Beta | Tags "dessert", "rapide" presents (globaux, copie directe) |

### T6.2 - Fork avec tag communaute connu dans la cible

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Creer tag "special" dans Alpha ET Beta (meme nom) | Les 2 tags existent |
| 2 | Recette dans Alpha avec tag "special" (Alpha) | Recette taguee |
| 3 | Fork vers Beta | Tag "special" de Beta utilise directement (pas de pending) |

### T6.3 - Fork avec tag communaute inconnu dans la cible

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserA cree tag "unique-alpha" dans Alpha | Tag communaute Alpha |
| 2 | Recette Alpha avec tag "unique-alpha" | Recette taguee |
| 3 | Fork vers Beta | Tag "unique-alpha" cree en PENDING dans Beta |
| 4 | Verifier recette forkee dans Beta | Tag "unique-alpha" affiche en style pending |
| 5 | Moderateurs Beta recoivent notification `tag:pending` | Notification recue |
| 6 | Moderateur Beta approuve | Tag passe en APPROVED dans Beta |

---

## T7 - Affichage et styles tags

### T7.1 - TagBadge styles

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Recette avec tag global APPROVED | Badge couleur standard (primary) |
| 2 | Recette avec tag communaute APPROVED | Badge couleur standard (primary) |
| 3 | Recette avec tag PENDING | Badge style different (gris, contour pointille, ou label "pending") |
| 4 | Recette dans la liste (RecipeCard) | Tags affiches avec bons styles |
| 5 | Recette en detail (RecipeDetailPage) | Tags affiches avec bons styles |

### T7.2 - Liste recettes avec filtres tags

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Page recettes communaute Alpha | Filtre tags disponible |
| 2 | Filtrer par tag "dessert" | Seules recettes avec tag "dessert" affichees |
| 3 | L'autocomplete du filtre propose global + communaute Alpha | Pas les tags d'autres communautes |

---

## T8 - Administration tags communaute (Moderateur)

### T8.1 - Acces au panneau tags

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserA (MODERATOR) ouvre CommunauteAlpha | Side panel avec onglet "Tags" visible |
| 2 | UserB (MEMBER) ouvre CommunauteAlpha | Onglet "Tags" non visible (ou lecture seule) |

### T8.2 - CRUD tags communaute

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Lister les tags | Tags APPROVED et PENDING affiches, avec status |
| 2 | Creer tag "saison" | Cree en APPROVED, visible dans la liste |
| 3 | Renommer "saison" en "saisonnier" | Nom mis a jour |
| 4 | Supprimer "saisonnier" | Tag supprime (hard delete), confirme par dialog |
| 5 | Filtrer par status "Pending" | Seuls les tags PENDING |
| 6 | Filtrer par status "Approved" | Seuls les tags APPROVED |
| 7 | Recherche par nom | Tags filtres par nom |

### T8.3 - Approve / Reject tags pending

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Tag pending "epice" dans la liste | Boutons Approve et Reject visibles |
| 2 | Approve "epice" | Status passe a APPROVED, notification au createur |
| 3 | Tag pending "fusion" dans la liste | Boutons visibles |
| 4 | Reject "fusion" | Tag supprime de la liste, notification au createur |

---

## T9 - Preferences utilisateur

### T9.1 - Visibilite tags communautaires (profil)

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserB ouvre la page Profil | Section "Tag Visibility" visible |
| 2 | Liste des communautes avec toggles | Alpha : toggle ON (defaut), Beta : non listee (pas membre) |
| 3 | Desactiver toggle pour Alpha | Toggle passe a OFF |
| 4 | Creer recette personnelle, ouvrir autocomplete tags | Tags communaute Alpha ne sont plus proposes |
| 5 | Reactiver toggle pour Alpha | Toggle passe a ON |
| 6 | Autocomplete tags perso | Tags communaute Alpha a nouveau proposes |

### T9.2 - Preferences notifications moderateur

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserA (MODERATOR Alpha) ouvre la page Profil | Section "Tag Notifications" visible |
| 2 | Toggle global : ON (defaut) | Checked |
| 3 | Toggle communaute Alpha : ON (defaut) | Checked |
| 4 | Desactiver toggle global | Passe a OFF |
| 5 | UserB cree tag inconnu dans Alpha | UserA ne recoit PAS de notification tag:pending |
| 6 | Reactiver toggle global, desactiver toggle Alpha | |
| 7 | UserB cree un autre tag inconnu dans Alpha | UserA ne recoit PAS de notification (preference communaute OFF) |
| 8 | Reactiver toggle Alpha | |
| 9 | UserB cree un autre tag inconnu | UserA recoit la notification |

### T9.3 - Section masquee pour non-moderateur

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserB (MEMBER, pas moderateur) ouvre page Profil | Section "Tag Notifications" absente |
| 2 | Section "Tag Visibility" presente si UserB est membre d'au moins 1 communaute | Visible avec toggles |

### T9.4 - Aucune communaute

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Nouvel utilisateur sans communaute ouvre Profil | Section "Tag Visibility" absente |
| 2 | Section "Tag Notifications" absente | Non moderateur |

---

## T10 - Notifications WebSocket temps reel

### T10.1 - Tableau recapitulatif des evenements

| Evenement | Declencheur | Destinataire | Verification |
|-----------|-------------|--------------|--------------|
| `tag:pending` | Membre cree tag inconnu sur recette comm. | Moderateurs (si notifs activees) | Toast / indicateur |
| `tag:approved` | Moderateur approuve tag pending | Createur du tag | Toast confirmation |
| `tag:rejected` | Moderateur rejette tag pending | Createur du tag | Toast info |
| `tag-suggestion:new` | Membre suggere tag sur recette d'autrui | Proprietaire recette | Toast |
| `tag-suggestion:approved` | Owner accepte suggestion | Auteur suggestion | Toast |
| `tag-suggestion:rejected` | Owner rejette suggestion | Auteur suggestion | Toast |
| `tag-suggestion:pending-mod` | Owner accepte suggestion mais tag inconnu | Moderateurs | Toast |

### T10.2 - Test multi-onglets

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Ouvrir 2 onglets : UserA et UserB | Les 2 connectes via WebSocket |
| 2 | UserB cree tag inconnu dans Alpha | UserA (onglet) recoit toast notification en temps reel |
| 3 | UserA approuve le tag | UserB (onglet) recoit toast confirmation en temps reel |

---

## T11 - Recettes orphelines et tags

### T11.1 - Createur quitte la communaute

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserB a cree recettes dans Alpha avec tags (approved + pending) | Recettes et tags existent |
| 2 | UserB quitte CommunauteAlpha | Recettes deviennent orphelines |
| 3 | Verifier tags APPROVED sur recettes orphelines | Restent en place |
| 4 | Verifier tags PENDING sur recettes orphelines | Restent en place (moderateur peut toujours valider/rejeter) |
| 5 | TagSuggestions PENDING_OWNER sur recettes de UserB | Auto-rejetees (plus de proprietaire) |

---

## T12 - Limites et validation

### T12.1 - Limites tags

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Creer recette avec 10 tags | OK, maximum atteint |
| 2 | Essayer d'ajouter un 11eme tag | Erreur TAG_003 : limite de tags atteinte |
| 3 | Moderateur cree 100 tags dans une communaute | OK, maximum communaute atteint |
| 4 | Essayer de creer un 101eme tag | Erreur TAG_003 : limite de tags communaute atteinte |

### T12.2 - Validation nom

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | Creer tag avec 1 caractere | Erreur : minimum 2 caracteres |
| 2 | Creer tag avec 51 caracteres | Erreur : maximum 50 caracteres |
| 3 | Creer tag " PASTA " | Tag cree en "pasta" (trim + lowercase) |

---

## T13 - Permissions et securite

### T13.1 - MEMBER ne peut pas administrer les tags

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserB (MEMBER) essaie d'approuver un tag pending (via API directe) | 403 TAG_004 |
| 2 | UserB essaie de creer un tag communaute (via API directe) | 403 TAG_004 |
| 3 | UserB essaie de supprimer un tag (via API directe) | 403 TAG_004 |

### T13.2 - Moderateur ne peut pas toucher aux tags globaux

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserA (MODERATOR) essaie de renommer tag global "dessert" (via API) | 403 TAG_005 |
| 2 | UserA essaie de supprimer tag global (via API) | 403 TAG_005 |

### T13.3 - Moderateur ne peut agir que sur sa communaute

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserA (MODERATOR Alpha) essaie d'administrer tags de Beta (via API) | 403 : pas membre / pas moderateur |

### T13.4 - Notification preferences (non-moderateur)

| # | Action | Resultat attendu |
|---|--------|------------------|
| 1 | UserB (MEMBER) essaie PUT notification-preferences/tags (via API) | 403 : non moderateur |
| 2 | GET notification-preferences retourne communities vide pour non-moderateur | `{ global: ..., communities: [] }` |

---

## Checklist de validation finale

- [ ] T1 - Tags globaux (SuperAdmin) : CRUD, fusion, filtre scope
- [ ] T2 - Tags communaute (Moderateur) : CRUD, isolation inter-communautes
- [ ] T3 - Tags pending : creation, reutilisation, notification, approve, reject
- [ ] T4 - Autocomplete scope-aware : communaute et catalogue perso
- [ ] T5 - Tag suggestions : existant, inconnu, rejet owner, rejet moderateur, cas limites
- [ ] T6 - Fork inter-communaute : global, connu, inconnu
- [ ] T7 - Affichage et styles : TagBadge, filtres
- [ ] T8 - Administration tags communaute : panneau moderateur
- [ ] T9 - Preferences : visibilite tags, notifications moderateur
- [ ] T10 - Notifications WebSocket temps reel
- [ ] T11 - Recettes orphelines et tags
- [ ] T12 - Limites et validation
- [ ] T13 - Permissions et securite
