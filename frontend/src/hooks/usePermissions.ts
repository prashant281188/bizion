'use client';

// ============================================================
// Bizion — usePermissions Hook
// Central RBAC hook for frontend role-based access control
// ============================================================

import { useAuth } from '@/providers/auth-provider';

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  agent: 1,
  accountant: 2,
  manager: 3,
  admin: 4,
  owner: 5,
};

function getRoleLevel(role?: string): number {
  if (!role) return -1;
  return ROLE_HIERARCHY[role] ?? -1;
}

export function usePermissions() {
  const { user } = useAuth();
  const level = getRoleLevel(user?.role);

  return {
    // Current user info
    role: user?.role ?? 'viewer',
    roleLevel: level,

    // Hierarchy checks
    isViewer: level >= 0,
    isAgent: level >= 1,
    isAccountant: level >= 2,
    isManager: level >= 3,
    isAdmin: level >= 4,
    isOwner: level >= 5,

    // Functional permission flags
    canCreateOrders: level >= 1,       // agent+
    canApproveOrders: level >= 3,      // manager+
    canCreateInvoices: level >= 1,     // agent+
    canDeleteInvoices: level >= 3,     // manager+
    canCreatePayments: level >= 1,     // agent+
    canManageBankAccounts: level >= 3, // manager+
    canCreateProducts: level >= 3,     // manager+
    canEditProducts: level >= 3,       // manager+
    canDeleteProducts: level >= 3,     // manager+
    canAdjustInventory: level >= 1,    // agent+
    canManageWarehouses: level >= 3,   // manager+
    canViewReports: level >= 2,        // accountant+
    canManageUsers: level >= 4,        // admin+
    canViewUsers: level >= 3,          // manager+
    canManageMasters: level >= 3,      // manager+
    canManageSettings: level >= 4,     // admin+
    canApproveDispatches: level >= 3,  // manager+

    // Helper: check if user has at least a minimum role
    hasMinRole: (minRole: string) => level >= (ROLE_HIERARCHY[minRole] ?? Infinity),
  };
}
