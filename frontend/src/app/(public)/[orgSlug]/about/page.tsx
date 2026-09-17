'use client';

import React from 'react';
import { useStorefront } from '../_components/storefront-provider';
import Link from 'next/link';
import { ShieldCheck, Compass, ArrowRight } from 'lucide-react';

export default function StorefrontAboutPage() {
  const { org, orgSlug } = useStorefront();

  if (!org) return null;

  const aboutBadge = org.settings?.storefront?.aboutBadge || 'Hardware & Fittings Authority';
  const aboutTitle = org.settings?.storefront?.aboutTitle || 'Precision engineering meets architectural luxury in every fitting.';
  const aboutDescription = org.settings?.storefront?.aboutDescription || 'Pioneering high-grade architectural hardware, concealed fittings, and bespoke furniture solutions for architects, interior designers, and homeowners.';
  const aboutParagraph1 = org.settings?.storefront?.aboutParagraph1 || `At ${org.name}, we curate and supply top-tier architectural hardware, concealed cabinet hinges, soft-close drawer slide systems, and designer pull handles. Our catalog bridges functional durability with modern interior aesthetics.`;
  const aboutParagraph2 = org.settings?.storefront?.aboutParagraph2 || 'Every item in our inventory is backed by real-time GST tax invoicing, live warehouse stock tracking, and complete specification sheets to streamline your procurement workflow.';

  const exploreBtnText = org.settings?.storefront?.exploreButtonText || 'Explore Catalog';
  const exploreBtnUrl = org.settings?.storefront?.exploreButtonUrl || `/${orgSlug}/products`;
  const requestQuoteBtnUrl = org.settings?.storefront?.requestQuoteButtonUrl || `/${orgSlug}/contact`;

  return (
    <div className="mx-auto max-w-7xl w-full px-6 py-16">
      
      {/* Title Header */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800 mb-3 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
          <Compass className="w-3.5 h-3.5" />
          {aboutBadge}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-stone-900 tracking-tight mb-4">About {org.name}</h1>
        <p className="text-stone-600 text-sm leading-relaxed">
          {aboutDescription}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16 items-center">
        
        {/* Left: Text details */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-stone-900 tracking-tight leading-tight">
            {aboutTitle}
          </h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            {aboutParagraph1}
          </p>
          <p className="text-sm text-stone-600 leading-relaxed">
            {aboutParagraph2}
          </p>
          
          <div className="flex flex-wrap gap-4 mt-4">
            <Link
              href={exploreBtnUrl}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-amber-600 px-6 text-xs font-extrabold text-white hover:bg-amber-700 transition-all shadow-md shadow-amber-600/20 gap-2"
            >
              {exploreBtnText}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={requestQuoteBtnUrl}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-stone-200 bg-white px-6 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors shadow-xs"
            >
              Contact Showroom
            </Link>
          </div>
        </div>

        {/* Right: Corporate Details Card */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-stone-200/80 bg-white p-8 relative overflow-hidden shadow-sm">
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-6 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              Corporate Credentials
            </h3>
            
            <div className="flex flex-col gap-5 text-xs text-stone-600">
              <div>
                <span className="text-stone-400 font-semibold block mb-0.5 uppercase text-[10px]">Legal Entity</span>
                <p className="text-stone-900 font-bold text-sm">{org.legalName || org.name}</p>
              </div>
              
              {org.website && (
                <div>
                  <span className="text-stone-400 font-semibold block mb-0.5 uppercase text-[10px]">Website</span>
                  <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">
                    {org.website}
                  </a>
                </div>
              )}

              {org.email && (
                <div>
                  <span className="text-stone-400 font-semibold block mb-0.5 uppercase text-[10px]">Email</span>
                  <p className="text-stone-800 font-medium">{org.email}</p>
                </div>
              )}

              {org.phone && (
                <div>
                  <span className="text-stone-400 font-semibold block mb-0.5 uppercase text-[10px]">Helpline</span>
                  <p className="text-stone-800 font-medium">{org.phone}</p>
                </div>
              )}
              
              {(org.addressLine1 || org.city) && (
                <div>
                  <span className="text-stone-400 font-semibold block mb-0.5 uppercase text-[10px]">Registered Office</span>
                  <p className="text-stone-800 font-medium leading-relaxed">
                    {org.addressLine1}
                    {org.addressLine2 ? `, ${org.addressLine2}` : ''}
                    {org.city ? `, ${org.city}` : ''}
                    {org.stateName ? `, ${org.stateName}` : ''}
                    {org.pincode ? ` - ${org.pincode}` : ''}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
