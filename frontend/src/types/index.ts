// ============================================================
// Bizion — TypeScript Type Definitions
// ============================================================

// ----- Enums & Unions -----

export type UserRole = 'owner' | 'admin' | 'manager' | 'accountant' | 'sales' | 'viewer' | 'customer';

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'refunded';

export type PaymentMode =
  | 'cash'
  | 'bank_transfer'
  | 'upi'
  | 'cheque'
  | 'credit_card'
  | 'debit_card'
  | 'net_banking'
  | 'wallet'
  | 'other';

export type ContactType = 'customer' | 'vendor' | 'both';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type JournalEntryType = 'debit' | 'credit';

export type ProductType = 'goods' | 'services';

export type DiscountType = 'percentage' | 'fixed';

// ----- Base -----

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

// ----- Organization -----

export interface Organization extends Timestamps {
  id: string;
  name: string;
  legalName: string;
  gstin?: string;
  pan?: string;
  cin?: string;
  email: string;
  phone: string;
  website?: string;
  logo?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    stateCode: string;
    pincode: string;
    country: string;
  };
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branch: string;
    accountType: string;
  };
  settings: {
    financialYearStart: number; // month 1-12
    currency: string;
    invoicePrefix: string;
    invoiceNextNumber: number;
    termsAndConditions?: string;
    defaultPaymentTermDays: number;
  };
}

// ----- User -----

export interface User extends Timestamps {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  permissions?: string[];
  orgId: string;
  isActive: boolean;
  lastLoginAt?: string;
}

// ----- Product -----

export interface ProductImage {
  id: string;
  orgId: string;
  productId: string;
  variantId?: string | null;
  url: string;
  thumbnailUrl?: string | null;
  altText?: string | null;
  sortOrder: number;
  isPrimary: boolean;
  createdAt?: string;
}

export interface ProductVariant extends Timestamps {
  id: string;
  orgId: string;
  productId: string;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  attributes: Record<string, any>;
  basePrice: string;
  sellingPrice: string;
  costPrice: string;
  mrp: string;
  listPrice: string;
  defaultPacking?: string | null;
  boxQuantity?: number;
  purchaseMode?: 'direct' | 'list' | null;
  discountPct?: string | null;
  marginPct?: string | null;
  salesDiscountPct?: string | null;
  stockQuantity: number;
  openingQuantity?: number;
  lowStockThreshold: number;
  isActive: boolean;
  sortOrder: number;
  valuationCost?: string;
  categoryId?: string | null;
  categoryName?: string;
  imageUrl?: string | null;
}

export interface ProductVariantPriceHistory {
  id: string;
  basePrice: string;
  sellingPrice: string;
  costPrice: string;
  mrp: string;
  listPrice: string;
  discountPct: string;
  marginPct: string;
  salesDiscountPct?: string;
  createdAt: string;
  createdBy?: string | null;
  user?: {
    firstName: string;
    lastName: string | null;
    email: string;
  } | null;
}

export interface Product extends Timestamps {
  id: string;
  orgId: string;
  categoryId?: string | null;
  brandId?: string | null;
  taxRateId?: string | null;
  hsnCodeId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  type: ProductType;
  sku?: string | null;
  barcode?: string | null;
  basePrice: string;
  sellingPrice: string;
  costPrice: string;
  mrp: string;
  purchaseMode: 'direct' | 'list';
  discountPct: string;
  marginPct: string;
  salesDiscountPct?: string;
  listPrice: string;
  uomId?: string | null;
  valuationCost?: string;
  hasVariants: boolean;
  isTaxable: boolean;
  trackInventory: boolean;
  status: 'active' | 'inactive' | 'draft' | 'archived';
  defaultPacking?: string | null;
  boxQuantity?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
  tags: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  attributes?: Record<string, string> | null;
  isActive?: boolean; // left for backward compatibility

  // Joined fields (from list query)
  categoryName?: string;
  stockQuantity?: number;
  openingQuantity?: number;
  brandName?: string;
  uomCode?: string;
  hsnCode?: any;
  hsnDescription?: string;

  // Relation contexts (from detail query)
  category?: any;
  brand?: any;
  taxRate?: any;
  uom?: any;
}

