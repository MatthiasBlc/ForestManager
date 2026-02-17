# User Stories - Forest Manager

## Priorites

- **P0** - Critique (MVP bloquant)
- **P1** - Important (MVP)
- **P2** - Souhaite (post-MVP)
- **P3** - Bonus (futur)

---

## Epic 0: SuperAdmin & Briques (NOUVEAU - Plateforme)

### US-0.1 Creation compte SuperAdmin via CLI [P0 - Critique]
**En tant que** administrateur systeme
**Je veux** creer un compte SuperAdmin via CLI
**Afin de** securiser la creation de comptes privilegies

**Criteres d'acceptation:**
- [ ] Commande `npm run admin:create` disponible
- [ ] Prompt pour username, email, password
- [ ] Password hashe avec bcrypt
- [ ] Secret TOTP genere automatiquement
- [ ] Compte cree avec totpEnabled = false
- [ ] Aucune API publique pour creer un admin

---

### US-0.2 Connexion SuperAdmin avec 2FA [P0 - Critique]
**En tant que** SuperAdmin
**Je veux** me connecter avec 2FA TOTP
**Afin de** securiser l'acces administration

**Premiere connexion:**
- [ ] Saisie username + password
- [ ] Affichage QR code + secret TOTP
- [ ] Scan avec Google Authenticator
- [ ] Verification du token TOTP
- [ ] Activation 2FA (totpEnabled = true)
- [ ] Session admin creee

**Connexions suivantes:**
- [ ] Saisie username + password + token TOTP
- [ ] Verification des trois elements
- [ ] Session admin creee
- [ ] Cookie admin.sid (isole de connect.sid)

---

### US-0.3 Gestion globale des Tags [P0 - Critique]
**En tant que** SuperAdmin
**Je veux** gerer les tags globalement
**Afin de** maintenir une taxonomie propre

**Criteres d'acceptation:**
- [ ] Liste de tous les tags avec nombre de recettes
- [ ] Creer un nouveau tag
- [ ] Renommer un tag
- [ ] Supprimer un tag (hard delete)
- [ ] Fusionner deux tags (merge source → target)
- [ ] Actions loguees dans AdminActivityLog

---

### US-0.4 Gestion globale des Ingredients [P0 - Critique]
**En tant que** SuperAdmin
**Je veux** gerer les ingredients globalement
**Afin de** maintenir une base propre

**Criteres d'acceptation:**
- [ ] Liste de tous les ingredients avec nombre de recettes
- [ ] Creer un nouvel ingredient
- [ ] Renommer un ingredient
- [ ] Supprimer un ingredient
- [ ] Fusionner deux ingredients
- [ ] Actions loguees dans AdminActivityLog

---

### US-0.5 Gestion des communautes (Admin global) [P1 - Important]
**En tant que** SuperAdmin
**Je veux** gerer toutes les communautes
**Afin de** administrer la plateforme

**Criteres d'acceptation:**
- [ ] Liste de toutes les communautes avec stats
- [ ] Detail complet d'une communaute (membres, features, activite)
- [ ] Renommer une communaute
- [ ] Supprimer une communaute (soft delete avec cascade)
- [ ] Actions loguees dans AdminActivityLog

---

### US-0.6 Gestion des Features (Briques) [P0 - Critique]
**En tant que** SuperAdmin
**Je veux** gerer les features disponibles
**Afin de** controler les fonctionnalites de la plateforme

**Criteres d'acceptation:**
- [ ] Liste des features avec nombre de communautes
- [ ] Creer une nouvelle feature (code, nom, description)
- [ ] Modifier nom/description d'une feature
- [ ] Feature MVP avec isDefault = true

---

### US-0.7 Attribuer/Revoquer une Feature [P0 - Critique]
**En tant que** SuperAdmin
**Je veux** attribuer ou revoquer une feature a une communaute
**Afin de** controler l'acces aux fonctionnalites

**Criteres d'acceptation:**
- [ ] Voir les features d'une communaute
- [ ] Voir les features disponibles (non attribuees)
- [ ] Attribuer une feature
- [ ] Revoquer une feature (sauf MVP/default)
- [ ] Actions loguees dans AdminActivityLog

