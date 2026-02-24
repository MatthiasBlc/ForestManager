# Tests manuels - Phase 12 Notifications Rework

## Prerequis

- App demarree (`npm run docker:up:build`)
- 2 comptes user (User A et User B)
- Au moins 1 communaute avec User A comme moderateur et User B comme membre
- Au moins 1 recette dans la communaute

---

## 1. Notification dropdown (bell icon)

- [ ] Bell icon visible dans la navbar pour les utilisateurs connectes
- [ ] Badge numerique affiche le nombre de notifications non lues
- [ ] Badge affiche "99+" quand le compteur depasse 99
- [ ] Cliquer la bell ouvre le dropdown avec les 10 dernieres notifications
- [ ] Les notifications non lues ont un fond plus sombre et un dot bleu
- [ ] Chaque notification affiche : icone categorie, titre, message tronque, temps relatif
- [ ] Cliquer une notification → marque comme lue + ferme le dropdown + navigue vers actionUrl
- [ ] Bouton "Tout marquer comme lu" visible quand il y a des non lues
- [ ] Cliquer "Tout marquer comme lu" → toutes les notifications sont marquees lues, badge disparait
- [ ] Bouton "Voir tout" → navigue vers /notifications
- [ ] Laisser le dropdown ouvert 3 secondes → les notifications visibles sont auto-marquees comme lues
- [ ] Cliquer en dehors du dropdown → il se ferme

## 2. Page notifications (/notifications)

- [ ] Page accessible via la route /notifications
- [ ] Affiche la liste paginee de toutes les notifications
- [ ] Chips de filtre par categorie : Toutes, Invitations, Propositions de recettes, Tags, Ingredients, Moderation
- [ ] Toggle "Non lues uniquement" filtre les notifications
- [ ] Bouton "Charger plus" affiche les notifications suivantes
- [ ] Cliquer une notification → marque comme lue + navigue vers actionUrl
- [ ] Bouton "Tout marquer comme lu" fonctionne (global)
- [ ] Etat vide : "Aucune notification" affiche quand il n'y a pas de notifications
- [ ] Les badges sur les chips affichent le compteur non lu par categorie

## 3. Notifications groupees

- [ ] Plusieurs notifications du meme type sur la meme recette dans un intervalle de 60min sont groupees
- [ ] Le groupe affiche le compteur d'elements
- [ ] Cliquer le chevron expand/collapse le groupe
- [ ] Le groupe expanse affiche les messages individuels avec leur timestamp

## 4. Temps reel (WebSocket)

- [ ] User B cree une recette → User A recoit une notification en temps reel (toast + badge)
- [ ] User A invite User B → User B recoit un toast "Nouvelle invitation"
- [ ] Le compteur non lu se met a jour en temps reel sans refresh
- [ ] Apres reconnexion (deconnexion/reconnexion reseau), les notifications manquees sont presentes via REST

## 5. Preferences de notifications

- [ ] Section "Preferences de notifications" visible sur la page profil pour tous les utilisateurs
- [ ] 5 categories affichees : Invitations, Propositions de recettes, Tags, Ingredients, Moderation
- [ ] Toggle global par categorie fonctionne (optimistic UI)
- [ ] Desactiver une categorie globale → plus de notifications de ce type
- [ ] Le chevron per-communaute s'affiche si l'utilisateur a des communautes
- [ ] Expander une categorie → liste des communautes avec toggles individuels
- [ ] Override communaute : desactiver pour une communaute specifique → plus de notifications de ce type pour cette communaute
- [ ] Dot warning visible quand une preference communaute differe de la globale
- [ ] Le toggle communaute passe en couleur warning quand il differe du global
- [ ] Notifications non desactivables (INVITE_SENT, USER_KICKED) arrivent meme si la categorie est desactivee

## 6. Categories de notifications

### INVITATION
- [ ] User A invite User B → notification "Nouvelle invitation" pour User B
- [ ] User B accepte → notification pour User A
- [ ] User B rejette → notification pour User A

### RECIPE_PROPOSAL
- [ ] User B propose une modification → notification pour User A (proprietaire)
- [ ] User A accepte la proposition → notification pour User B
- [ ] User A rejette la proposition → notification pour User B

### TAG
- [ ] User B cree un tag PENDING → notification pour les moderateurs
- [ ] Moderateur approuve le tag → notification pour le createur
- [ ] Moderateur rejette le tag → notification pour le createur
- [ ] Suggestion de tag sur une recette → notification pour le proprietaire

### INGREDIENT
- [ ] Admin approuve un ingredient PENDING → notification pour le createur
- [ ] Admin rejette un ingredient PENDING → notification pour le createur

### MODERATION
- [ ] User A (moderateur) kick User B → notification pour User B (non desactivable)

## 7. Icones et couleurs par categorie

- [ ] INVITATION → icone enveloppe, couleur info (bleu)
- [ ] RECIPE_PROPOSAL → icone ustensiles, couleur warning (orange)
- [ ] TAG → icone tag, couleur accent
- [ ] INGREDIENT → icone feuille, couleur success (vert)
- [ ] MODERATION → icone bouclier, couleur error (rouge)

## 8. Badge invitations (navbar user menu)

- [ ] Le badge invitations dans le menu user se met a jour en temps reel via notification:new
- [ ] Accepter/rejeter une invitation met a jour le badge

## 9. Nettoyage automatique

- [ ] Les notifications lues de plus de 30 jours sont supprimees automatiquement (job cron 03:00)
- [ ] Les notifications non lues ne sont jamais supprimees par le job
