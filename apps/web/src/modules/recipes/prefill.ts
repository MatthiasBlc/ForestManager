// Nouvelle recette pre-remplie par un autre module (etat de navigation vers
// `/s/:spaceId/recipes/new`) : idee de repas du Planning [F-MPL-4, D133, D182].
// Recettes ne connait pas l'origine : il reprend le titre et la note, affiche le
// bandeau donne et, une fois la recette enregistree, previent l'origine.
export interface RecipePrefill {
  title: string;
  notes: string | null;
  /** Titre de l'editeur ("Nouvelle recette depuis une idee"). */
  heading: string;
  /** Bandeau d'explication en tete de l'editeur. */
  banner: string;
  /** Chemin d'API appele en POST avec `{ recipeId }` apres l'enregistrement. */
  afterSave?: string;
}
