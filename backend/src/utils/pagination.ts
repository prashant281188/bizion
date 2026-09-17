/**
 * Pagination utilities for list endpoints.
 * Converts page-based params into database offset/limit and
 * provides metadata for paginated responses.
 */

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  offset: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Maximum items per page to prevent abuse */
const MAX_LIMIT = 100;
/** Default items per page */
const DEFAULT_LIMIT = 20;
/** Default page number */
const DEFAULT_PAGE = 1;

/**
 * Parse and sanitize pagination parameters from query strings.
 * Clamps values to safe ranges and provides sensible defaults.
 */
export function parsePagination(
  query: Record<string, unknown>
): PaginationParams {
  let page = Number(query.page) || DEFAULT_PAGE;
  let limit = Number(query.limit) || DEFAULT_LIMIT;

  // Ensure minimum bounds
  page = Math.max(1, Math.floor(page));
  limit = Math.max(1, Math.min(Math.floor(limit), MAX_LIMIT));

  return { page, limit };
}

/**
 * Calculate the SQL OFFSET from page-based params.
 */
export function getOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Build full pagination metadata from the total count and current page params.
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    offset: getOffset(page, limit),
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
