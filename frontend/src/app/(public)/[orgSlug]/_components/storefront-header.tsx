'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useStorefront } from './storefront-provider';
import { Menu, X, ArrowRight, Compass } from 'lucide-react';

export function StorefrontHeader({ navLinks }: { navLinks: { label: string; href: string }[] }) {
  const { org, orgSlug } = useStorefront();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!org) return null;

  const tagline = org.settings?.storefront?.tagline || 'Luxury Architectural & Furniture Fittings';
  const showAnnouncement = !!org.settings?.storefront?.showAnnouncementBar && !!org.settings?.storefront?.announcementBar;
  const exploreBtnText = org.settings?.storefront?.exploreButtonText || 'Explore Catalog';
  const exploreBtnUrl = org.settings?.storefront?.exploreButtonUrl || `/${orgSlug}/products`;

  return (
    <>
      {showAnnouncement && (
        <div className="bg-amber-600 text-white text-[11px] font-semibold py-1.5 px-4 text-center tracking-wide">
          {org.settings?.storefront?.announcementBar}
        </div>
      )}
      <header className="sticky top-0 z-50 w-full border-b border-stone-200/80 bg-white/90 backdrop-blur-xl shadow-xs transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          
          {/* Brand Logo & Name */}
          <Link href={`/${orgSlug}`} className="flex items-center gap-3 group">
            {org.logoUrl ? (
              <img
                src={org.logoUrl}
                alt={org.name}
                className="h-9 w-9 rounded-xl object-contain bg-stone-50 border border-stone-200 p-0.5 group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 shadow-sm text-white font-extrabold text-base group-hover:scale-105 transition-transform">
                {org.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-stone-900 group-hover:text-amber-700 transition-colors">
                {org.name}
              </span>
              <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                <Compass className="w-3 h-3 text-amber-600" />
                {tagline}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-1.5 md:flex bg-stone-100/80 p-1.5 rounded-full border border-stone-200/80">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Portal Login & Browse Hardware Catalog CTAs */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="text-xs font-bold text-stone-600 hover:text-stone-900 transition-colors px-3 py-2"
            >
              Portal Login
            </Link>
            <Link
              href={exploreBtnUrl}
              className="rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-all flex items-center gap-1.5 shadow-xs"
            >
              {exploreBtnText}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile Menu Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex md:hidden h-9 w-9 rounded-xl border border-stone-200 text-stone-700"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="border-b border-stone-200 bg-white px-6 py-4 md:hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col gap-3">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`text-sm font-semibold p-2.5 rounded-xl transition-colors ${
                      isActive ? 'bg-amber-50 text-amber-800 font-bold' : 'text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <hr className="border-stone-200 my-1" />
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-semibold text-stone-700 p-2.5 rounded-xl hover:bg-stone-50"
              >
                Portal Login
              </Link>
              <Link
                href={exploreBtnUrl}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center rounded-full bg-amber-600 py-3 text-sm font-bold text-white hover:bg-amber-700 transition-colors shadow-xs"
              >
                {exploreBtnText}
              </Link>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
