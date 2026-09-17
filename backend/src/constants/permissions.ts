/**
 * Master Permission Definitions for Bizion Platform
 */

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
}

export interface PermissionModule {
  module: string;
  label: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    module: 'users',
    label: 'User Management & Roles',
    permissions: [
      { key: 'users:read', label: 'View Users', description: 'View organization members and their roles' },
      { key: 'users:create', label: 'Create Users', description: 'Add new staff and invite team members' },
      { key: 'users:update', label: 'Edit Users & Roles', description: 'Modify member details, roles, and status' },
      { key: 'users:delete', label: 'Deactivate Users', description: 'Deactivate and delete user accounts' },
      { key: 'roles:manage', label: 'Manage Permissions', description: 'Configure granular permission overrides' },
    ],
  },
  {
    module: 'products',
    label: 'Catalog & Products',
    permissions: [
      { key: 'products:read', label: 'View Products', description: 'Browse products, variants, and categories' },
      { key: 'products:create', label: 'Create Products', description: 'Add new catalog products and variants' },
      { key: 'products:update', label: 'Edit Products', description: 'Update product information, media, and barcodes' },
      { key: 'products:delete', label: 'Delete Products', description: 'Remove products from the catalog' },
      { key: 'prices:manage', label: 'Manage Price Lists', description: 'Set MRP, custom pricing rules, and margins' },
    ],
  },
  {
    module: 'inventory',
    label: 'Inventory & Warehousing',
    permissions: [
      { key: 'inventory:read', label: 'View Stock', description: 'Check real-time warehouse stock balances' },
      { key: 'inventory:adjust', label: 'Adjust Stock', description: 'Perform manual stock additions and subtractions' },
      { key: 'inventory:transfer', label: 'Transfer Stock', description: 'Move stock between warehouse locations' },
      { key: 'warehouses:manage', label: 'Manage Warehouses', description: 'Create and configure warehouse sites' },
    ],
  },
  {
    module: 'orders',
    label: 'Sales & Purchase Orders',
    permissions: [
      { key: 'orders:read', label: 'View Orders', description: 'View sales orders and purchase requests' },
      { key: 'orders:create', label: 'Create Orders', description: 'Draft new sales orders and purchase orders' },
      { key: 'orders:update', label: 'Edit Orders', description: 'Modify draft and active order lines' },
      { key: 'orders:cancel', label: 'Cancel Orders', description: 'Cancel existing customer or supplier orders' },
      { key: 'orders:approve', label: 'Approve Orders', description: 'Approve large value purchases and sales orders' },
    ],
  },
  {
    module: 'invoices',
    label: 'Invoices & Billing',
    permissions: [
      { key: 'invoices:read', label: 'View Invoices', description: 'View sales and purchase tax invoices' },
      { key: 'invoices:create', label: 'Generate Invoices', description: 'Create tax invoices and credit notes' },
      { key: 'invoices:update', label: 'Edit Invoices', description: 'Modify and finalize invoice draft entries' },
      { key: 'invoices:cancel', label: 'Cancel Invoices', description: 'Void or cancel issued invoices' },
      { key: 'payments:manage', label: 'Record Payments', description: 'Collect payments and manage ledger receipts' },
    ],
  },
  {
    module: 'dispatches',
    label: 'Dispatches & Logistics',
    permissions: [
      { key: 'dispatches:read', label: 'View Dispatches', description: 'View dispatch advice and manifests' },
      { key: 'dispatches:create', label: 'Create Dispatch', description: 'Generate delivery manifests and packages' },
      { key: 'dispatches:update', label: 'Update Dispatch', description: 'Mark dispatches in-transit or delivered' },
      { key: 'transporters:manage', label: 'Manage Transporters', description: 'Add and configure transport carriers' },
    ],
  },
  {
    module: 'contacts',
    label: 'Customers & Vendors',
    permissions: [
      { key: 'contacts:read', label: 'View Contacts', description: 'Browse customer and vendor directory' },
      { key: 'contacts:create', label: 'Create Contacts', description: 'Add new customers and suppliers' },
      { key: 'contacts:update', label: 'Edit Contacts', description: 'Update billing, shipping, and credit terms' },
      { key: 'contacts:delete', label: 'Delete Contacts', description: 'Remove inactive customer or vendor records' },
    ],
  },
  {
    module: 'analytics',
    label: 'Analytics & Financials',
    permissions: [
      { key: 'analytics:view_sales', label: 'View Sales Analytics', description: 'View sales velocity and customer metrics' },
      { key: 'analytics:view_inventory', label: 'View Stock Reports', description: 'View dead stock, valuation, and aging' },
      { key: 'analytics:view_financial', label: 'View Financial Reports', description: 'Access profit/loss and revenue metrics' },
    ],
  },
  {
    module: 'settings',
    label: 'Organization Settings',
    permissions: [
      { key: 'settings:read', label: 'View Org Settings', description: 'View company profile and tax setup' },
      { key: 'settings:update', label: 'Update Org Settings', description: 'Modify company profile, branding, and terms' },
    ],
  },
];

