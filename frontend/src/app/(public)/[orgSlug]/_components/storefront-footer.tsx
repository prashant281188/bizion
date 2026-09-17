'use client';

import React from 'react';
import Link from 'next/link';
import { useStorefront } from './storefront-provider';
import { Mail, Phone, MapPin } from 'lucide-react';

export function StorefrontFooter({ navLinks }: { navLinks: { label: string, href: string }[] }) {
  const { org } = useStorefront();

  if (!org) return null;

  return (
    <footer className="border-t border-stone-200/80 bg-stone-100/80 text-stone-700 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-sm mb-12">
          
          {/* Organization Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {org.logoUrl ? (
                <img src={org.logoUrl} alt={org.name} className="h-9 w-9 object-contain p-0.5 bg-white rounded-xl border border-stone-200" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 text-white font-extrabold text-base">
                  {org.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-lg font-extrabold text-stone-900 tracking-tight">{org.name}</span>
            </div>
            <p className="text-xs leading-relaxed text-stone-500">
              {org.settings?.storefront?.footerDescription ||
                (org.legalName ? `Official subsidiary of ${org.legalName}.` : 'Bespoke architectural hardware, luxury furniture fittings & interior systems.')}
            </p>
          </div>

          {/* Quick Navigation Links */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">Catalog Sections</h4>
            <ul className="space-y-2.5 text-xs text-stone-600">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-amber-700 transition-colors flex items-center gap-1">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">Showroom & Contacts</h4>
            <ul className="space-y-3 text-xs text-stone-600">
              {org.email && (
                <li className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-amber-700 shrink-0" />
                  <a href={`mailto:${org.email}`} className="hover:text-amber-800 transition-colors">{org.email}</a>
                </li>
              )}
              {org.phone && (
                <li className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-amber-700 shrink-0" />
                  <span>{org.phone}</span>
                </li>
              )}
              {(org.addressLine1 || org.city) && (
                <li className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    {org.addressLine1}
                    {org.addressLine2 ? `, ${org.addressLine2}` : ''}
                    {org.city ? `, ${org.city}` : ''}
                    {org.stateName ? `, ${org.stateName}` : ''}
                    {org.pincode ? ` - ${org.pincode}` : ''}
                  </span>
                </li>
              )}
            </ul>
          </div>

        </div>

        <div className="border-t border-stone-200 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <p>© {new Date().getFullYear()} {org.name}. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Powered by <Link href="/" className="text-amber-700 hover:underline font-bold">Bizion ERP</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