export interface ContactAddress {
  id: string;
  orgId?: string;
  contactId?: string;
  label: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  stateCode: string;
  stateName: string;
  pincode: string;
  country: string;
  isBillingDefault: boolean;
  isShippingDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactGroup extends Timestamps {
  id: string;
  orgId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface Contact extends Timestamps {
  id: string;
  orgId: string;
  type: 'customer' | 'vendor' | 'both';
  displayName: string;
  companyName?: string | null;
  contactPerson?: string | null;
  gstin?: string | null;
  gstRegistrationType?: 'regular' | 'composition' | 'unregistered' | 'consumer' | 'sez' | 'deemed_export' | null;
  pan?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  website?: string | null;
  paymentTermId?: string | null;
  defaultTaxRateId?: string | null;
  creditLimit: string | number;
  openingBalance: string | number;
  contactGroupId?: string | null;
  contactGroup?: string | null; // deprecated text field
  weeklyOff?: string | null;
  visitFrequency?: string | null;
  preferredVisitWeek?: string | null;
  preferredTransporterId?: string | null;
  preferredTransporter?: string | null;
  groupName?: string | null; // populated from backend join
  hasPortalAccess?: boolean; // populated from backend join
  portalUserId?: string | null; // populated from backend join
  tags?: string[] | null;
  notes?: string | null;
  isActive: boolean;
  addresses: ContactAddress[];
}

// ----- Invoice -----

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  productId?: string;
  variantId?: string;
  description: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  cessRate: number;
  cessAmount: number;
  totalAmount: number;
  sortOrder: number;
}

export interface Invoice extends Timestamps {
  id: string;
  orgId: string;
  invoiceNumber: string;
  contactId: string;
  contact?: Contact;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  placeOfSupply: string;
  isInterState: boolean;
  billingAddress: ContactAddress;
  shippingAddress?: ContactAddress;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  totalDiscount: number;
  totalTaxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  notes?: string;
  termsAndConditions?: string;
  pdfUrl?: string;
}

// ----- Payment -----

export interface BankAccount extends Timestamps {
  id: string;
  orgId: string;
  accountName: string;
  bankName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  branch?: string | null;
  accountType?: string | null;
  upiId?: string | null;
  openingBalance: string | number;
  currentBalance: string | number;
  isDefault: boolean;
  isActive: boolean;
  ledgerAccountId?: string | null;
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  invoice?: Invoice;
}

export interface Payment extends Timestamps {
  id: string;
  orgId: string;
  paymentNumber: string;
  contactId: string;
  contact?: Contact;
  amount: number;
  paymentDate: string;
  direction: 'inbound' | 'outbound';
  paymentMode: PaymentMode;
  referenceNumber?: string;
  bankName?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded' | 'cancelled';
  notes?: string;
  allocations: PaymentAllocation[];
  unallocatedAmount: number;
  unusedAmount: number;
}

// ----- Reference Data -----

export interface Category extends Timestamps {
  id: string;
  orgId: string;
  parentId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Brand extends Timestamps {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  isActive: boolean;
}

export interface TaxRate extends Timestamps {
  id: string;
  orgId: string;
  name: string;
  ratePercentage: string;
  cgstRate: string;
  sgstRate: string;
  igstRate: string;
  cessRate: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface Unit extends Timestamps {
  id: string;
  orgId: string;
  code: string;
  name: string;
  uqcCode?: string | null;
  isDefault: boolean;
}

export interface PaymentTerm extends Timestamps {
  id: string;
  orgId: string;
  name: string;
  dueDays: number;
  isDefault: boolean;
}

export interface HsnCode {
  id: string;
  orgId: string;
  code: string;
  description: string;
  type: 'goods' | 'services';
  taxRateId: string;
  gstRate: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface HsnRateHistory {
  id: string;
  orgId: string;
  hsnCodeId: string;
  previousRate: string | null;
  newRate: string;
  effectiveFrom: string;
  reason: string | null;
  changedBy: string | null;
  createdAt: string;
}

// ----- Inventory -----

export interface Warehouse extends Timestamps {
  id: string;
  orgId: string;
  name: string;
  code: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  isDefault: boolean;
  isActive: boolean;
}

export interface InventoryItem extends Timestamps {
  id: string;
  orgId: string;
  productId: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  product?: Product;
  variant?: ProductVariant;
  warehouse?: Warehouse;
}

// ----- Accounting -----

export interface Account extends Timestamps {
  id: string;
  orgId: string;
  name: string;
  code: string;
  type: AccountType;
  parentId?: string;
  description?: string;
  balance: number;
  isSystem: boolean;
  isActive: boolean;
}

export interface JournalEntry extends Timestamps {
  id: string;
  orgId: string;
  date: string;
  referenceType: string;
  referenceId: string;
  description: string;
  lines: {
    id: string;
    accountId: string;
    account?: Account;
    type: JournalEntryType;
    amount: number;
    description?: string;
  }[];
}

// ----- API Response Wrappers -----

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ----- Auth -----

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string; // httpOnly cookie, not always returned
  expiresIn: number;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  organizationName: string;
  organizationLegalName?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  orgId: string;
  avatar?: string;
  companyName?: string;
  contactId?: string;
  gstin?: string;
  permissions?: string[];
}
