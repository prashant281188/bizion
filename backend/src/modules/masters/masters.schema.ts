import { z } from 'zod';

// Category Schemas
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(255),
  parentId: z.string().uuid('Invalid parent category ID').optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  imageUrl: z.string().max(1000).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

// Brand Schemas
export const createBrandSchema = z.object({
  name: z.string().min(1, 'Brand name is required').max(255),
  logoUrl: z.string().max(1000).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateBrandSchema = createBrandSchema.partial();

// Unit of Measurement Schemas
export const createUnitSchema = z.object({
  code: z.string().min(1, 'UOM code is required').max(10),
  name: z.string().min(1, 'UOM name is required').max(100),
  uqcCode: z.string().max(10).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

export const updateUnitSchema = createUnitSchema.partial();

// Tax Rate Schemas
export const createTaxRateSchema = z.object({
  name: z.string().min(1, 'Tax rate name is required').max(100),
  ratePercentage: z.union([z.number(), z.string()]).refine((val) => !isNaN(Number(val)), {
    message: 'ratePercentage must be a valid number',
  }),
  cessRate: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'cessRate must be a valid number',
  }),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const updateTaxRateSchema = createTaxRateSchema.partial();

// Payment Term Schemas
export const createPaymentTermSchema = z.object({
  name: z.string().min(1, 'Payment term name is required').max(100),
  dueDays: z.number().int().min(0, 'Due days must be at least 0'),
  isDefault: z.boolean().optional().default(false),
});

export const updatePaymentTermSchema = createPaymentTermSchema.partial();

// Contact Group Schemas
export const createContactGroupSchema = z.object({
  name: z.string().min(1, 'Contact group name is required').max(255),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateContactGroupSchema = createContactGroupSchema.partial();

// HSN/SAC Code Schemas
export const createHsnCodeSchema = z.object({
  code: z.string().min(2, 'HSN/SAC code must be at least 2 characters').max(8, 'HSN/SAC code must be at most 8 characters'),
  description: z.string().min(1, 'Description is required').max(1000),
  type: z.enum(['goods', 'services']),
  taxRateId: z.string().uuid('Invalid tax rate ID'),
});

export const updateHsnCodeSchema = createHsnCodeSchema.partial();

export const updateHsnRateSchema = z.object({
  newTaxRateId: z.string().uuid('Invalid tax rate ID'),
  effectiveFrom: z.string().min(1, 'Effective date is required'),
  reason: z.string().max(500).optional().nullable(),
});