/**
 * Default role-to-permission mappings
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  admin: [
    'users:read', 'users:create', 'users:update', 'users:delete', 'roles:manage',
    'products:read', 'products:create', 'products:update', 'products:delete', 'prices:manage',
    'inventory:read', 'inventory:adjust', 'inventory:transfer', 'warehouses:manage',
    'orders:read', 'orders:create', 'orders:update', 'orders:cancel', 'orders:approve',
    'invoices:read', 'invoices:create', 'invoices:update', 'invoices:cancel', 'payments:manage',
    'dispatches:read', 'dispatches:create', 'dispatches:update', 'transporters:manage',
    'contacts:read', 'contacts:create', 'contacts:update', 'contacts:delete',
    'analytics:view_sales', 'analytics:view_inventory', 'analytics:view_financial',
    'settings:read', 'settings:update',
  ],
  manager: [
    'users:read',
    'products:read', 'products:create', 'products:update', 'prices:manage',
    'inventory:read', 'inventory:adjust', 'inventory:transfer',
    'orders:read', 'orders:create', 'orders:update', 'orders:approve',
    'invoices:read', 'invoices:create', 'invoices:update', 'payments:manage',
    'dispatches:read', 'dispatches:create', 'dispatches:update',
    'contacts:read', 'contacts:create', 'contacts:update',
    'analytics:view_sales', 'analytics:view_inventory',
    'settings:read',
  ],
  accountant: [
    'products:read',
    'inventory:read',
    'orders:read',
    'invoices:read', 'invoices:create', 'invoices:update', 'payments:manage',
    'contacts:read', 'contacts:create', 'contacts:update',
    'analytics:view_sales', 'analytics:view_financial',
  ],
  agent: [
    'products:read',
    'inventory:read',
    'orders:read', 'orders:create', 'orders:update',
    'invoices:read', 'invoices:create',
    'contacts:read', 'contacts:create',
  ],
  sales: [
    'products:read',
    'inventory:read',
    'orders:read', 'orders:create', 'orders:update',
    'contacts:read', 'contacts:create',
    'analytics:view_sales',
  ],
  viewer: [
    'products:read',
    'inventory:read',
    'orders:read',
    'invoices:read',
    'dispatches:read',
    'contacts:read',
    'analytics:view_sales',
  ],
  customer: [
    'products:read',
    'orders:read', 'orders:create',
    'invoices:read',
  ],
};

/**
 * Returns effective list of permissions given role + custom overrides
 */
export function getEffectivePermissions(role: string, customPermissions?: string[] | null): string[] {
  if (role === 'owner') return ['*'];
  const basePermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
  if (!customPermissions || customPermissions.length === 0) {
    return basePermissions;
  }
  const combined = new Set([...basePermissions, ...customPermissions]);
  return Array.from(combined);
}
