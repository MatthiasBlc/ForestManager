# Protocole de test manuel — Meal Plan & Generation

## Prerequis

- Feature MEAL_PLAN activee sur la communaute (via SuperAdmin)
- Au moins un MODERATOR dans la communaute
- Au moins 10 recettes publiees dans la communaute (avec des tags varies)
- Au moins 2-3 tags communautaires (ex: vegetarien, rapide, poisson)

---

## 1. Planning Manuel

### 1.1 Creation de plan

- [ ] Moderateur cree un plan (date debut/fin, servings par defaut)
- [ ] Verifier que la grille s'affiche avec tous les jours + 2 repas par jour
- [ ] Verifier les slots EMPTY avec icone "+"

### 1.2 Edition de slot

- [ ] Clic sur un slot EMPTY → modal edition
- [ ] Assigner une recette (recherche autocomplete)
- [ ] Assigner un texte libre
- [ ] Modifier le nombre de couverts
- [ ] Ajouter/modifier un commentaire
- [ ] Desactiver un slot (disabled)
- [ ] Verifier l'affichage correct apres chaque modification

### 1.3 Verrouillage

- [ ] Moderateur : clic cadenas pour verrouiller un slot → icone change, style visuel distinct
- [ ] Moderateur : clic cadenas pour deverrouiller
- [ ] Membre : voit le cadenas mais ne peut pas le toggler

### 1.4 Drag & Drop (desktop)

- [ ] Glisser un slot sur un autre → les contenus sont echanges
- [ ] Verifier que les slots disabled ne sont pas draggable

### 1.5 Parametres du plan

- [ ] Modifier servings par defaut
- [ ] Toggler editableByMembers
- [ ] En tant que membre, verifier que l'edition est autorisee/interdite selon le toggle

### 1.6 Archives

- [ ] Creer un nouveau plan (archive l'ancien)
- [ ] Onglet Archives → voir l'ancien plan
- [ ] Clic sur une archive → modal avec la grille en lecture seule
- [ ] Supprimer une archive

### 1.7 Idees de repas

- [ ] Onglet Ideas → creer une idee (nom, commentaire, recette optionnelle)
- [ ] Modifier une idee
- [ ] Supprimer une idee

---

## 2. Generation — Parametres

### 2.1 Creation jeu de params

- [ ] Onglet Generation → clic "New Set"
- [ ] Remplir nom, description, cooldownDays, useIdeas, isDefault
- [ ] Verifier apparition dans la liste avec badge "Default" si applicable

### 2.2 Edition jeu de params

- [ ] Clic sur un jeu → detail
- [ ] Modifier nom, description, cooldownDays via bouton Edit
- [ ] Changer isDefault → verifier que l'ancien default perd le badge

### 2.3 Suppression

- [ ] Supprimer un jeu → confirmation → disparait de la liste
- [ ] Si c'etait le default → plus de badge default dans la liste

---

## 3. Generation — Exclusions & Pins

### 3.1 Exclusions (desktop)

- [ ] Cocher une case → le slot sera skip a la generation
- [ ] Decocher → le slot est inclus
- [ ] Verifier qu'on ne peut pas exclure un slot deja epingle (message d'erreur)

### 3.2 Exclusions (mobile)

- [ ] Layout vertical par jour (cards)
- [ ] Checkbox "Excl." fonctionnelle
- [ ] Meme validation (pas d'exclusion sur pin)

### 3.3 Pins (desktop)

- [ ] Clic icone recherche → autocomplete tag → selectionner → badge tag affiche
- [ ] Supprimer un pin (bouton x)
- [ ] Verifier qu'un slot exclu affiche "--" et pas de bouton pin

### 3.4 Pins (mobile)

- [ ] Recherche tag et selection fonctionnelles dans le layout mobile
- [ ] Suppression de pin

---

## 4. Generation — Regles

### 4.1 Regles par tag

- [ ] Clic "Add tag rule" → autocomplete → selectionner un tag
- [ ] Slider poids : 0% (exclu), 100% (neutre), 200% (favorise)
- [ ] Select meal time : Both / Lunch / Dinner
- [ ] Frequence : None → toggle Exact (1 champ) → toggle Range (min/max)
- [ ] Cooldown tag (jours)
- [ ] Verifier sauvegarde auto (debounce 600ms)

### 4.2 Regles par recette

- [ ] Clic "Add recipe rule" → autocomplete → selectionner une recette
- [ ] Slider poids
- [ ] Select meal time
- [ ] Pas de frequence ni cooldown tag (champs absents)

### 4.3 Suppression de regle

- [ ] Bouton corbeille → regle disparait

---

## 5. Generation — Lancement

### 5.1 Bouton Generate

- [ ] Bouton "Generate" visible uniquement pour les moderateurs
- [ ] Sur mobile : icone seule (sans texte)
- [ ] Clic → modal avec selecteur de params (pre-selectionne sur default)

### 5.2 Fill empty only

- [ ] Cocher "Fill empty slots only" (defaut : coche)
- [ ] Decocher → info "X non-locked slot(s) will be regenerated"
- [ ] Clic Generate avec fillEmptyOnly=false et slots non-vides → modal confirmation

### 5.3 Generation

- [ ] Confirmer la generation → spinner → toast "X slots generated"
- [ ] Verifier que la grille est mise a jour avec les nouvelles recettes
- [ ] Rapport affiche : nombre genere, nombre skip (excluded, locked, already filled)
- [ ] Slots verrouilles : inchanges
- [ ] Slots exclus : inchanges
- [ ] Slots disabled : inchanges

### 5.4 Warnings

- [ ] Generer avec un pool insuffisant (beaucoup de cooldown, peu de recettes)
- [ ] Verifier le warning "Pool exhausted" dans le rapport
- [ ] Generer avec frequencyMin non atteignable → warning "Frequency min not met"

### 5.5 Dismiss rapport

- [ ] Bouton X sur le rapport → disparait

---

## 6. Generation — Replace

### 6.1 Bouton Replace

- [ ] Icone refresh visible sur les slots non-vides, non-locked, quand un default params existe
- [ ] Invisible sur slots locked, disabled, empty
- [ ] Invisible si aucun default params n'existe

### 6.2 Remplacement

- [ ] Clic icone refresh → modal confirmation "Replace this slot?"
- [ ] Confirmer → spinner → toast "Slot replaced"
- [ ] Verifier que la recette a change
- [ ] Annuler → rien ne se passe

---

## 7. Mobile

### 7.1 Planning

- [ ] Layout vertical (cards par jour, 2 colonnes lunch/dinner)
- [ ] Cadenas fonctionnel
- [ ] Bouton Replace fonctionnel

### 7.2 Generation

- [ ] Bouton Generate (icone seule) dans le header
- [ ] Modal generation : affichage correct sur petit ecran
- [ ] Rapport : lisible sur mobile

### 7.3 Params / Exclusions / Rules

- [ ] Onglet Generation : liste des jeux de params
- [ ] Detail : exclusions/pins en layout vertical par jour
- [ ] Regles : sliders et controles utilisables sur mobile
