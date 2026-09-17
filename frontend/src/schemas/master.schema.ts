import { z } from 'zod';

export const categoryFormSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(255),
  parentId: z.string().uuid('Invalid parent category').optional().nullable().or(z.literal('')),
  description: z.string().max(1000).optional().nullable().or(z.literal('')),
  imageUrl: z.string().max(1000).optional().nullable().or(z.literal('')),
  sortOrder: z.coerce.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const brandFormSchema = z.object({
  name: z.string().min(1, 'Brand name is required').max(255),
  logoUrl: z.string().max(1000).optional().nullable().or(z.literal('')),
  description: z.string().max(1000).optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
});

export const unitFormSchema = z.object({
  code: z.string().min(1, 'Code is required').max(10),
  name: z.string().min(1, 'Name is required').max(100),
  uqcCode: z.string().max(10).optional().nullable().or(z.literal('')),
  isDefault: z.boolean().optional().default(false),
});

export const taxRateFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  ratePercentage: z.coerce.number().min(0, 'Tax rate must be at least 0%').max(100, 'Tax rate cannot exceed 100%'),
  cessRate: z.coerce.number().min(0, 'Cess rate must be at least 0%').max(100, 'Cess rate cannot exceed 100%').optional().default(0),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const paymentTermFormSchema = z.object({
  name: z.string().min(1, 'Payment term name is required').max(100),
  dueDays: z.coerce.number().int().min(0, 'Due days must be at least 0'),
  isDefault: z.boolean().optional().default(false),
});

export const contactGroupFormSchema = z.object({
  name: z.string().min(1, 'Contact group name is required').max(255),
  description: z.string().max(1000).optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
});

export const hsnCodeFormSchema = z.object({
  code: z.string().min(2, 'HSN/SAC code must be at least 2 characters').max(8, 'Code must be at most 8 characters'),
  description: z.string().min(1, 'Description is required').max(1000),
  type: z.enum(['goods', 'services']),
  taxRateId: z.string().uuid('Please select a tax rate').optional().or(z.literal('')),
});

export const hsnRateChangeSchema = z.object({
  newTaxRateId: z.string().uuid('Please select a tax rate'),
  effectiveFrom: z.string().min(1, 'Effective date is required'),
  reason: z.string().max(500).optional().nullable().or(z.literal('')),
});

export type CategoryFormInput = z.infer<typeof categoryFormSchema>;
export type BrandFormInput = z.infer<typeof brandFormSchema>;
export type UnitFormInput = z.infer<typeof unitFormSchema>;
export type TaxRateFormInput = z.infer<typeof taxRateFormSchema>;
export type PaymentTermFormInput = z.infer<typeof paymentTermFormSchema>;
export type ContactGroupFormInput = z.infer<typeof contactGroupFormSchema>;
export type HsnCodeFormInput = z.infer<typeof hsnCodeFormSchema>;
export type HsnRateChangeInput = z.infer<typeof hsnRateChangeSchema>;
