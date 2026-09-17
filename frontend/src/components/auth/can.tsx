'use client';

import React, { ReactNode } from 'react';
import { useAuth } from '@/providers/auth-provider';

interface CanProps {
  I: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally render elements based on user permissions or roles.
 * 
 * Usage:
 *   <Can I="invoices:create">
 *     <Button>Create Invoice</Button>
 *   </Can>
 */
export function Can({ I, children, fallback = null }: CanProps) {
  const { hasPermission, user } = useAuth();

  if (!user) return <>{fallback}</>;

  // Owner and Admin have wildcard access
  if (user.role === 'owner' || user.role === 'admin') {
    return <>{children}</>;
  }

  const permissionsToCheck = Array.isArray(I) ? I : [I];
  const isAllowed = permissionsToCheck.some((perm) => hasPermission(perm));

  if (isAllowed) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
