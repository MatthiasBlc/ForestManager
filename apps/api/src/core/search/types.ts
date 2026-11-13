// Contrat de recherche entre le socle et les modules (P16) [D191].
import type { SearchGroup } from "@fm/shared";

import type { Context } from "../context.ts";

export interface SearchSpace {
  id: string;
  name: string;
}

export interface SearchInput {
  userId: string;
  /** Texte normalise (minuscules, sans accents), echappe pour LIKE : `like` = %texte%. */
  text: string;
  like: string;
  /** Espaces ou l'utilisateur est membre actif et ou le module est actif. */
  spaces: readonly SearchSpace[];
  /** Espace courant (sinon l'espace perso) ; absent de `spaces` si le module n'y est pas actif. */
  currentSpaceId: string;
  /** Resultats au plus par groupe. */
  limit: number;
}

/** Groupes du module, cles prefixees par son code ; un groupe vide peut etre omis. */
export type ModuleSearch = (ctx: Context, input: SearchInput) => Promise<SearchGroup[]>;
