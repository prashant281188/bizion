// ============================================================
// Bizion — Product Validation Schemas (Aligned with Backend)
// ============================================================

import { z } from 'zod';

export const productStatusZodEnum = z.enum(['active', 'inactive', 'draft', 'archived']);
export const productTypeZodEnum = z.enum(['goods', 'services']);

export const productVariantSchema = z.object({
  id: z.string().uuid().optional(),
  clientKey: z.string().optional(), // transient client-side key for variant linkage
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  name: z.string().min(1, 'Variant name is required').max(255),
  attributes: z.record(z.string(), z.any()).optional().default({}),
  basePrice: z.union([z.number(), z.string()]).refine((val) => !isNaN(Number(val)), {
    message: 'basePrice must be a valid number',
  }),
  sellingPrice: z.union([z.number(), z.string()]).refine((val) => !isNaN(Number(val)), {
    message: 'sellingPrice must be a valid number',
  }),
  costPrice: z.union([z.number(), z.string()]).refine((val) => !isNaN(Number(val)), {
    message: 'costPrice must be a valid number',
  }),
  mrp: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'mrp must be a valid number',
  }),
  listPrice: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'listPrice must be a valid number',
  }),
  purchaseMode: z.enum(['direct', 'list']).optional().nullable(),
  discountPct: z.union([z.number(), z.string()]).optional().nullable(),
  marginPct: z.union([z.number(), z.string()]).optional().nullable(),
  defaultPacking: z.string().max(255).optional().nullable(),
  boxQuantity: z.union([z.number(), z.string()]).optional().default(1).refine((val) => {
    const num = Number(val);
    return !isNaN(num) && num > 0 && Number.isInteger(num);
  }, {
    message: 'Box quantity must be a positive integer',
  }),
  stockQuantity: z.number().int().optional().default(0),
  lowStockThreshold: z.number().int().optional().default(10),
  isActive: z.boolean().optional().default(true),
});

export const productImageSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().min(1, 'Image URL is required').max(500),
  thumbnailUrl: z.string().max(500).optional().nullable(),
  altText: z.string().max(255).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  isPrimary: z.boolean().optional().default(false),
  variantId: z.string().uuid().optional().nullable(),
  variantClientKey: z.string().optional().nullable(), // transient client-side key pointing to a variant
});

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
  brandId: z.string().uuid('Invalid brand ID').optional().nullable(),
  taxRateId: z.string().uuid('Invalid tax rate ID').optional().nullable(),
  hsnCodeId: z.string().uuid('Invalid HSN code ID').optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable(),
  type: productTypeZodEnum.optional().default('goods'),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  basePrice: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'basePrice must be a valid number',
  }),
  sellingPrice: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'sellingPrice must be a valid number',
  }),
  costPrice: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'costPrice must be a valid number',
  }),
  purchaseMode: z.enum(['direct', 'list']).optional().default('direct'),
  discountPct: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'discountPct must be a valid number',
  }),
  marginPct: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'marginPct must be a valid number',
  }),
  listPrice: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'listPrice must be a valid number',
  }),
  uomId: z.string().uuid('Invalid UOM ID').optional().nullable(),
  hasVariants: z.boolean().optional().default(false),
  isTaxable: z.boolean().optional().default(true),
  trackInventory: z.boolean().optional().default(true),
  defaultPacking: z.string().max(255).optional().nullable(),
  boxQuantity: z.union([z.number(), z.string()]).optional().default(1).refine((val) => {
    const num = Number(val);
    return !isNaN(num) && num > 0 && Number.isInteger(num);
  }, {
    message: 'Box quantity must be a positive integer',
  }),
  status: productStatusZodEnum.optional().default('draft'),
  metaTitle: z.string().max(255).optional().nullable(),
  metaDescription: z.string().max(500).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  attributes: z.record(z.string(), z.any()).optional().default({}),
  variants: z.array(productVariantSchema).optional().default([]),
  images: z.array(productImageSchema).optional().default([]),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductFormData = z.infer<typeof createProductSchema>;
export type UpdateProductFormData = z.infer<typeof updateProductSchema>;
export type ProductVariantFormData = z.infer<typeof productVariantSchema>;
export type ProductImageFormData = z.infer<typeof productImageSchema>;
