# Decisions metier validees - Recettes, Propositions, Forks

**Status**: COMPLET - Toutes les decisions documentees dans `docs/BUSINESS_RULES.md`

## Resume des decisions

### 1. Synchronisation (section 3.2.1)

- **Bidirectionnelle**: modifier depuis n'importe ou (perso ou communautaire) propage partout
- **Scope**: titre, contenu, ingredients = SYNCHRONISES | tags = LOCAUX par communaute
- **Tags**: les MODERATORS peuvent modifier les tags pour leur communaute
- **Passage obligatoire**: la synchro passe toujours par la version privee

### 2. Conflit proposition vs edition (section 4.2)

- **Bloquer** si `recipe.updatedAt > proposal.createdAt` (erreur PROPOSAL_003)
- **Resolution**: le proposeur doit re-soumettre sa proposition
- **Cascade apres acceptation**: recette communautaire → perso → N autres communautes
- **Activity Log**: 1 entry par communaute impactee

### 3. Recettes orphelines (section 3.3.1)

- **Declencheurs**: suppression recette perso / depart / expulsion / suppression compte
- **Permanent**: meme si le createur re-rejoint, la cesure est definitive
- **Pas de modification directe** sur une recette orpheline
- **Propositions PENDING**: auto-refusees immediatement → variantes creees
- **Affichage**: la communaute = "proprietaire"

### 4. Variantes (section 4.4)

- **Coexistence**: plusieurs variantes par communaute
- **Hierarchie**: variantes de variantes OK (chaine illimitee)
- **Dropdown**: PLAT (pas d'arbre), originRecipeId = parent immediat
- **Tri**: plus recent en premier (MAX de createdAt, updatedAt)
- **Visibilite**: seulement les variantes de CETTE communaute

### 5. Forks (section 5)

- **originRecipeId**: pointe vers la recette COMMUNAUTAIRE source (pas perso)
- **Independance totale**: aucune synchronisation
- **Chaines**: fork de fork OK, origin = parent immediat
- **Analytics en chaine**: A voit +1 quand C fork B (remontee)

### 6. Suppressions

- **Communaute soft-deleted**: tout ce qui lui est associe = soft-deleted
- **Utilisateur supprime**: toutes ses recettes deviennent orphelines

### 7. Features

- **Nouvelle feature isDefault=true**: toutes les communautes existantes la recoivent automatiquement

## Documents mis a jour

- `docs/BUSINESS_RULES.md` - Sections 2.7, 3.2.1, 3.3.1, 4.2, 4.4, 5.2-5.4, 6.3, 12.2
- `docs/DEVELOPMENT_ROADMAP.md` - Phase 5 avec decisions validees
- Nouveau code erreur: PROPOSAL_003

## Prochaine etape

Phase 5: Implementation Propositions & Variantes - Toutes les regles metier sont clarifiees.
