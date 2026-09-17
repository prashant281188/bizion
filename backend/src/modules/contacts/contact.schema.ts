import { z } from 'zod';
import { panRegex, gstinRegex } from '../organizations/org.schema.js';

export const contactTypeZodEnum = z.enum(['customer', 'vendor', 'both']);
export const gstRegistrationTypeZodEnum = z.enum([
  'regular',
  'composition',
  'unregistered',
  'consumer',
  'sez',
  'deemed_export',
]);

export const addressSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().max(100).optional().default('Main'),
  addressLine1: z.string().min(1, 'Address line 1 is required').max(500),
  addressLine2: z.string().max(500).optional().nullable(),
  city: z.string().min(1, 'City is required').max(100),
  stateCode: z.string().length(2, 'State code must be exactly 2 characters').toUpperCase(),
  stateName: z.string().min(1, 'State name is required').max(100),
  pincode: z.string().refine((val) => !val || /^[0-9]{6}$/.test(val), 'Pincode must be exactly 6 digits').optional().nullable(),
  country: z.string().max(100).optional().default('India'),
  isBillingDefault: z.boolean().optional().default(false),
  isShippingDefault: z.boolean().optional().default(false),
});

export const createContactSchema = z.object({
  type: contactTypeZodEnum.optional().default('customer'),
  companyName: z.string().max(255).optional().nullable(),
  displayName: z.string().min(1, 'Display name is required').max(255),
  contactPerson: z.string().max(255).optional().nullable(),
  gstin: z.string()
    .trim()
    .toUpperCase()
    .regex(gstinRegex, 'Invalid Indian GSTIN format')
    .optional()
    .nullable(),
  gstRegistrationType: gstRegistrationTypeZodEnum.optional().nullable(),
  pan: z.string()
    .trim()
    .toUpperCase()
    .regex(panRegex, 'Invalid PAN format')
    .optional()
    .nullable(),
  email: z.string().email('Invalid email address').max(255).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  mobile: z.string().max(20).optional().nullable(),
  website: z.string().max(255).optional().nullable(),
  paymentTermId: z.string().uuid('Invalid payment term ID').optional().nullable(),
  defaultTaxRateId: z.string().uuid('Invalid tax rate ID').optional().nullable(),
  creditLimit: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'creditLimit must be a valid number',
  }),
  openingBalance: z.union([z.number(), z.string()]).optional().default(0).refine((val) => !isNaN(Number(val)), {
    message: 'openingBalance must be a valid number',
  }),
  contactGroupId: z.string().uuid('Invalid contact group ID').optional().nullable(),
  contactGroup: z.string().max(100).optional().nullable(),
  weeklyOff: z.string().max(20).optional().nullable(),
  visitFrequency: z.string().max(20).optional().default('monthly'),
  preferredVisitWeek: z.string().max(20).optional().default('any'),
  preferredTransporterId: z.string().max(255).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
  salesPriceListId: z.string().uuid('Invalid sales price list ID').optional().nullable(),
  purchasePriceListId: z.string().uuid('Invalid purchase price list ID').optional().nullable(),
  addresses: z.array(addressSchema).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const createBulkContactSchema = z.object({
  contacts: z.array(createContactSchema).min(1, 'At least one contact is required'),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateBulkContactInput = z.infer<typeof createBulkContactSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
