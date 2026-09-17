import { z } from 'zod';

export const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const contactAddressSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().max(100).optional().default('Main'),
  addressLine1: z.string().min(1, 'Address line 1 is required').max(500),
  addressLine2: z.string().max(500).optional().nullable().or(z.literal('')),
  city: z.string().min(1, 'City is required').max(100),
  stateCode: z.string().length(2, 'State code must be exactly 2 characters').toUpperCase(),
  stateName: z.string().min(1, 'State name is required').max(100),
  pincode: z.string().refine((val) => !val || /^[0-9]{6}$/.test(val), 'Pincode must be exactly 6 digits').optional().nullable().or(z.literal('')),
  country: z.string().max(100).optional().default('India'),
  isBillingDefault: z.boolean().optional().default(false),
  isShippingDefault: z.boolean().optional().default(false),
});

export const createContactSchema = z.object({
  type: z.enum(['customer', 'vendor', 'both']).optional().default('customer'),
  companyName: z.string().max(255).optional().nullable().or(z.literal('')),
  displayName: z.string().min(1, 'Display name is required').max(255),
  contactPerson: z.string().max(255).optional().nullable().or(z.literal('')),
  gstin: z.string()
    .trim()
    .toUpperCase()
    .refine((val) => !val || gstinRegex.test(val), {
      message: 'Invalid Indian GSTIN format (e.g., 07AAAAA1111A1Z1)',
    })
    .optional()
    .nullable()
    .or(z.literal('')),
  gstRegistrationType: z.enum(['regular', 'composition', 'unregistered', 'consumer', 'sez', 'deemed_export']).optional().nullable().or(z.literal('')),
  pan: z.string()
    .trim()
    .toUpperCase()
    .refine((val) => !val || panRegex.test(val), {
      message: 'Invalid PAN format (e.g., AAAAA1111A)',
    })
    .optional()
    .nullable()
    .or(z.literal('')),
  email: z.string()
    .refine((val) => !val || z.string().email().safeParse(val).success, {
      message: 'Invalid email address',
    })
    .max(255)
    .optional()
    .nullable()
    .or(z.literal('')),
  phone: z.string().max(20).optional().nullable().or(z.literal('')),
  mobile: z.string().max(20).optional().nullable().or(z.literal('')),
  website: z.string().max(255).optional().nullable().or(z.literal('')),
  paymentTermId: z.string().uuid('Invalid payment term ID').optional().nullable().or(z.literal('')),
  defaultTaxRateId: z.string().uuid('Invalid tax rate ID').optional().nullable().or(z.literal('')),
  creditLimit: z.coerce.number().min(0, 'Credit limit cannot be negative').optional().default(0),
  openingBalance: z.coerce.number().optional().default(0),
  contactGroupId: z.string().uuid('Invalid contact group ID').optional().nullable().or(z.literal('')),
  contactGroup: z.string().max(100).optional().nullable().or(z.literal('')),
  weeklyOff: z.string().max(20).optional().nullable().or(z.literal('')),
  visitFrequency: z.string().max(20).optional().default('monthly'),
  preferredVisitWeek: z.string().max(20).optional().default('any'),
  preferredTransporterId: z.string().max(255).optional().nullable().or(z.literal('')),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().max(2000).optional().nullable().or(z.literal('')),
  addresses: z.array(contactAddressSchema).optional().default([]),
});

export const updateContactSchema = createContactSchema.partial();

export type CreateContactFormData = z.infer<typeof createContactSchema>;
export type UpdateContactFormData = z.infer<typeof updateContactSchema>;
export type ContactAddressFormData = z.infer<typeof contactAddressSchema>;
