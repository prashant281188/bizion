import { z } from 'zod';

export const orderItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  unitType: z.enum(['box', 'loose']).default('loose'),
  orderQuantity: z.number().int().positive(),
  unitPrice: z.number().min(0),
});

export const createOrderSchema = z.object({
  type: z.enum(['sales', 'purchase']),
  contactId: z.string().uuid().optional().nullable(),
  orderDate: z.string(), // YYYY-MM-DD
  expectedDeliveryDate: z.string().optional().nullable(),
  isInterState: z.boolean(),
  roundOff: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'RoundOff must be a valid number',
  }).transform(Number),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
});

export const updateOrderSchema = createOrderSchema;

export const updateOrderStatusSchema = z.object({
  status: z.enum(['draft', 'confirmed', 'processing', 'partially_dispatched', 'shipped', 'delivered', 'cancelled']),
  warehouseId: z.string().uuid().optional().nullable(),
  receivedItems: z.array(z.object({
    id: z.string().uuid(),
    quantity: z.number().min(0)
  })).optional(),
});
