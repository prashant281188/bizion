import type { Response } from 'express';

/**
 * Standardized API response format for the Bizion platform.
 * Ensures consistent JSON structure across all endpoints.
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedApiResponse<T = unknown> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Send a successful response with data.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
    message,
  } satisfies ApiResponse<T>);
}

/**
 * Send an error response.
 */
export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: Record<string, string[]>
): void {
  res.status(statusCode).json({
    success: false,
    message,
    errors,
  } satisfies ApiResponse);
}

/**
 * Send a paginated response with metadata.
 * Also sets X-Total-Count and X-Total-Pages headers for client convenience.
 */
export function sendPaginated<T>(
  res: Response,
  data: T,
  total: number,
  page: number,
  limit: number,
  message = 'Success'
): void {
  const totalPages = Math.ceil(total / limit);

  res.setHeader('X-Total-Count', total.toString());
  res.setHeader('X-Total-Pages', totalPages.toString());

  res.status(200).json({
    success: true,
    data,
    message,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  } satisfies PaginatedApiResponse<T>);
}
