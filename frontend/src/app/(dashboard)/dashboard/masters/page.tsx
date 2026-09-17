'use client';

import { useState } from 'react';
import { CategoriesTab } from './categories-tab';
import { BrandsTab } from './brands-tab';
import { UnitsTab } from './units-tab';
import { TaxRatesTab } from './tax-rates-tab';
import { PaymentTermsTab } from './payment-terms-tab';
import { HsnCodesTab } from './hsn-codes-tab';
import { ContactGroupsTab } from './contact-groups-tab';

type TabId = 'categories' | 'brands' | 'units' | 'tax-rates' | 'payment-terms' | 'hsn-codes' | 'contact-groups';

export default function MastersPage() {
  const [activeTab, setActiveTab] = useState<TabId>('categories');

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-zinc-200 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Master Configurations
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configure business metadata, catalogs, taxes, and trading rules.
          </p>
        </div>
      </div>

      <div className="flex border-b border-zinc-200/80 mb-6 gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {[
          { id: 'categories', label: 'Categories' },
          { id: 'brands', label: 'Brands' },
          { id: 'units', label: 'Units (UOM)' },
          { id: 'tax-rates', label: 'Tax Rates (GST)' },
          { id: 'payment-terms', label: 'Payment Terms' },
          { id: 'contact-groups', label: 'Contact Groups' },
          { id: 'hsn-codes', label: 'HSN/SAC Lookup' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'brands' && <BrandsTab />}
        {activeTab === 'units' && <UnitsTab />}
        {activeTab === 'tax-rates' && <TaxRatesTab />}
        {activeTab === 'payment-terms' && <PaymentTermsTab />}
        {activeTab === 'contact-groups' && <ContactGroupsTab />}
        {activeTab === 'hsn-codes' && <HsnCodesTab />}
      </div>
    </div>
  );
}
