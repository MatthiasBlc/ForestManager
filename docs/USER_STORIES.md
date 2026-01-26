# User Stories - Forest Manager

## Vue d'ensemble

Ce document liste toutes les user stories pour le développement du MVP de Forest Manager, organisées par epic et priorité.

---

## Epic 1: Authentification & Profil

### US-1.1 Inscription [P0 - Critique]
**En tant que** visiteur
**Je veux** créer un compte
**Afin de** pouvoir utiliser l'application

**Critères d'acceptation:**
- [ ] Formulaire avec email, username, password
- [ ] Validation des champs (format email, username unique, password min 8 chars)
- [ ] Message d'erreur si email/username déjà utilisé
- [ ] Connexion automatique après inscription
- [ ] Redirection vers le dashboard

---

### US-1.2 Connexion [P0 - Critique]
**En tant que** utilisateur inscrit
**Je veux** me connecter
**Afin d'** accéder à mon espace personnel

**Critères d'acceptation:**
- [ ] Formulaire email + password
- [ ] Message d'erreur si identifiants incorrects
- [ ] Session persistante (cookie)
- [ ] Redirection vers le dashboard

---

### US-1.3 Déconnexion [P0 - Critique]
**En tant que** utilisateur connecté
**Je veux** me déconnecter
**Afin de** sécuriser mon compte

**Critères d'acceptation:**
- [ ] Bouton de déconnexion visible
- [ ] Destruction de la session
- [ ] Redirection vers la page de connexion

---

### US-1.4 Voir mon profil [P1 - Important]
**En tant que** utilisateur connecté
**Je veux** voir mon profil
**Afin de** consulter mes informations

**Critères d'acceptation:**
- [ ] Affichage username, email, date d'inscription
- [ ] Nombre de recettes personnelles
- [ ] Liste des communautés rejointes

---

## Epic 2: Catalogue Personnel

### US-2.1 Créer une recette personnelle [P0 - Critique]
**En tant que** utilisateur connecté
**Je veux** créer une recette dans mon catalogue
**Afin de** sauvegarder mes recettes

**Critères d'acceptation:**
- [ ] Formulaire: titre, contenu, tags (multi-select), image (optionnel)
- [ ] Éditeur de contenu (markdown ou rich text)
- [ ] Gestion des ingrédients (ajout/suppression dynamique)
- [ ] Validation des champs
- [ ] Confirmation de création

---

### US-2.2 Voir mes recettes personnelles [P0 - Critique]
**En tant que** utilisateur connecté
**Je veux** voir la liste de mes recettes
**Afin de** retrouver mes créations

**Critères d'acceptation:**
- [ ] Liste paginée de mes recettes
- [ ] Affichage: titre, image, tags, date
- [ ] Filtre par tags
- [ ] Recherche par titre

---

### US-2.3 Modifier ma recette [P1 - Important]
**En tant que** créateur d'une recette
**Je veux** modifier ma recette
**Afin de** corriger ou améliorer

**Critères d'acceptation:**
- [ ] Accès au formulaire d'édition
- [ ] Pré-remplissage des champs
- [ ] Sauvegarde des modifications

---

### US-2.4 Supprimer ma recette [P1 - Important]
**En tant que** créateur d'une recette
**Je veux** supprimer ma recette
**Afin de** nettoyer mon catalogue

**Critères d'acceptation:**
- [ ] Confirmation avant suppression
- [ ] Soft delete (pas de suppression définitive)
- [ ] Message de confirmation

---

## Epic 3: Communautés

### US-3.1 Créer une communauté [P0 - Critique]
**En tant que** utilisateur connecté
**Je veux** créer une communauté
**Afin de** partager des recettes avec un groupe

**Critères d'acceptation:**
- [ ] Formulaire: nom, description
- [ ] Je deviens admin automatiquement
- [ ] Redirection vers la page de la communauté

---

### US-3.2 Voir mes communautés [P0 - Critique]
**En tant que** utilisateur connecté
**Je veux** voir mes communautés
**Afin de** y accéder rapidement

**Critères d'acceptation:**
- [ ] Liste de mes communautés avec mon rôle
- [ ] Indicateur: nombre de membres, nombre de recettes
- [ ] Accès direct à chaque communauté

---

