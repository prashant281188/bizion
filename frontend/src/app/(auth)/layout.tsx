'use client';

import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (user?.role === 'customer') {
        router.replace('/portal');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-900">
        <div className="relative flex flex-col items-center">
          {/* Animated pulsing gradient background spinner */}
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-zinc-200 border-t-brand-600"></div>
          <p className="mt-4 text-sm font-medium text-zinc-500 animate-pulse">Loading Bizion...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Redirecting...
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 px-4 py-12 sm:px-6 lg:px-8">
      {/* Background ambient lighting effects (vibrant mesh gradients) */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-brand-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none"></div>

      <div className="relative w-full max-w-md space-y-8">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="group flex items-center space-x-2">
            <span className="bg-gradient-to-r from-brand-600 to-indigo-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent transition-all duration-300 group-hover:scale-105">
              {APP_NAME}
            </span>
          </Link>
          <p className="mt-2 text-sm text-zinc-500">
            Modern Business Management & Indian GST Compliance Platform
          </p>
        </div>

        {/* Auth form container with glassmorphic styling */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200/60 bg-white/70 p-8 shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
          {children}
        </div>

        {/* Footer links */}
        <div className="text-center text-xs text-zinc-500">
          &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </div>
      </div>
    </div>
  );
}
