'use client';

import React, { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wand2, RefreshCw, Layers } from 'lucide-react';
import { PricingCalculator, type PurchaseMode } from '../pricing-calculator';
import { toast } from 'sonner';

export interface PricingInventoryTabProps {
  hasVariants: boolean;
  setHasVariants: (v: boolean) => void;
  sku: string;
  setSku: (v: string) => void;
  barcode: string;
  setBarcode: (v: string) => void;
  costPrice: string;
  setCostPrice: (v: string) => void;
  sellingPrice: string;
  setSellingPrice: (v: string) => void;
  basePrice: string;
  setBasePrice: (v: string) => void;
  purchaseMode: PurchaseMode;
  setPurchaseMode: (v: PurchaseMode) => void;
  discountPct: string;
  setDiscountPct: (v: string) => void;
  marginPct: string;
  setMarginPct: (v: string) => void;
  salesDiscountPct?: string;
  setSalesDiscountPct?: (v: string) => void;
  listPrice: string;
  setListPrice: (v: string) => void;
  mrp: string;
  setMrp: (v: string) => void;
  mrpMultiplier: '1x' | '2x' | '3x' | 'listPrice' | 'custom';
  setMrpMultiplier: (v: '1x' | '2x' | '3x' | 'listPrice' | 'custom') => void;
  defaultPacking: string;
  setDefaultPacking: (v: string) => void;
  boxQuantity: string;
  setBoxQuantity: (v: string) => void;
  openingBoxes: string;
  setOpeningBoxes: (v: string) => void;
  openingLoose: string;
  setOpeningLoose: (v: string) => void;
  computedStockQuantity: number;
  trackInventory: boolean;
  setTrackInventory: (v: boolean) => void;
  setActiveTab: (v: 'basic' | 'pricing' | 'specifications' | 'variants' | 'seo' | 'images') => void;
  formErrors?: Record<string, string>;
  uomCode?: string;
  uomName?: string;
}