---

### US-0.8 Attribution automatique Feature MVP [P0 - Critique]
**En tant que** utilisateur creant une communaute
**Je veux** que la feature MVP soit automatiquement attribuee
**Afin d'** avoir les fonctionnalites de base

**Criteres d'acceptation:**
- [ ] A la creation d'une communaute
- [ ] Toutes les features avec isDefault = true sont attribuees
- [ ] grantedById = null (auto-attribue)

---

### US-0.9 Dashboard SuperAdmin [P1 - Important]
**En tant que** SuperAdmin
**Je veux** voir des statistiques globales
**Afin de** monitorer la plateforme

**Criteres d'acceptation:**
- [ ] Nombre total d'utilisateurs (+ actifs 30j, + nouveaux 7j)
- [ ] Nombre total de communautes (+ actives 30j)
- [ ] Nombre total de recettes (+ nouvelles 7j)
- [ ] Propositions en attente
- [ ] Repartition des features attribuees

---

### US-0.10 Journal d'activite admin [P1 - Important]
**En tant que** SuperAdmin
**Je veux** voir l'historique des actions admin
**Afin de** auditer les operations

**Criteres d'acceptation:**
- [ ] Liste chronologique des actions admin
- [ ] Filtre par type d'action
- [ ] Filtre par admin (si plusieurs)
- [ ] Detail: qui, quoi, quand, cible

---

## Epic 1: Authentification & Profil

### US-1.1 Inscription [P0 - Critique]
**En tant que** visiteur
**Je veux** creer un compte
**Afin de** pouvoir utiliser l'application

**Criteres d'acceptation:**
- [ ] Formulaire avec email, username, password
- [ ] Validation des champs (format email, longueur password)
- [ ] Message d'erreur si email/username deja utilise
- [ ] Redirection vers page d'accueil apres inscription
- [ ] Session automatiquement creee

---

### US-1.2 Connexion [P0 - Critique]
**En tant que** utilisateur inscrit
**Je veux** me connecter a mon compte
**Afin de** acceder a mes recettes et communautes

**Criteres d'acceptation:**
- [ ] Formulaire avec email et password
- [ ] Message d'erreur si identifiants incorrects
- [ ] Redirection vers dashboard apres connexion
- [ ] Session persistee (cookie)

---

### US-1.3 Deconnexion [P0 - Critique]
**En tant que** utilisateur connecte
**Je veux** me deconnecter
**Afin de** securiser mon compte

**Criteres d'acceptation:**
- [ ] Bouton de deconnexion visible
- [ ] Session detruite
- [ ] Redirection vers page d'accueil

---

### US-1.4 Voir mon profil [P1 - Important]
**En tant que** utilisateur connecte
**Je veux** voir mon profil
**Afin de** consulter mes informations

**Criteres d'acceptation:**
- [ ] Affichage username, email, date d'inscription
- [ ] Nombre de recettes personnelles
- [ ] Liste des communautes rejointes

---

## Epic 2: Catalogue Personnel

### US-2.1 Creer une recette personnelle [P0 - Critique]
**En tant que** utilisateur connecte
**Je veux** creer une recette dans mon catalogue
**Afin de** sauvegarder mes recettes

**Criteres d'acceptation:**
- [ ] Formulaire: titre, contenu, tags (multi-select), image (optionnel)
- [ ] Editeur de contenu (markdown ou rich text)
- [ ] Gestion des ingredients (ajout/suppression dynamique)
- [ ] Validation des champs
- [ ] Confirmation de creation

---

### US-2.2 Voir mes recettes personnelles [P0 - Critique]
**En tant que** utilisateur connecte
**Je veux** voir la liste de mes recettes
**Afin de** retrouver mes creations

**Criteres d'acceptation:**
- [ ] Liste paginee de mes recettes
- [ ] Affichage: titre, image, tags, date
- [ ] Filtre par tags
- [ ] Recherche par titre

---

