import { z } from 'zod';

export const paymentDirectionSchema = z.enum(['inbound', 'outbound']);

export const paymentModeSchema = z.enum([
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

export const paymentAllocationSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  amountApplied: z.coerce.number().min(0.01, 'Amount must be greater than zero'),
});

export const createPaymentSchema = z.object({
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  direction: paymentDirectionSchema,
  contactId: z.string().uuid('Invalid customer/vendor ID'),
  amount: z.coerce.number().min(0.01, 'Payment amount must be greater than zero'),
  paymentMode: paymentModeSchema,
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
  openingBalance: z.coerce.number().min(0, 'Opening balance cannot be negative').default(0),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});
