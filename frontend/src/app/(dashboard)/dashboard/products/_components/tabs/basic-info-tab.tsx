'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Wrench, Plus, Check, Truck, ArrowRight, Tag, ShieldCheck } from 'lucide-react';
import type { Category, Brand, Unit, HsnCode, TaxRate } from '@/types';

export interface BasicInfoTabProps {
  name: string;
  setName: (v: string) => void;
  type: 'goods' | 'services';
  setType: (v: 'goods' | 'services') => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
  brandId: string;
  setBrandId: (v: string) => void;
  uomId: string;
  setUomId: (v: string) => void;
  hsnCodeId: string;
  setHsnCodeId: (v: string) => void;
  status: 'active' | 'inactive' | 'draft' | 'archived';
  setStatus: (v: 'active' | 'inactive' | 'draft' | 'archived') => void;
  shortDescription: string;
  setShortDescription: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  hsnCodes: HsnCode[];
  taxRateId: string;
  setTaxRateId: (v: string) => void;
  taxRates: TaxRate[];
  preferredSupplierId?: string;
  setPreferredSupplierId?: (v: string) => void;
  suppliers?: any[];
  openQuickCategoryModal: () => void;
  openQuickBrandModal: () => void;
  openQuickSupplierModal?: () => void;
  setActiveTab: (v: 'basic' | 'pricing' | 'specifications' | 'variants' | 'seo' | 'images') => void;
  formErrors?: Record<string, string>;
}

