// ============================================================
// Bizion — Application Constants
// ============================================================

export const APP_NAME = 'Bizion';
export const APP_DESCRIPTION = 'Modern Business Management Platform';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ----- API Routes -----

export const API_ROUTES = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh-token',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    ME: '/auth/me',
  },
  // Organization
  ORGANIZATION: {
    ME: '/organizations/me',
  },
  // Users
  USERS: {
    BASE: '/users',
    BY_ID: (id: string) => `/users/${id}`,
    CREATE: '/users/create',
    PERMISSIONS: '/users/permissions-list',
  },
  // Products
  PRODUCTS: {
    BASE: '/products',
    BY_ID: (id: string) => `/products/${id}`,
    VARIANTS: (id: string) => `/products/${id}/variants`,
    IMAGES: (id: string) => `/products/${id}/images`,
    SEARCH: '/products/search',
  },
  // Contacts
  CONTACTS: {
    BASE: '/contacts',
    BY_ID: (id: string) => `/contacts/${id}`,
    CUSTOMERS: '/contacts?type=customer',
    VENDORS: '/contacts?type=vendor',
    SEARCH: '/contacts/search',
  },
  // Invoices
  INVOICES: {
    BASE: '/invoices',
    BY_ID: (id: string) => `/invoices/${id}`,
    PDF: (id: string) => `/invoices/${id}/pdf`,
    SEND: (id: string) => `/invoices/${id}/send`,
    NEXT_NUMBER: '/invoices/next-number',
  },
  // Payments
  PAYMENTS: {
    BASE: '/payments',
    BY_ID: (id: string) => `/payments/${id}`,
    ALLOCATE: (id: string) => `/payments/${id}/allocate`,
  },
  // Categories
  CATEGORIES: {
    BASE: '/categories',
    BY_ID: (id: string) => `/categories/${id}`,
  },
  // Brands
  BRANDS: {
    BASE: '/brands',
    BY_ID: (id: string) => `/brands/${id}`,
  },
  // Units
  UNITS: {
    BASE: '/units',
    BY_ID: (id: string) => `/units/${id}`,
  },
  // Contact Groups
  CONTACT_GROUPS: {
    BASE: '/contact-groups',
    BY_ID: (id: string) => `/contact-groups/${id}`,
  },
  // Inventory
  INVENTORY: {
    BASE: '/inventory',
    BY_PRODUCT: (productId: string) => `/inventory/product/${productId}`,
    WAREHOUSES: '/inventory/warehouses',
  },
  // Accounting
  ACCOUNTING: {
    ACCOUNTS: '/accounting/accounts',
    JOURNAL_ENTRIES: '/accounting/journal-entries',
  },
  // Dashboard
  DASHBOARD: {
    STATS: '/dashboard/stats',
    REVENUE_CHART: '/dashboard/revenue-chart',
    RECENT_INVOICES: '/dashboard/recent-invoices',
    TOP_CUSTOMERS: '/dashboard/top-customers',
  },
} as const;

// ----- Indian States -----

export const INDIAN_STATES = [
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '37', name: 'Andhra Pradesh (New)' },
  { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '18', name: 'Assam' },
  { code: '10', name: 'Bihar' },
  { code: '04', name: 'Chandigarh' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '25', name: 'Daman & Diu' },
  { code: '07', name: 'Delhi' },
  { code: '30', name: 'Goa' },
  { code: '24', name: 'Gujarat' },
  { code: '06', name: 'Haryana' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '20', name: 'Jharkhand' },
  { code: '29', name: 'Karnataka' },
  { code: '32', name: 'Kerala' },
  { code: '38', name: 'Ladakh' },
  { code: '31', name: 'Lakshadweep' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '27', name: 'Maharashtra' },
  { code: '14', name: 'Manipur' },
  { code: '17', name: 'Meghalaya' },
  { code: '15', name: 'Mizoram' },
  { code: '13', name: 'Nagaland' },
  { code: '21', name: 'Odisha' },
  { code: '34', name: 'Puducherry' },
  { code: '03', name: 'Punjab' },
  { code: '08', name: 'Rajasthan' },
  { code: '11', name: 'Sikkim' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' },
  { code: '16', name: 'Tripura' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '19', name: 'West Bengal' },
] as const;

// ----- GST Rates -----

export const GST_RATES = [
  { rate: 0, label: 'Exempt (0%)' },
  { rate: 0.25, label: '0.25%' },
  { rate: 3, label: '3%' },
  { rate: 5, label: '5%' },
  { rate: 12, label: '12%' },
  { rate: 18, label: '18%' },
  { rate: 28, label: '28%' },
] as const;

// ----- User Roles -----

export const USER_ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  accountant: 'Accountant',
  agent: 'Agent',
  viewer: 'Viewer',
};

export const USER_ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-50 text-amber-850 border-amber-200',
  admin: 'bg-amber-50 text-amber-850 border-amber-200',
  manager: 'bg-blue-50 text-blue-850 border-blue-200',
  accountant: 'bg-amber-50 text-amber-850 border-amber-200',
  agent: 'bg-amber-50 text-amber-850 border-amber-200',
  viewer: 'bg-zinc-50 text-zinc-700 border-zinc-200',
};

// ----- Invoice Status -----

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  sent: 'bg-blue-50 text-blue-850 border-blue-200',
  viewed: 'bg-cyan-50 text-cyan-850 border-cyan-200',
  partially_paid: 'bg-amber-50 text-amber-850 border-amber-200',
  paid: 'bg-amber-50 text-amber-850 border-amber-200',
  overdue: 'bg-red-50 text-red-850 border-red-200',
  cancelled: 'bg-zinc-100 text-zinc-500 border-zinc-200',
  refunded: 'bg-purple-50 text-purple-850 border-purple-200',
};

// ----- Payment Modes -----

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  upi: 'UPI',
  cheque: 'Cheque',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  net_banking: 'Net Banking',
  wallet: 'Wallet',
  other: 'Other',
};

// ----- Contact Types -----

export const CONTACT_TYPE_LABELS: Record<string, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
  both: 'Customer & Vendor',
};

// ----- Pagination Defaults -----

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
