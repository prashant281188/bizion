import { z } from 'zod';

export const createWarehouseSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').max(20, 'Code must be max 20 characters'),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateCode: z.string().length(2, 'State code must be exactly 2 characters').optional(),
  stateName: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().default('India').optional(),
  isDefault: z.boolean().default(false).optional(),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

export const adjustStockSchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  productId: z.string().uuid('Invalid product ID'),
  variantId: z.string().uuid('Invalid variant ID').optional().nullable(),
  quantityChange: z.number().int('Quantity must be an integer').refine(val => val !== 0, 'Quantity change cannot be zero'),
  notes: z.string().optional(),
});
