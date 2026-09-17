import { z } from 'zod';

export const productStatusZodEnum = z.enum(['active', 'inactive', 'draft', 'archived']);
export const productTypeZodEnum = z.enum(['goods', 'services']);

export const variantInputSchema = z.object({
  id: z.string().uuid().optional(), // optional for updates/inserts in bulk
  clientKey: z.string().optional(), // transient client-side key for linking images during creation
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  name: z.string().min(1, 'Variant name is required').max(255),
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
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
  salesDiscountPct: z.union([z.number(), z.string()]).optional().nullable(),
  marginPct: z.union([z.number(), z.string()]).optional().nullable(),
  defaultPacking: z.string().max(255).optional().nullable(),
  boxQuantity: z.number().int().positive().optional().default(1),
  stockQuantity: z.number().int().optional().default(0),
  lowStockThreshold: z.number().int().optional().default(10),
  isActive: z.boolean().optional().default(true),
  preferredSupplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
});

export const imageInputSchema = z.object({
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
  salesDiscountPct: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'salesDiscountPct must be a valid number',
  }),
  marginPct: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'marginPct must be a valid number',
  }),
  listPrice: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'listPrice must be a valid number',
  }),
  mrp: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'mrp must be a valid number',
  }),
  uomId: z.string().uuid('Invalid UOM ID').optional().nullable(),
  hasVariants: z.boolean().optional().default(false),
  isTaxable: z.boolean().optional().default(true),
  trackInventory: z.boolean().optional().default(true),
  boxQuantity: z.number().int().positive().optional().default(1),
  stockQuantity: z.number().int().optional().default(0),
  preferredSupplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  status: productStatusZodEnum.optional().default('draft'),
  metaTitle: z.string().max(255).optional().nullable(),
  metaDescription: z.string().max(500).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  attributes: z.record(z.string(), z.any()).optional().default({}),
  variants: z.array(variantInputSchema).optional(),
  images: z.array(imageInputSchema).optional(),
});

export const updateProductSchema = createProductSchema.partial();
export const bulkCreateProductsSchema = z.object({
  products: z.array(createProductSchema).min(1, 'At least one product is required'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type BulkCreateProductsInput = z.infer<typeof bulkCreateProductsSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
export type ImageInput = z.infer<typeof imageInputSchema>;
