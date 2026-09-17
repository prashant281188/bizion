import { z } from 'zod';

export const paymentDirectionZodEnum = z.enum(['inbound', 'outbound']);

export const paymentModeZodEnum = z.enum([
  'cash',
  'bank_transfer',
  'upi',
  'cheque',
  'credit_card',
  'debit_card',
  'neft',
  'rtgs',
  'imps',
  'demand_draft',
  'online',
  'other',
]);

export const paymentStatusZodEnum = z.enum([
  'pending',
  'presented',
  'completed',
  'failed',
  'bounced',
  'refunded',
  'partially_refunded',
  'cancelled',
]);

export const paymentAllocationSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  amountApplied: z.union([z.number(), z.string()]).refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Amount applied must be greater than zero',
  }),
});

export const createPaymentSchema = z.object({
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid payment date format (YYYY-MM-DD)'),
  paymentNumber: z.string().max(100).optional(),
  direction: paymentDirectionZodEnum,
  contactId: z.string().uuid('Invalid contact ID'),
  amount: z.union([z.number(), z.string()]).refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Payment amount must be greater than zero',
  }),
  paymentMode: paymentModeZodEnum,
  status: paymentStatusZodEnum.optional().default('completed'),
  chequeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid cheque date format').optional().nullable(),
  bankAccountId: z.string().uuid().optional().nullable(),
  transactionRef: z.string().max(255).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  allocations: z.array(paymentAllocationSchema).optional().default([]),
});

export const createBankAccountSchema = z.object({
  accountName: z.string().min(1, 'Account name is required').max(255),
  bankName: z.string().max(255).optional().nullable(),
  accountNumber: z.string().max(50).optional().nullable(),
  ifscCode: z.string().max(11).optional().nullable(),
  branch: z.string().max(255).optional().nullable(),
  accountType: z.string().max(50).optional().nullable(),
  upiId: z.string().max(100).optional().nullable(),
  openingBalance: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Opening balance must be a non-negative number',
  }),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const updateBankAccountSchema = createBankAccountSchema.partial();

export const updatePaymentStatusSchema = z.object({
  status: paymentStatusZodEnum.optional(),
  chequeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid cheque date format').optional().nullable(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid payment date format').optional().nullable(),
  allocations: z.array(paymentAllocationSchema).optional(),
});

export const bulkCreatePaymentSchema = z.object({
  payments: z.array(createPaymentSchema).min(1, 'At least one payment is required'),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;
export type BulkCreatePaymentInput = z.infer<typeof bulkCreatePaymentSchema>;
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
