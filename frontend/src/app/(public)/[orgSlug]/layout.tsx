import React from 'react';
import Link from 'next/link';
import { StorefrontHeader } from './_components/storefront-header';
import { StorefrontFooter } from './_components/storefront-footer';
import { StorefrontProvider } from './_components/storefront-provider';
import { Metadata } from 'next';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const orgSlug = resolvedParams.orgSlug;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  
  try {
    const res = await fetch(`${baseUrl}/products/public/${orgSlug}/organization`, { cache: 'no-store' });
    if (!res.ok) return { title: 'Storefront Not Found' };
    const json = await res.json();
    const org = json.data;

    return {
      title: `${org.name} | Bizion Storefront`,
      description: `Welcome to ${org.name}'s official storefront. Browse our products and services.`,
      openGraph: {
        title: `${org.name} | Storefront`,
        description: `Welcome to ${org.name}'s official storefront.`,
        images: org.logoUrl ? [{ url: org.logoUrl }] : [],
      }
    };
  } catch (error) {
    return { title: 'Storefront' };
  }
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const resolvedParams = await params;
  const orgSlug = resolvedParams.orgSlug;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  let org = null;
  let error = false;

  try {
    const res = await fetch(`${baseUrl}/products/public/${orgSlug}/organization`, { cache: 'no-store' });
    if (!res.ok) {
      error = true;
    } else {
      const json = await res.json();
      org = json.data;
    }
  } catch (err) {
    console.error('Failed to load storefront details:', err);
    error = true;
  }

  if (error || !org) {
    return (
      <div className={`flex min-h-screen items-center justify-center bg-white text-zinc-900 px-6 ${outfit.className}`}>
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-sm bg-red-500/10 text-red-500 border border-red-500/20">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mb-2">Storefront Not Found</h1>
          <p className="text-sm text-zinc-500 mb-8">
            The storefront you are trying to reach does not exist or has been disabled.
          </p>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-sm bg-zinc-200 px-6 text-sm font-semibold text-zinc-850 hover:bg-zinc-300 transition-colors"
          >
            Go to Bizion Home
          </Link>
        </div>
      </div>
    );
  }

  const navLinks = [
    { label: 'Home', href: `/${orgSlug}` },
    { label: 'Products', href: `/${orgSlug}/products` },
    { label: 'Presentation', href: `/${orgSlug}/presentation` },
    { label: 'About', href: `/${orgSlug}/about` },
    { label: 'Contact', href: `/${orgSlug}/contact` },
  ];

  return (
    <StorefrontProvider org={org} orgSlug={orgSlug}>
      <div className={`relative min-h-screen bg-stone-50/60 text-stone-900 flex flex-col ${outfit.className} selection:bg-amber-100 selection:text-amber-900 overflow-x-hidden`}>
        
        {/* Catalog Watermark Background Layer */}
        <div 
          className="fixed inset-0 pointer-events-none z-0 opacity-15 bg-repeat bg-center"
          style={{ 
            backgroundImage: `url('/catalog_watermark.jpg')`,
            backgroundSize: '450px auto' 
          }}
        />

        {/* Decorative background ambient glows */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center">
          <div className="absolute w-[800px] h-[800px] rounded-full bg-amber-500/5 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute w-[600px] h-[600px] rounded-full bg-stone-300/30 blur-[100px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        </div>

        {/* Foreground Content Stack */}
        <div className="relative z-10 flex flex-col min-h-screen">
          {/* Dynamic Nav Header */}
          <StorefrontHeader navLinks={navLinks} />

          {/* Main Content Area */}
          <main className="flex-grow flex flex-col">
            {children}
          </main>

          {/* Footer */}
          <StorefrontFooter navLinks={navLinks} />
        </div>

      </div>
    </StorefrontProvider>
  );
}