export function PricingInventoryTab({
  hasVariants, setHasVariants,
  sku, setSku,
  barcode, setBarcode,
  costPrice, setCostPrice,
  sellingPrice, setSellingPrice,
  basePrice, setBasePrice,
  purchaseMode, setPurchaseMode,
  discountPct, setDiscountPct,
  marginPct, setMarginPct,
  listPrice, setListPrice,
  mrp, setMrp,
  mrpMultiplier, setMrpMultiplier,
  defaultPacking, setDefaultPacking,
  boxQuantity, setBoxQuantity,
  openingBoxes, setOpeningBoxes,
  openingLoose, setOpeningLoose,
  computedStockQuantity,
  trackInventory, setTrackInventory,
  setActiveTab, formErrors = {},
  uomCode = '', uomName = ''
}: PricingInventoryTabProps) {
  const toggleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      toggleRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const generateQuickSku = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const newSku = `SKU-${randomNum}`;
    setSku(newSku);
    toast.success('Generated SKU Code: ' + newSku);
  };

  const generateQuickBarcode = () => {
    const randomBarcode = '890' + Math.floor(100000000 + Math.random() * 900000000);
    setBarcode(randomBarcode);
    toast.success('Generated Barcode: ' + randomBarcode);
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6">
      {/* Variants Switcher Card */}
      <label 
        ref={toggleRef as any}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setHasVariants(!hasVariants);
          }
        }}
        className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${
          hasVariants
            ? 'border-amber-300 bg-amber-50/50 shadow-xs'
            : 'border-zinc-200/80 bg-white hover:bg-zinc-50'
        }`}
      >
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            tabIndex={-1}
            className="h-5 w-5 rounded border-zinc-300 text-amber-600 focus:ring-0 cursor-pointer"
            checked={hasVariants}
            onChange={(e) => setHasVariants(e.target.checked)}
          />
          <div className="select-none">
            <div className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              This product has variations (e.g. Size, Color, Finish)
              {hasVariants && <Badge className="bg-amber-600 text-white border-none text-[10px]">ACTIVE</Badge>}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              If enabled, individual SKU pricing and stock inventory are configured per variant item below.
            </p>
          </div>
        </div>

        <Layers className="w-5 h-5 text-zinc-400" />
      </label>

      {!hasVariants && (
        <div className="space-y-6">
          {/* SKU / Barcode / Box Qty */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* SKU */}
            <div className="space-y-1">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">SKU Reference</label>
                <button
                  type="button"
                  onClick={generateQuickSku}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1"
                >
                  <Wand2 className="w-3 h-3" /> Auto
                </button>
              </div>
              <Input
                placeholder="e.g. SKU-104928"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                error={formErrors.sku}
              />
            </div>

            {/* Barcode */}
            <div className="space-y-1">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">Barcode / EAN</label>
                <button
                  type="button"
                  onClick={generateQuickBarcode}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Auto
                </button>
              </div>
              <Input
                placeholder="e.g. 8901234567890"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                error={formErrors.barcode}
              />
            </div>

            {/* Box Qty */}
            <div className="space-y-1">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Box Packing ({uomCode ? `${uomCode}/Box` : 'Pcs/Box'})
                </label>
                <div className="flex items-center gap-1">
                  {['1', '10', '50'].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setBoxQuantity(qty)}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 hover:bg-amber-100 hover:text-amber-900"
                    >
                      {qty}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                type="number"
                placeholder="e.g. 10"
                value={boxQuantity}
                onChange={(e) => setBoxQuantity(e.target.value)}
                error={formErrors.boxQuantity}
              />
            </div>
          </div>

          {/* Vendor / Purchase Pricing */}
          <div className="rounded-xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
            <div className="px-5 py-3 border-b border-zinc-200/80 bg-zinc-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                  Purchase & Selling Price Calculator
                  {uomCode && (
                    <Badge className="bg-amber-100/90 text-amber-900 border border-amber-300/80 font-extrabold text-[10px] px-2 py-0.5">
                      UOM: {uomCode}
                    </Badge>
                  )}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">Configure vendor discount rules, margins, and MRP values</p>
              </div>
            </div>
            <PricingCalculator
              costPrice={costPrice}
              setCostPrice={setCostPrice}
              sellingPrice={sellingPrice}
              setSellingPrice={setSellingPrice}
              basePrice={basePrice}
              setBasePrice={setBasePrice}
              purchaseMode={purchaseMode}
              setPurchaseMode={setPurchaseMode}
              discountPct={discountPct}
              setDiscountPct={setDiscountPct}
              marginPct={marginPct}
              setMarginPct={setMarginPct}
              listPrice={listPrice}
              setListPrice={setListPrice}
              mrp={mrp}
              setMrp={setMrp}
              mrpMultiplier={mrpMultiplier}
              setMrpMultiplier={setMrpMultiplier}
              hasVariants={hasVariants}
              uomCode={uomCode}
              formErrors={formErrors}
            />
          </div>

          {/* Inventory Tracking Section */}
          <div className="flex flex-col space-y-4 py-2 border-t border-zinc-200 pt-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="trackInventoryCheck"
                className="h-4.5 w-4.5 rounded border-zinc-300 text-amber-600 focus:ring-amber-500/50 cursor-pointer"
                checked={trackInventory}
                onChange={(e) => setTrackInventory(e.target.checked)}
              />
              <div className="select-none cursor-pointer" onClick={() => setTrackInventory(!trackInventory)}>
                <label htmlFor="trackInventoryCheck" className="text-sm font-bold text-zinc-800 cursor-pointer">
                  Track inventory stock quantity for this product
                </label>
                <p className="text-[11px] text-zinc-500">Record stock ins, stock outs, adjustments, and opening stock balances</p>
              </div>
            </div>

            {trackInventory && (
              <div className="bg-zinc-50/50 border border-zinc-200/80 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Initial Opening Stock Balance</span>
                  {uomCode && <span className="text-[11px] text-amber-800 font-extrabold lowercase">({uomCode})</span>}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <Input
                    label={`Op. Boxes (x${boxQuantity || 1} ${uomCode || 'pcs'})`}
                    type="number"
                    placeholder="e.g. 5"
                    value={openingBoxes}
                    onChange={(e) => setOpeningBoxes(e.target.value)}
                  />
                  <Input
                    label={`Op. Loose (${uomCode || 'Pieces'})`}
                    type="number"
                    placeholder="e.g. 2"
                    value={openingLoose}
                    onChange={(e) => setOpeningLoose(e.target.value)}
                  />
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-zinc-700 mb-1">Total Net Base {uomCode || 'Pieces'}</label>
                    <div className="h-10 px-3 bg-white border border-zinc-200 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-bold font-mono text-amber-600">
                        {computedStockQuantity} {uomCode || 'pcs'}
                      </span>
                      <Badge className="bg-amber-100 text-amber-900 border-none text-[10px]">Opening Stock</Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-zinc-200">
            <Button type="button" variant="ghost" onClick={() => setActiveTab('basic')}>
              Back
            </Button>
            <Button type="button" onClick={() => setActiveTab('specifications')}>
              Continue to Specifications
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