### US-2.3 Modifier ma recette [P1 - Important]
**En tant que** createur d'une recette
**Je veux** modifier ma recette
**Afin de** corriger ou ameliorer

**Criteres d'acceptation:**
- [ ] Acces au formulaire d'edition
- [ ] Pre-remplissage des champs
- [ ] Sauvegarde des modifications

---

### US-2.4 Supprimer ma recette [P1 - Important]
**En tant que** createur d'une recette
**Je veux** supprimer ma recette
**Afin de** nettoyer mon catalogue

**Criteres d'acceptation:**
- [ ] Confirmation avant suppression
- [ ] Soft delete (pas de suppression definitive)
- [ ] Message de confirmation

---

## Epic 3: Communautes

### US-3.1 Creer une communaute [P0 - Critique]
**En tant que** utilisateur connecte
**Je veux** creer une communaute
**Afin de** partager des recettes avec un groupe

**Criteres d'acceptation:**
- [ ] Formulaire: nom, description
- [ ] Je deviens admin automatiquement
- [ ] Redirection vers la page de la communaute

---

### US-3.2 Voir mes communautes [P0 - Critique]
**En tant que** utilisateur connecte
**Je veux** voir mes communautes
**Afin de** y acceder rapidement

**Criteres d'acceptation:**
- [ ] Liste de mes communautes avec mon role
- [ ] Indicateur: nombre de membres, nombre de recettes
- [ ] Acces direct a chaque communaute

---

### US-3.3 Voir une communaute [P0 - Critique]
**En tant que** membre d'une communaute
**Je veux** voir la page de la communaute
**Afin de** consulter son contenu

**Criteres d'acceptation:**
- [ ] Nom, description
- [ ] Liste des membres (avec roles)
- [ ] Liste des recettes
- [ ] Mon role affiche
- [ ] Acces refuse si non-membre

---

### US-3.4 Quitter une communaute [P1 - Important]
**En tant que** membre d'une communaute
**Je veux** quitter la communaute
**Afin de** ne plus y participer

**Criteres d'acceptation:**
- [ ] Confirmation avant depart
- [ ] Si dernier admin avec d'autres membres: blocage + message
- [ ] Si seul membre: suppression de la communaute
- [ ] Perte d'acces immediate

---

### US-3.5 Modifier la communaute (Admin) [P1 - Important]
**En tant qu'** admin d'une communaute
**Je veux** modifier nom et description
**Afin de** tenir a jour les informations

**Criteres d'acceptation:**
- [ ] Formulaire d'edition
- [ ] Seuls les admins peuvent modifier
- [ ] Sauvegarde des modifications

---

## Epic 4: Systeme d'invitation (NOUVEAU)

### US-4.1 Inviter un utilisateur [P0 - Critique]
**En tant qu'** admin d'une communaute
**Je veux** inviter un utilisateur a rejoindre
**Afin d'** agrandir la communaute

**Criteres d'acceptation:**
- [ ] Recherche par username ou email
- [ ] Autocomplete des utilisateurs existants
- [ ] Erreur si utilisateur deja membre
- [ ] Erreur si invitation deja en attente
- [ ] Invitation creee avec status PENDING
- [ ] Activite loggee (INVITE_SENT)

---

### US-4.2 Voir mes invitations recues [P0 - Critique]
**En tant que** utilisateur connecte
**Je veux** voir les invitations que j'ai recues
**Afin de** decider si je veux rejoindre ces communautes

**Criteres d'acceptation:**
- [ ] Liste des invitations PENDING
- [ ] Informations: nom communaute, description, inviteur
- [ ] Boutons accepter/refuser
- [ ] Badge de notification si nouvelles invitations

---

### US-4.3 Accepter une invitation [P0 - Critique]
**En tant que** utilisateur invite
**Je veux** accepter une invitation
**Afin de** rejoindre la communaute

**Criteres d'acceptation:**
- [ ] Clic sur bouton "Accepter"
- [ ] Je deviens MEMBER de la communaute
- [ ] Invitation marquee ACCEPTED
- [ ] Activite loggee (INVITE_ACCEPTED, USER_JOINED)
- [ ] Redirection vers la communaute

