/**
 * Utilitaires de pagination partages.
 */

interface PaginationParams {
  limit: number;
  offset: number;
}

interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Parse les parametres de pagination depuis req.query.
 * Garantit limit entre 1 et maxLimit, offset >= 0.
 */
export function parsePagination(
  query: { limit?: string; offset?: string },
  defaultLimit = 20,
  maxLimit = 100
): PaginationParams {
  const limit = Math.min(
    Math.max(parseInt(query.limit || String(defaultLimit), 10), 1),
    maxLimit
  );
  const offset = Math.max(parseInt(query.offset || "0", 10), 0);
  return { limit, offset };
}

/**
 * Construit l'objet pagination pour la response.
 */
export function buildPaginationMeta(
  total: number,
  limit: number,
  offset: number,
  itemsCount: number
): PaginationMeta {
  return {
    total,
    limit,
    offset,
    hasMore: offset + itemsCount < total,
  };
}
