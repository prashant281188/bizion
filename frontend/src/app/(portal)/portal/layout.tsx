'use client';

import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { PortalTopbar } from '@/components/layout/portal-topbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';

export default function PortalLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If not loading and not authenticated, go to login
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
    // If authenticated but not a customer, redirect to dashboard
    else if (!isLoading && isAuthenticated && user?.role !== 'customer') {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, router, user]);

  // Show loading spinner while checking auth
  if (isLoading || !isAuthenticated || user?.role !== 'customer') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col bg-slate-50 text-zinc-900">
        <div className="print:hidden">
          <PortalTopbar />
        </div>

        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 focus:outline-none print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