---

### US-4.4 Refuser une invitation [P1 - Important]
**En tant que** utilisateur invite
**Je veux** refuser une invitation
**Afin de** decliner la proposition

**Criteres d'acceptation:**
- [ ] Clic sur bouton "Refuser"
- [ ] Invitation marquee REJECTED
- [ ] Activite loggee (INVITE_REJECTED)
- [ ] L'invitation disparait de ma liste

---

### US-4.5 Voir les invitations envoyees (Admin) [P1 - Important]
**En tant qu'** admin d'une communaute
**Je veux** voir les invitations en cours
**Afin de** suivre les invitations envoyees

**Criteres d'acceptation:**
- [ ] Liste des invitations avec status
- [ ] Filtrer par status (PENDING, ACCEPTED, REJECTED, CANCELLED)
- [ ] Informations: invitee, inviter, date

---

### US-4.6 Annuler une invitation (Admin) [P1 - Important]
**En tant qu'** admin d'une communaute
**Je veux** annuler une invitation en attente
**Afin de** retirer une invitation erronee

**Criteres d'acceptation:**
- [ ] Bouton annuler sur invitations PENDING uniquement
- [ ] Invitation marquee CANCELLED
- [ ] Activite loggee (INVITE_CANCELLED)
- [ ] L'invitation disparait de la liste de l'invite

---

## Epic 5: Gestion des membres

### US-5.1 Promouvoir un membre (Admin) [P1 - Important]
**En tant qu'** admin d'une communaute
**Je veux** promouvoir un membre en admin
**Afin de** deleguer la gestion

**Criteres d'acceptation:**
- [ ] Bouton "Promouvoir" sur chaque MEMBER
- [ ] Confirmation avant promotion
- [ ] Le membre devient ADMIN
- [ ] Pas de retrogradation possible
- [ ] Activite loggee (USER_PROMOTED)

---

### US-5.2 Retirer un membre (Admin) [P1 - Important] (NOUVEAU)
**En tant qu'** admin d'une communaute
**Je veux** retirer un membre
**Afin de** gerer la composition du groupe

**Criteres d'acceptation:**
- [ ] Bouton "Retirer" visible uniquement sur les MEMBER (pas sur les ADMIN)
- [ ] Confirmation avant retrait
- [ ] Le membre perd immediatement l'acces
- [ ] Activite loggee (USER_KICKED)
- [ ] Message clair que les ADMIN ne peuvent pas etre retires

---

## Epic 6: Recettes Communautaires

### US-6.1 Creer une recette dans une communaute [P0 - Critique]
**En tant que** membre d'une communaute
**Je veux** creer une recette dans la communaute
**Afin de** la partager avec les membres

**Criteres d'acceptation:**
- [ ] Meme formulaire que recette personnelle
- [ ] Creation automatique d'une copie dans mon catalogue
- [ ] Activite loggee dans le feed (RECIPE_CREATED)
- [ ] La recette apparait dans la liste communaute

---

### US-6.2 Voir les recettes d'une communaute [P0 - Critique]
**En tant que** membre d'une communaute
**Je veux** voir les recettes partagees
**Afin de** decouvrir des idees

**Criteres d'acceptation:**
- [ ] Liste paginee
- [ ] Filtre par tags
- [ ] Affichage du createur
- [ ] Recherche par titre

---

### US-6.3 Voir les details d'une recette communautaire [P0 - Critique]
**En tant que** membre d'une communaute
**Je veux** voir le detail d'une recette
**Afin de** la cuisiner

**Criteres d'acceptation:**
- [ ] Titre, contenu, ingredients
- [ ] Createur, date
- [ ] Tags
- [ ] Liste deroulante des variantes (si existantes)
- [ ] Badge si c'est un fork (origine affichee)

---

### US-6.4 Modifier ma recette communautaire [P1 - Important]
**En tant que** createur d'une recette communautaire
**Je veux** modifier ma recette
**Afin de** corriger ou ameliorer

