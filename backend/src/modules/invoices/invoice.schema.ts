import { z } from 'zod';

export const invoiceStatusZodEnum = z.enum([
  'draft',
  'approved',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
  'void',
]);

export const documentTypeZodEnum = z.enum([
  'sales_invoice',
  'purchase_invoice',
  'credit_note',
  'debit_note',
  'proforma',
  'quotation',
  'delivery_challan',
  'purchase_order',
  'sales_order',
]);

export const supplyTypeZodEnum = z.enum([
  'b2b',
  'b2c_large',
  'b2c_small',
  'sez_with_payment',
  'sez_without_payment',
  'deemed_export',
  'export_with_payment',
  'export_without_payment',
]);

export const discountTypeZodEnum = z.enum(['percentage', 'fixed']);

export const invoiceLineItemSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  variantId: z.string().uuid().optional().nullable(),
  description: z.string().min(1, 'Description is required').max(500),
  hsnCode: z.string().max(20).optional().nullable(),
  quantity: z.union([z.number(), z.string()]).refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Quantity must be a valid number greater than zero',
  }),
  unitPrice: z.union([z.number(), z.string()]).refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'UnitPrice must be a valid positive number',
  }),
  discountType: discountTypeZodEnum.optional().default('percentage'),
  discountValue: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Discount must be a valid positive number',
  }),
  taxRateId: z.string().uuid().optional().nullable(),
});

export const createInvoiceSchema = z.object({
  documentType: documentTypeZodEnum.optional().default('sales_invoice'),
  invoiceNumber: z.string().max(100).optional().nullable(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid invoice date format (YYYY-MM-DD)'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid due date format (YYYY-MM-DD)').optional().nullable(),
  referenceInvoiceId: z.string().uuid().optional().nullable(),
  referenceNumber: z.string().max(100).optional().nullable(),
  contactId: z.string().uuid('Invalid contact ID'),
  orderId: z.string().uuid().optional().nullable(),
  billingAddressId: z.string().uuid().optional().nullable(),
  shippingAddressId: z.string().uuid().optional().nullable(),
  supplyType: supplyTypeZodEnum.optional().default('b2b'),
  placeOfSupplyCode: z.string().length(2, 'Place of supply code must be 2 characters').optional().nullable(),
  isInterState: z.boolean().optional().nullable(),
  reverseCharge: z.boolean().optional().default(false),
  currency: z.string().length(3).optional().default('INR'),
  exchangeRate: z.union([z.number(), z.string()]).optional().default(1).refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Exchange rate must be a positive number',
  }),
  paymentTermId: z.string().uuid().optional().nullable(),
  transporterId: z.string().uuid().optional().nullable(),
  ewayBillNumber: z.string().max(50).optional().nullable(),
  ewayBillDate: z.string().optional().nullable(),
  transportMode: z.string().max(50).optional().nullable(),
  vehicleNumber: z.string().max(50).optional().nullable(),
  status: invoiceStatusZodEnum.optional().default('draft'),
  notes: z.string().max(2000).optional().nullable(),
  termsAndConditions: z.string().max(2000).optional().nullable(),
  customerNotes: z.string().max(2000).optional().nullable(),
  customFields: z.record(z.string(), z.any()).optional().nullable(),
  roundOff: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'RoundOff must be a valid number',
  }),
  lineItems: z.array(invoiceLineItemSchema).min(1, 'Invoice must have at least 1 line item'),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;