### US-3.3 Voir une communauté [P0 - Critique]
**En tant que** membre d'une communauté
**Je veux** voir la page de la communauté
**Afin de** consulter son contenu

**Critères d'acceptation:**
- [ ] Nom, description
- [ ] Liste des membres (avec rôles)
- [ ] Liste des recettes
- [ ] Mon rôle affiché
- [ ] Accès refusé si non-membre

---

### US-3.4 Inviter un membre (Admin) [P0 - Critique]
**En tant qu'** admin d'une communauté
**Je veux** inviter un utilisateur
**Afin d'** agrandir la communauté

**Critères d'acceptation:**
- [ ] Recherche par email ou username
- [ ] Confirmation d'invitation
- [ ] L'utilisateur rejoint comme MEMBER
- [ ] Erreur si déjà membre

---

### US-3.5 Promouvoir un membre (Admin) [P1 - Important]
**En tant qu'** admin d'une communauté
**Je veux** promouvoir un membre en admin
**Afin de** déléguer la gestion

**Critères d'acceptation:**
- [ ] Bouton "Promouvoir" sur chaque membre
- [ ] Confirmation
- [ ] Le membre devient ADMIN
- [ ] Pas de rétrogradation possible

---

### US-3.6 Quitter une communauté [P1 - Important]
**En tant que** membre d'une communauté
**Je veux** quitter la communauté
**Afin de** ne plus y participer

**Critères d'acceptation:**
- [ ] Confirmation avant départ
- [ ] Si dernier admin avec d'autres membres: blocage + message
- [ ] Si seul membre: suppression de la communauté
- [ ] Perte d'accès immédiate

---

### US-3.7 Modifier la communauté (Admin) [P2 - Normal]
**En tant qu'** admin d'une communauté
**Je veux** modifier nom et description
**Afin de** tenir à jour les informations

**Critères d'acceptation:**
- [ ] Formulaire d'édition
- [ ] Sauvegarde des modifications

---

## Epic 4: Recettes Communautaires

### US-4.1 Créer une recette dans une communauté [P0 - Critique]
**En tant que** membre d'une communauté
**Je veux** créer une recette dans la communauté
**Afin de** la partager avec les membres

**Critères d'acceptation:**
- [ ] Même formulaire que recette personnelle
- [ ] Création automatique d'une copie dans mon catalogue
- [ ] Activité loggée dans le feed
- [ ] La recette apparaît dans la liste communauté

---

### US-4.2 Voir les recettes d'une communauté [P0 - Critique]
**En tant que** membre d'une communauté
**Je veux** voir les recettes partagées
**Afin de** découvrir des idées

**Critères d'acceptation:**
- [ ] Liste paginée
- [ ] Filtre par tags
- [ ] Affichage du créateur
- [ ] Recherche par titre

---

### US-4.3 Voir les détails d'une recette communautaire [P0 - Critique]
**En tant que** membre d'une communauté
**Je veux** voir le détail d'une recette
**Afin de** la cuisiner

**Critères d'acceptation:**
- [ ] Titre, contenu, ingrédients
- [ ] Créateur, date
- [ ] Tags
- [ ] Liste déroulante des variantes (si existantes)

---

## Epic 5: Propositions & Variantes

### US-5.1 Proposer une mise à jour [P1 - Important]
**En tant que** membre d'une communauté
**Je veux** proposer une modification sur une recette
**Afin d'** améliorer la recette

**Critères d'acceptation:**
- [ ] Bouton "Proposer une modification" (pas sur mes propres recettes)
- [ ] Formulaire pré-rempli avec contenu actuel
- [ ] Modification du titre et/ou contenu
- [ ] Soumission de la proposition
- [ ] Activité loggée

---

### US-5.2 Voir les propositions sur ma recette [P1 - Important]
**En tant que** créateur d'une recette
**Je veux** voir les propositions reçues
**Afin de** les évaluer

**Critères d'acceptation:**
- [ ] Liste des propositions PENDING
- [ ] Détail de chaque proposition (proposeur, contenu)
- [ ] Actions: Accepter / Refuser

---

### US-5.3 Accepter une proposition [P1 - Important]
**En tant que** créateur d'une recette
**Je veux** accepter une proposition
**Afin de** mettre à jour ma recette

**Critères d'acceptation:**
- [ ] Confirmation
- [ ] Mise à jour de la recette communautaire
- [ ] Mise à jour de la recette personnelle liée
- [ ] Proposition marquée ACCEPTED
- [ ] Activité loggée