**Criteres d'acceptation:**
- [ ] Seul le createur peut modifier directement
- [ ] Les autres membres doivent proposer une modification

---

## Epic 7: Propositions & Variantes

### US-7.1 Proposer une mise a jour [P1 - Important]
**En tant que** membre d'une communaute
**Je veux** proposer une modification sur une recette
**Afin d'** ameliorer la recette

**Criteres d'acceptation:**
- [ ] Bouton "Proposer une modification" (pas sur mes propres recettes)
- [ ] Formulaire pre-rempli avec contenu actuel
- [ ] Modification du titre et/ou contenu
- [ ] Soumission de la proposition
- [ ] Activite loggee (VARIANT_PROPOSED)

---

### US-7.2 Voir les propositions sur mes recettes [P1 - Important] (UPGRADE de P3)
**En tant que** createur de recettes
**Je veux** voir les propositions recues sur mes recettes
**Afin de** les evaluer et y repondre

**Criteres d'acceptation:**
- [ ] Feed personnel avec propositions recues
- [ ] Filtrer par status (PENDING, ACCEPTED, REJECTED)
- [ ] Detail de chaque proposition (proposeur, contenu)
- [ ] Actions: Accepter / Refuser
- [ ] Notification visuelle des nouvelles propositions

---

### US-7.3 Accepter une proposition [P1 - Important]
**En tant que** createur d'une recette
**Je veux** accepter une proposition
**Afin de** mettre a jour ma recette

**Criteres d'acceptation:**
- [ ] Comparaison avant/apres
- [ ] Confirmation avant acceptation
- [ ] Mise a jour de la recette communautaire
- [ ] Mise a jour de la recette personnelle liee
- [ ] Proposition marquee ACCEPTED
- [ ] Activite loggee (PROPOSAL_ACCEPTED)

---

### US-7.4 Refuser une proposition [P1 - Important]
**En tant que** createur d'une recette
**Je veux** refuser une proposition
**Afin de** garder ma version originale

**Criteres d'acceptation:**
- [ ] Confirmation avant refus
- [ ] Creation automatique d'une variante (nouvelle recette)
- [ ] Variante attribuee au proposeur
- [ ] Variante liee a l'originale (originRecipeId, isVariant=true)
- [ ] Proposition marquee REJECTED
- [ ] Activite loggee (VARIANT_CREATED)

---

### US-7.5 Voir les variantes d'une recette [P1 - Important]
**En tant que** membre d'une communaute
**Je veux** voir les variantes d'une recette
**Afin de** decouvrir des alternatives

**Criteres d'acceptation:**
- [ ] Liste deroulante sur la page recette
- [ ] Clic → navigation vers la variante
- [ ] Indication du createur de chaque variante
- [ ] Tri par date de creation

---

## Epic 8: Partage Inter-Communautes

### US-8.1 Fork une recette vers une autre communaute [P2 - Normal]
**En tant que** membre de plusieurs communautes
**Je veux** partager une recette d'une communaute a une autre
**Afin de** diffuser une bonne recette

**Criteres d'acceptation:**
- [ ] Bouton "Partager dans une autre communaute"
- [ ] Selection de la communaute cible (parmi celles ou je suis membre)
- [ ] Verification: admin source OU admin cible OU createur
- [ ] Creation d'une copie independante
- [ ] Tracabilite: originRecipeId, sharedFromCommunityId
- [ ] Je deviens createur de la copie
- [ ] Activite loggee dans les deux communautes (RECIPE_SHARED)

---

### US-8.2 Voir l'origine d'une recette forkee [P2 - Normal]
**En tant que** membre d'une communaute
**Je veux** voir d'ou vient une recette forkee
**Afin de** connaitre son origine

**Criteres d'acceptation:**
- [ ] Badge "Partage depuis [Communaute X]" si applicable
- [ ] Lien vers la communaute d'origine (si j'y ai acces)

---

## Epic 9: Activity Feed

### US-9.1 Voir le feed d'une communaute [P1 - Important]
**En tant que** membre d'une communaute
**Je veux** voir l'activite recente
**Afin de** suivre ce qui se passe

