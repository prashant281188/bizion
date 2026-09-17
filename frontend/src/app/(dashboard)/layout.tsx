'use client';

import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';

import { GlobalRecordPaymentModal } from '@/components/payments/global-record-payment-modal';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (user?.role === 'customer') {
        router.replace('/portal');
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading || (isAuthenticated && user?.role === 'customer')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbfbf9] text-zinc-900">
        <div className="relative flex flex-col items-center">
          <Loader2 className="h-16 w-16 animate-spin text-amber-700" />
          <p className="mt-4 text-sm font-medium text-zinc-500 animate-pulse">Loading console...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Redirecting to login...
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar />
        <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-[#fbfbf9] text-zinc-900 print:h-auto print:w-auto print:overflow-visible print:bg-white">
          <div className="print:hidden">
            <Topbar />
          </div>

          <main className="flex-1 overflow-y-auto px-6 py-6 focus:outline-none print:overflow-visible print:p-0">
            {children}
          </main>
          <GlobalRecordPaymentModal />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