---

### US-5.4 Refuser une proposition [P1 - Important]
**En tant que** créateur d'une recette
**Je veux** refuser une proposition
**Afin de** garder ma version originale

**Critères d'acceptation:**
- [ ] Confirmation
- [ ] Création automatique d'une variante (nouvelle recette)
- [ ] Variante attribuée au proposeur
- [ ] Variante liée à l'originale (originRecipeId)
- [ ] Proposition marquée REJECTED
- [ ] Activité loggée

---

### US-5.5 Voir les variantes d'une recette [P1 - Important]
**En tant que** membre d'une communauté
**Je veux** voir les variantes d'une recette
**Afin de** découvrir des alternatives

**Critères d'acceptation:**
- [ ] Liste déroulante sur la page recette
- [ ] Clic → navigation vers la variante
- [ ] Indication du créateur de chaque variante

---

## Epic 6: Partage Inter-Communautés

### US-6.1 Fork une recette vers une autre communauté [P2 - Normal]
**En tant que** membre de plusieurs communautés
**Je veux** partager une recette d'une communauté à une autre
**Afin de** diffuser une bonne recette

**Critères d'acceptation:**
- [ ] Bouton "Partager dans une autre communauté"
- [ ] Sélection de la communauté cible (parmi celles où je suis membre)
- [ ] Vérification: admin source OU admin cible OU créateur
- [ ] Création d'une copie indépendante
- [ ] Traçabilité: originRecipeId, sharedFromCommunityId
- [ ] Je deviens créateur de la copie
- [ ] Activité loggée dans les deux communautés

---

### US-6.2 Voir l'origine d'une recette forkée [P2 - Normal]
**En tant que** membre d'une communauté
**Je veux** voir d'où vient une recette forkée
**Afin de** connaître son origine

**Critères d'acceptation:**
- [ ] Badge "Partagé depuis [Communauté X]" si applicable
- [ ] Lien vers la communauté d'origine (si j'y ai accès)

---

## Epic 7: Activity Feed

### US-7.1 Voir le feed d'une communauté [P2 - Normal]
**En tant que** membre d'une communauté
**Je veux** voir l'activité récente
**Afin de** suivre ce qui se passe

**Critères d'acceptation:**
- [ ] Liste chronologique des événements
- [ ] Types: nouvelle recette, proposition, variante créée, nouveau membre
- [ ] Pagination
- [ ] Lien vers l'élément concerné

---

### US-7.2 Voir mon feed personnel [P3 - Bonus]
**En tant que** utilisateur connecté
**Je veux** voir l'activité sur mes recettes
**Afin de** être informé des interactions

**Critères d'acceptation:**
- [ ] Propositions reçues sur mes recettes
- [ ] Variantes créées à partir de mes recettes
- [ ] Forks de mes recettes

---

## Epic 8: Tags

### US-8.1 Ajouter des tags à une recette [P1 - Important]
**En tant que** créateur d'une recette
**Je veux** ajouter des tags
**Afin de** catégoriser ma recette

**Critères d'acceptation:**
- [ ] Sélection parmi tags existants
- [ ] Création de nouveau tag à la volée
- [ ] Maximum 10 tags par recette

---

### US-8.2 Filtrer par tags [P1 - Important]
**En tant que** utilisateur
**Je veux** filtrer les recettes par tags
**Afin de** trouver ce que je cherche

**Critères d'acceptation:**
- [ ] Liste des tags disponibles (avec compteur)
- [ ] Sélection multiple
- [ ] Résultats filtrés en temps réel

---

## Priorités

| Priorité | Description | User Stories |
|----------|-------------|--------------|
| **P0 - Critique** | Indispensable au MVP | US-1.1 à US-1.3, US-2.1 à US-2.2, US-3.1 à US-3.4, US-4.1 à US-4.3 |
| **P1 - Important** | Important pour l'expérience | US-1.4, US-2.3 à US-2.4, US-3.5 à US-3.6, US-5.1 à US-5.5, US-8.1 à US-8.2 |
| **P2 - Normal** | Ajout de valeur | US-3.7, US-6.1 à US-6.2, US-7.1 |
| **P3 - Bonus** | Nice to have | US-7.2 |
