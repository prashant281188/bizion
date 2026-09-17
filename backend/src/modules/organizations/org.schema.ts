import { z } from 'zod';

/**
 * Regex for standard Indian PAN (Permanent Account Number):
 * - 5 uppercase letters
 * - 4 digits
 * - 1 uppercase letter
 */
export const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/**
 * Regex for Indian GSTIN (Goods and Services Tax Identification Number):
 * - 2 digits (state code)
 * - 5 uppercase letters, 4 digits, 1 uppercase letter (PAN)
 * - 1 alphanumeric character (entity code)
 * - 'Z' (default character)
 * - 1 alphanumeric check digit (or digits)
 */
export const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const updateOrgSchema = z.object({
  name: z.string().min(1, 'Business name must be at least 1 character').max(255).optional(),
  legalName: z.string().max(255).optional().nullable(),
  gstin: z.string()
    .trim()
    .toUpperCase()
    .regex(gstinRegex, 'Invalid Indian GSTIN format (e.g., 07AAAAA1111A1Z1)')
    .optional()
    .nullable(),
  gstRegistrationType: z.enum(['regular', 'composition', 'unregistered', 'consumer', 'sez', 'deemed_export']).optional().nullable(),
  pan: z.string()
    .trim()
    .toUpperCase()
    .regex(panRegex, 'Invalid PAN format (e.g., AAAAA1111A)')
    .optional()
    .nullable(),
  tan: z.string().max(10).optional().nullable(),
  cin: z.string().max(21).optional().nullable(),
  addressLine1: z.string().max(500).optional().nullable(),
  addressLine2: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  stateCode: z.string().length(2, 'State code must be exactly 2 characters').toUpperCase().optional().nullable(),
  stateName: z.string().max(100).optional().nullable(),
  pincode: z.string().length(6, 'Pincode must be exactly 6 digits').regex(/^[0-9]{6}$/, 'Pincode must be numeric').optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  email: z.string().email('Invalid email address').max(255).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  website: z.string().max(255).optional().nullable(),
  logoUrl: z.string().max(1000).optional().nullable(),
  fyStartMonth: z.number().int().min(1).max(12).optional(),
  defaultCurrency: z.string().length(3).toUpperCase().optional(),
  settings: z.record(z.string(), z.any()).optional(),
});

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