export function BasicInfoTab({
  name, setName,
  type, setType,
  categoryId, setCategoryId,
  brandId, setBrandId,
  uomId, setUomId,
  hsnCodeId, setHsnCodeId,
  status, setStatus,
  shortDescription, setShortDescription,
  description, setDescription,
  categories, brands, units, hsnCodes, taxRateId, setTaxRateId, taxRates,
  preferredSupplierId, setPreferredSupplierId, suppliers = [],
  openQuickCategoryModal, openQuickBrandModal, openQuickSupplierModal,
  setActiveTab, formErrors = {}
}: BasicInfoTabProps) {
  const selectedHsn = hsnCodes.find((h) => h.id === hsnCodeId);

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-8">
      {/* SECTION 1: General Product Identity */}
      <div className="space-y-4">
        <div className="pb-2 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600" />
              General Identity
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">Basic title, item classification, and publication status</p>
          </div>
          <Badge
            className={`text-xs font-semibold px-2.5 py-0.5 border ${
              status === 'active'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : status === 'draft'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-zinc-100 text-zinc-600 border-zinc-200'
            }`}
          >
            {status.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Name */}
          <div className="md:col-span-7">
            <Input
              label="Product / Service Title"
              placeholder="e.g. Premium Brass Cabinet Handle"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={formErrors.name}
              required
            />
          </div>

          {/* Type Segmented Selection */}
          <div className="md:col-span-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
              Item Classification
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('goods')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-2xs ${
                  type === 'goods'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <Package className="w-4 h-4 text-amber-600" />
                Physical Goods
              </button>
              <button
                type="button"
                onClick={() => setType('services')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-2xs ${
                  type === 'services'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <Wrench className="w-4 h-4 text-amber-600" />
                Service / Labor
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Categorization & GST Tax Configuration */}
      <div className="space-y-4">
        <div className="pb-2 border-b border-zinc-100">
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-600" />
            Categorization & Tax (GST) Settings
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Assign category, brand, measurement unit, and GST rates</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Category */}
          <div className="w-full">
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
                Category
              </label>
              <button
                type="button"
                onClick={openQuickCategoryModal}
                className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> Quick Add
              </button>
            </div>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={[
                { value: '', label: '-- Select Category --' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>

          {/* Brand */}
          <div className="w-full">
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
                Brand
              </label>
              <button
                type="button"
                onClick={openQuickBrandModal}
                className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> Quick Add
              </button>
            </div>
            <Select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              options={[
                { value: '', label: '-- Select Brand --' },
                ...brands.map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
          </div>

          {/* UOM */}
          <div className="w-full">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
              Unit of Measurement (UOM)
            </label>
            <Select
              value={uomId}
              onChange={(e) => setUomId(e.target.value)}
              options={[
                { value: '', label: '-- Select Unit --' },
                ...units.map((u) => ({ value: u.id, label: `${u.name} (${u.code})` })),
              ]}
            />
          </div>

          {/* HSN / SAC Code */}
          <div className="w-full">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
              HSN / SAC Code
            </label>
            <Select
              value={hsnCodeId}
              onChange={(e) => {
                const newHsnId = e.target.value;
                setHsnCodeId(newHsnId);
                const selectedHsn = hsnCodes.find((h) => h.id === newHsnId);
                if (selectedHsn) {
                  const exactMatch = taxRates.find((r) => r.id === selectedHsn.taxRateId);
                  if (exactMatch) {
                    setTaxRateId(exactMatch.id);
                  } else if (selectedHsn.gstRate) {
                    const matchingRate = taxRates.find(
                      (r) => Number(r.ratePercentage) === Number(selectedHsn.gstRate)
                    );
                    if (matchingRate) setTaxRateId(matchingRate.id);
                    else setTaxRateId('');
                  } else {
                    setTaxRateId('');
                  }
                } else {
                  setTaxRateId('');
                }
              }}
              options={[
                { value: '', label: '-- Select HSN / SAC Code --' },
                ...hsnCodes.map((h) => ({
                  value: h.id,
                  label: `${h.code} - ${(h.description || '').substring(0, 36)}...`,
                })),
              ]}
            />
            {selectedHsn && (
              <p className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> GST Rate auto-synced from HSN code ({selectedHsn.code})
              </p>
            )}
          </div>

          {/* Tax Rate (GST) */}
          <div className="w-full">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
              GST Tax Rate
            </label>
            <Select
              value={taxRateId}
              onChange={(e) => setTaxRateId(e.target.value)}
              options={[
                { value: '', label: 'Exempt / Nil Rated (0%)' },
                ...taxRates.map((r) => ({
                  value: r.id,
                  label: `${r.name} (${r.ratePercentage}%)`,
                })),
              ]}
            />
          </div>

          {/* Status */}
          <div className="w-full">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
              Publication Status
            </label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              options={[
                { value: 'active', label: 'Active (Visible on Storefront & Orders)' },
                { value: 'draft', label: 'Draft (In Progress)' },
                { value: 'inactive', label: 'Inactive (Hidden)' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </div>
        </div>
      </div>



      {/* SECTION 4: Supplier Information */}
      <div className="pt-4 border-t border-zinc-200 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-600" />
              Sourcing & Preferred Supplier
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">Link a default vendor for automatic purchase orders and replenishment</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">Preferred Supplier</label>
              {openQuickSupplierModal && (
                <button
                  type="button"
                  onClick={openQuickSupplierModal}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Quick Add
                </button>
              )}
            </div>
            <Select
              value={preferredSupplierId || 'none'}
              onChange={(e) => setPreferredSupplierId?.(e.target.value === 'none' ? '' : e.target.value)}
              options={[
                { value: 'none', label: '-- None (Direct Production) --' },
                ...(suppliers || []).map((s) => ({ value: s.id, label: s.displayName })),
              ]}
            />
          </div>

          {preferredSupplierId && preferredSupplierId !== 'none' && (() => {
            const supplier = suppliers?.find((s) => s.id === preferredSupplierId);
            if (!supplier) return null;
            return (
              <div className="sm:col-span-2 flex flex-col justify-center bg-amber-50/40 border border-amber-200/80 rounded-xl p-3.5">
                <p className="text-sm text-amber-950 font-bold mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  {supplier.displayName}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-600">
                  {supplier.companyName && <div><span className="font-semibold text-zinc-500">Company:</span> {supplier.companyName}</div>}
                  {supplier.email && <div><span className="font-semibold text-zinc-500">Email:</span> {supplier.email}</div>}
                  {supplier.phone && <div><span className="font-semibold text-zinc-500">Phone:</span> {supplier.phone}</div>}
                  {supplier.gstin && <div><span className="font-semibold text-zinc-500">GSTIN:</span> {supplier.gstin}</div>}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-100">
        <Button
          type="button"
          onClick={() => setActiveTab('pricing')}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5"
        >
          Continue to Pricing
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
