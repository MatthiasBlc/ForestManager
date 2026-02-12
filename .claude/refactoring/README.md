# Refactoring Mission - ForestManager

Audit realise le 2026-02-10 sur la branche `Developement`.
Ce dossier documente toutes les taches de refactoring identifiees.

## Structure

| Fichier | Contenu |
|---------|---------|
| `BACKEND.md` | Toutes les taches backend, classees par priorite |
| `FRONTEND.md` | Toutes les taches frontend, classees par priorite |
| `TRACKER.md` | Suivi global d'avancement (checklist) |

## Regles

- Cocher dans `TRACKER.md` apres chaque tache terminee
- Ne jamais supprimer une tache : la marquer DONE ou SKIPPED avec raison
- Lancer les tests apres chaque groupe de modifications (`npm test`)
- Commiter regulierement (1 commit par groupe logique)

## Ordre d'execution recommande

1. Backend Priorite 1 (fondations : constantes, services, securite)
2. Frontend Priorite 1 (hooks, utilitaires, dead code)
3. Frontend Priorite 2 (composants dupliques, UI reutilisables)
4. Backend Priorite 2 + Frontend Priorite 3 (type safety, qualite)
