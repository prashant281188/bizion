import { z } from 'zod';

export const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const orgSettingsSchema = z.object({
  name: z.string().min(1, 'Business name is required').max(255),
  slug: z.string().optional(),
  legalName: z.string().max(255).optional().nullable().or(z.literal('')),
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
  tan: z.string().max(10).optional().nullable().or(z.literal('')),
  cin: z.string().max(21).optional().nullable().or(z.literal('')),
  addressLine1: z.string().max(500).optional().nullable().or(z.literal('')),
  addressLine2: z.string().max(500).optional().nullable().or(z.literal('')),
  city: z.string().max(100).optional().nullable().or(z.literal('')),
  stateCode: z.string().length(2, 'State code must be exactly 2 characters').toUpperCase().optional().nullable().or(z.literal('')),
  stateName: z.string().max(100).optional().nullable().or(z.literal('')),
  pincode: z.string()
    .refine((val) => !val || (val.length === 6 && /^[0-9]{6}$/.test(val)), {
      message: 'Pincode must be exactly 6 digits',
    })
    .optional()
    .nullable()
    .or(z.literal('')),
  country: z.string().max(100).optional().nullable().or(z.literal('')),
  email: z.string()
    .refine((val) => !val || z.string().email().safeParse(val).success, {
      message: 'Invalid email address',
    })
    .max(255)
    .optional()
    .nullable()
    .or(z.literal('')),
  phone: z.string().max(20).optional().nullable().or(z.literal('')),
  website: z.string().max(255).optional().nullable().or(z.literal('')),
  logoUrl: z.string().max(1000).optional().nullable().or(z.literal('')),
  fyStartMonth: z.coerce.number().int().min(1).max(12).default(4),
  defaultCurrency: z.string().length(3).toUpperCase().default('INR'),
  settings: z.object({
    invoicePrefix: z.string().max(50).optional().default('INV-'),
    nextInvoiceNumber: z.coerce.number().int().min(1).optional().default(1),
    invoiceTerms: z.string().max(2000).optional().nullable().or(z.literal('')),
    invoiceNotes: z.string().max(2000).optional().nullable().or(z.literal('')),
    bankName: z.string().max(255).optional().nullable().or(z.literal('')),
    bankBranch: z.string().max(255).optional().nullable().or(z.literal('')),
    bankAccountNumber: z.string().max(50).optional().nullable().or(z.literal('')),
    bankIfscCode: z.string().max(11).toUpperCase().optional().nullable().or(z.literal('')),
    upiId: z.string().max(100).optional().nullable().or(z.literal('')),
    defaultPaymentTermId: z.string().uuid().optional().nullable().or(z.literal('')),
    storefrontCarousel: z.array(
      z.object({
        badge: z.string().max(100).optional().default(''),
        title: z.string().min(1, 'Title is required').max(200),
        desc: z.string().max(500).optional().default(''),
      })
    ).optional().default([]),
    financialYears: z.array(
      z.object({
        label: z.string().min(1, 'Label is required').max(50),
        isActive: z.boolean().default(true),
        prefixes: z.record(z.string(), z.string()).default({}),
      })
    ).optional().default([]),
    invoiceCustomFields: z.array(
      z.object({
        id: z.string(),
        label: z.string().min(1, 'Field label is required').max(100),
        type: z.enum(['text', 'number', 'date']).default('text'),
        required: z.boolean().default(false),
        showOnPrint: z.boolean().default(true),
      })
    ).optional().default([]),
    storefront: z.object({
      tagline: z.string().max(255).optional().default(''),
      announcementBar: z.string().max(300).optional().default(''),
      showAnnouncementBar: z.boolean().default(false),
      exploreButtonText: z.string().max(50).optional().default('Explore Catalog'),
      exploreButtonUrl: z.string().max(500).optional().default(''),
      requestQuoteButtonText: z.string().max(50).optional().default('Request Quotation'),
      requestQuoteButtonUrl: z.string().max(500).optional().default(''),
      aboutBadge: z.string().max(100).optional().default(''),
      aboutTitle: z.string().max(200).optional().default(''),
      aboutDescription: z.string().max(2000).optional().default(''),
      aboutParagraph1: z.string().max(2000).optional().default(''),
      aboutParagraph2: z.string().max(2000).optional().default(''),
      contactBadge: z.string().max(100).optional().default(''),
      contactTitle: z.string().max(200).optional().default(''),
      contactDescription: z.string().max(2000).optional().default(''),
      footerDescription: z.string().max(500).optional().default(''),
      trustBadges: z.array(
        z.object({
          title: z.string().min(1, 'Badge title is required').max(100),
          description: z.string().max(300).optional().default(''),
        })
      ).optional().default([]),
    }).optional().default({
      tagline: '',
      announcementBar: '',
      showAnnouncementBar: false,
      exploreButtonText: 'Explore Catalog',
      exploreButtonUrl: '',
      requestQuoteButtonText: 'Request Quotation',
      requestQuoteButtonUrl: '',
      aboutBadge: '',
      aboutTitle: '',
      aboutDescription: '',
      aboutParagraph1: '',
      aboutParagraph2: '',
      contactBadge: '',
      contactTitle: '',
      contactDescription: '',
      footerDescription: '',
      trustBadges: [],
    }),
  }).passthrough().optional().default({
    invoicePrefix: 'INV-',
    nextInvoiceNumber: 1,
    invoiceTerms: '',
    invoiceNotes: '',
    bankName: '',
    bankBranch: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    upiId: '',
    storefrontCarousel: [],
    financialYears: [],
    invoiceCustomFields: [],
    storefront: {
      tagline: '',
      announcementBar: '',
      showAnnouncementBar: false,
      exploreButtonText: 'Explore Catalog',
      exploreButtonUrl: '',
      requestQuoteButtonText: 'Request Quotation',
      requestQuoteButtonUrl: '',
      aboutBadge: '',
      aboutTitle: '',
      aboutDescription: '',
      aboutParagraph1: '',
      aboutParagraph2: '',
      contactBadge: '',
      contactTitle: '',
      contactDescription: '',
      footerDescription: '',
      trustBadges: [],
    },
  }),
});

export type OrgSettingsInput = z.infer<typeof orgSettingsSchema>;