**Criteres d'acceptation:**
- [ ] Liste chronologique des evenements
- [ ] Types: nouvelle recette, proposition, variante creee, nouveau membre, depart
- [ ] Pagination ou infinite scroll
- [ ] Lien vers l'element concerne

---

### US-9.2 Voir mon feed personnel [P1 - Important] (UPGRADE de P3)
**En tant que** utilisateur connecte
**Je veux** voir l'activite sur mes recettes et mes invitations
**Afin de** etre informe des interactions

**Criteres d'acceptation:**
- [ ] Propositions recues sur mes recettes
- [ ] Variantes creees a partir de mes recettes
- [ ] Invitations recues
- [ ] Decisions sur mes propositions
- [ ] Pagination

---

## Epic 10: Tags & Recherche

### US-10.1 Ajouter des tags a une recette [P1 - Important]
**En tant que** createur d'une recette
**Je veux** ajouter des tags
**Afin de** categoriser ma recette

**Criteres d'acceptation:**
- [ ] Selection parmi tags existants (autocomplete)
- [ ] Creation de nouveau tag a la volee
- [ ] Maximum 10 tags par recette

---

### US-10.2 Filtrer par tags [P1 - Important]
**En tant que** utilisateur
**Je veux** filtrer les recettes par tags
**Afin de** trouver ce que je cherche

**Criteres d'acceptation:**
- [ ] Liste des tags disponibles (avec compteur)
- [ ] Selection multiple
- [ ] Resultats filtres en temps reel

---

### US-10.3 Rechercher par titre [P1 - Important]
**En tant que** utilisateur
**Je veux** rechercher des recettes par titre
**Afin de** retrouver une recette specifique

**Criteres d'acceptation:**
- [ ] Champ de recherche avec debounce
- [ ] Resultats filtres en temps reel

---

## Resume des priorites

| Priorite | Description | User Stories |
|----------|-------------|--------------|
| **P0 - Critique** | Indispensable au MVP | US-0.1 a US-0.4, US-0.6 a US-0.8, US-1.1 a US-1.3, US-2.1 a US-2.2, US-3.1 a US-3.3, US-4.1 a US-4.3, US-6.1 a US-6.3 |
| **P1 - Important** | Important pour l'experience | US-0.5, US-0.9, US-0.10, US-1.4, US-2.3 a US-2.4, US-3.4 a US-3.5, US-4.4 a US-4.6, US-5.1 a US-5.2, US-6.4, US-7.1 a US-7.5, US-9.1 a US-9.2, US-10.1 a US-10.3 |
| **P2 - Normal** | Ajout de valeur | US-8.1 a US-8.2 |
| **P3 - Bonus** | Futur | Analytics visibles, Notifications push, Export recettes, Nouvelles briques |

---

## Changements par rapport a la version precedente

1. **Epic 0 - SuperAdmin & Briques** - Nouveau (P0)
   - Comptes SuperAdmin isoles avec 2FA TOTP
   - Creation via CLI uniquement (`npm run admin:create`)
   - Gestion globale tags/ingredients/communautes
   - Systeme de briques (Features) attribuables aux communautes
   - Feature MVP attribuee automatiquement
   - Dashboard et audit log admin

2. **Systeme d'invitation** (Epic 4) - Nouveau
   - Invitations avec acceptation explicite
   - Workflow complet: envoyer, accepter, refuser, annuler

3. **Retirer un membre** (US-5.2) - Nouveau
   - Admin peut kick un MEMBER (mais pas un ADMIN)

4. **Feed personnel** (US-9.2) - Upgrade de P3 a P1
   - Inclus dans le MVP pour voir les propositions sur ses recettes

5. **Reorganisation des epics**
   - Epic 0 = SuperAdmin & Briques (nouveau)
   - Epic 1-3 = Auth, Catalogue, Communautes
   - Epic 4 = Invitations (nouveau)
   - Epic 5 = Gestion des membres
   - Epic 6-10 = Recettes, Propositions, Partage, Feed, Tags
