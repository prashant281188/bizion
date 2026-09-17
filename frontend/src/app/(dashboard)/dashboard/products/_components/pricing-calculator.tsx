'use client';
import { Button } from '@/components/ui/button';
import { Tag, Percent } from 'lucide-react';


import { useEffect, useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export type PurchaseMode = 'direct' | 'list';

export interface PricingCalculatorProps {
  costPrice: string;
  setCostPrice: (v: string) => void;
  sellingPrice: string;
  setSellingPrice: (v: string) => void;
  basePrice: string;
  setBasePrice: (v: string) => void;
  purchaseMode: 'direct' | 'list';
  setPurchaseMode: (v: 'direct' | 'list') => void;
  discountPct: string;
  setDiscountPct: (val: string) => void;
  marginPct: string;
  setMarginPct: (val: string) => void;
  salesDiscountPct?: string;
  setSalesDiscountPct?: (val: string) => void;
  listPrice: string;
  setListPrice: (v: string) => void;
  mrp?: string;
  setMrp?: (v: string) => void;
  mrpMultiplier?: '1x' | '2x' | '3x' | 'listPrice' | 'custom';
  setMrpMultiplier?: (v: '1x' | '2x' | '3x' | 'listPrice' | 'custom') => void;
  hasVariants: boolean;
  uomCode?: string;
  formErrors?: Record<string, string>;
}

export function PricingCalculator({
  costPrice,
  setCostPrice,
  sellingPrice,
  setSellingPrice,
  basePrice,
  setBasePrice,
  purchaseMode,
  setPurchaseMode,
  discountPct,
  setDiscountPct,
  marginPct,
  setMarginPct,
  salesDiscountPct = '',
  setSalesDiscountPct = () => {},
  listPrice,
  setListPrice,
  mrp = '0',
  setMrp = () => {},
  mrpMultiplier = '2x',
  setMrpMultiplier = () => {},
  hasVariants,
  uomCode = '',
  formErrors = {},
}: PricingCalculatorProps) {
  const [mrpValue, setMrpValue] = useState('');

  // When in list mode, derive cost price from listPrice - discount
  const derivedCostPrice = useMemo(() => {
    if (purchaseMode !== 'list') return null;
    const lp = parseFloat(listPrice);
    const disc = parseFloat(discountPct);
    if (isNaN(lp) || lp < 0) return null;
    const d = isNaN(disc) ? 0 : Math.min(100, Math.max(0, disc));
    return lp * (1 - d / 100);
  }, [purchaseMode, listPrice, discountPct]);

  // Keep costPrice in sync when in list mode
  useEffect(() => {
    if (purchaseMode === 'list' && derivedCostPrice !== null) {
      setCostPrice(derivedCostPrice.toFixed(2));
    }
  }, [derivedCostPrice, purchaseMode, setCostPrice]);

  // Derived effective cost
  const effectiveCost = useMemo(() => {
    if (purchaseMode === 'list' && derivedCostPrice !== null) {
      return derivedCostPrice;
    }
    return parseFloat(costPrice) || 0;
  }, [purchaseMode, derivedCostPrice, costPrice]);

  // Auto-update selling price when effective cost, margin, or sales discount changes
  useEffect(() => {
    if (purchaseMode === 'list' && salesDiscountPct) {
      const sDisc = parseFloat(salesDiscountPct);
      const lp = parseFloat(listPrice);
      if (!isNaN(sDisc) && sDisc >= 0 && !isNaN(lp) && lp > 0) {
        const rawSp = lp * (1 - sDisc / 100);
        const sp = Math.round(rawSp * 2) / 2;
        const spFixed = sp.toFixed(2);
        if (sellingPrice !== spFixed) {
          setSellingPrice(spFixed);
          setBasePrice(spFixed);
        }
        
        if (effectiveCost > 0) {
          const newMargin = (((sp - effectiveCost) / effectiveCost) * 100).toFixed(2);
          if (marginPct !== newMargin) {
            setMarginPct(newMargin);
          }
        }
      }
    } else {
      const margin = parseFloat(marginPct);
      if (!isNaN(margin) && effectiveCost > 0) {
        const rawSp = effectiveCost * (1 + margin / 100);
        const sp = Math.round(rawSp * 2) / 2;
        const spFixed = sp.toFixed(2);
        if (sellingPrice !== spFixed) {
          setSellingPrice(spFixed);
          setBasePrice(spFixed);
        }
      }
    }
  }, [effectiveCost, marginPct, salesDiscountPct, purchaseMode, listPrice]);

  const sellingNum = parseFloat(sellingPrice) || 0;
  const currentMargin = effectiveCost > 0 && sellingNum > effectiveCost
    ? (((sellingNum - effectiveCost) / effectiveCost) * 100).toFixed(2)
    : null;

  // Auto-calculate MRP when Selling Price or Multiplier changes
  useEffect(() => {
    if (mrpMultiplier === 'custom') return;
    if (mrpMultiplier === 'listPrice') {
      const lp = parseFloat(listPrice) || 0;
      setMrp(lp.toFixed(2));
      return;
    }
    const sp = parseFloat(sellingPrice) || 0;
    let mult = 1;
    if (mrpMultiplier === '2x') mult = 2;
    else if (mrpMultiplier === '3x') mult = 3;
    setMrp((sp * mult).toFixed(2));
  }, [sellingPrice, listPrice, mrpMultiplier, setMrp]);

  if (hasVariants) {
    return (
      <div className="p-4 space-y-4">
        {/* Top Bar: Vendor Pricing Method */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
              Vendor Pricing Method
            </label>
            <p className="text-xs text-zinc-500 mt-0.5">
              {purchaseMode === 'direct'
                ? 'Direct cost prices per variant. Selling Prices calculated from Cost + Margin.'
                : 'List/dealer prices per variant with global discount %. Cost & Selling prices calculated automatically.'}
            </p>
          </div>

          <div className="inline-flex p-1 bg-zinc-100/80 border border-zinc-200/80 rounded-xl shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => setPurchaseMode('direct')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                purchaseMode === 'direct'
                  ? 'bg-white text-amber-950 shadow-xs ring-1 ring-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50'
              }`}
            >
              <Tag className={`w-3.5 h-3.5 ${purchaseMode === 'direct' ? 'text-amber-600' : 'text-zinc-400'}`} />
              Direct Cost Price
            </button>
            <button
              type="button"
              onClick={() => setPurchaseMode('list')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                purchaseMode === 'list'
                  ? 'bg-white text-amber-950 shadow-xs ring-1 ring-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50'
              }`}
            >
              <Percent className={`w-3.5 h-3.5 ${purchaseMode === 'list' ? 'text-amber-600' : 'text-zinc-400'}`} />
              List Price + Discount
            </button>
          </div>
        </div>

        {/* 1 Row on Large Screens (lg:grid-cols-4), 2 Rows on Medium/Small (md:grid-cols-2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {purchaseMode === 'list' && (
            <div className="w-full">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                Vendor Discount (%)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  placeholder="0.0"
                  value={discountPct}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') { setDiscountPct(''); return; }
                    const val = parseFloat(raw);
                    if (isNaN(val)) setDiscountPct('');
                    else setDiscountPct(Math.min(100, Math.max(0, val)).toString());
                  }}
                  className="pr-8 font-semibold text-zinc-800"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">%</span>
              </div>
            </div>
          )}

          <div className="w-full">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
              Target Margin (%)
            </label>
            <div className="relative">
              <Input
                type="number"
                step="0.5"
                min="0"
                max="100"
                placeholder="e.g. 35"
                value={marginPct}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') { setMarginPct(''); return; }
                  const val = parseFloat(raw);
                  const clamped = isNaN(val) ? '' : Math.min(100, Math.max(0, val)).toString();
                  setMarginPct(clamped);
                  if (setSalesDiscountPct) setSalesDiscountPct('');
                }}
                className="pr-8 font-semibold text-zinc-800"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">%</span>
            </div>
          </div>

          {purchaseMode === 'list' && (
            <div className="w-full">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                Sales Discount (%)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  placeholder="e.g. 20"
                  value={salesDiscountPct}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') { if (setSalesDiscountPct) setSalesDiscountPct(''); return; }
                    const val = parseFloat(raw);
                    const clamped = isNaN(val) ? '' : Math.min(100, Math.max(0, val)).toString();
                    if (setSalesDiscountPct) setSalesDiscountPct(clamped);
                    setMarginPct('');
                  }}
                  className="pr-8 font-semibold text-zinc-800"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">%</span>
              </div>
            </div>
          )}

          <div className="w-full">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
              MRP Multiplier
            </label>
            <Select
              value={mrpMultiplier}
              onChange={(e) => setMrpMultiplier(e.target.value as any)}
              options={[
                { label: '2x Selling Price (Default)', value: '2x' },
                { label: '1x Selling Price', value: '1x' },
                { label: '3x Selling Price', value: '3x' },
                { label: 'List Price', value: 'listPrice' },
                { label: 'Custom (Per Variant)', value: 'custom' },
              ]}
              className="w-full font-semibold text-zinc-800"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-6">
      {/* Purchase mode toggle */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
          Vendor Pricing Method
        </label>
        <div className="inline-flex p-1 bg-zinc-100/80 border border-zinc-200/80 rounded-xl shrink-0 shadow-2xs">
          <button
            type="button"
            onClick={() => setPurchaseMode('direct')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              purchaseMode === 'direct'
                ? 'bg-white text-amber-950 shadow-xs ring-1 ring-zinc-200'
                : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-amber-600" />
            Direct Purchase Price
          </button>
          <button
            type="button"
            onClick={() => setPurchaseMode('list')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              purchaseMode === 'list'
                ? 'bg-white text-amber-950 shadow-xs ring-1 ring-zinc-200'
                : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50'
            }`}
          >
            <Percent className="w-3.5 h-3.5 text-amber-600" />
            List Price + Discount
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-1.5">
          {purchaseMode === 'direct'
            ? 'Vendor directly gives you the purchase/cost price.'
            : 'Vendor gives a list/dealer price with a discount %. Purchase price is calculated automatically.'}
        </p>
      </div>

      {/* Purchase price inputs */}
      <div className="rounded-xl bg-white border border-zinc-200 p-4 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {purchaseMode === 'direct' ? 'Purchase Price' : 'List Price & Discount'}
        </h4>

        {purchaseMode === 'direct' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Purchase / Cost Price (₹)"
              type="number"
              step="0.5"
              min="0"
              placeholder="0.00"
              value={costPrice}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') { setCostPrice(''); return; }
                const val = parseFloat(raw);
                setCostPrice(isNaN(val) ? '' : Math.max(0, val).toString());
              }}
              error={formErrors.costPrice}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="List / Dealer Price (₹)"
              type="number"
              step="0.5"
              min="0"
              placeholder="0.00"
              value={listPrice}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') { setListPrice(''); return; }
                const val = parseFloat(raw);
                setListPrice(isNaN(val) ? '' : Math.max(0, val).toString());
              }}
            />
            <div className="w-full">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Discount (%)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  placeholder="0.0"
                  value={discountPct}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') { setDiscountPct(''); return; }
                    const val = parseFloat(raw);
                    setDiscountPct(isNaN(val) ? '' : Math.min(100, Math.max(0, val)).toString());
                  }}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
              </div>
            </div>
            <div className="flex flex-col">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Calculated Cost Price
              </label>
              <div className={`flex items-center h-10 px-3 rounded-lg border text-sm font-semibold ${
                derivedCostPrice !== null
                  ? 'border-amber-500/40 bg-amber-500/5 text-amber-700'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-500'
              }`}>
                ₹ {derivedCostPrice !== null ? derivedCostPrice.toFixed(2) : '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sale price section */}
      <div className="rounded-xl bg-white border border-zinc-200 p-4 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Selling Price
          {currentMargin && (
            <span className="ml-2 normal-case text-amber-700 font-medium bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full text-[11px]">
              {currentMargin}% margin
            </span>
          )}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="flex flex-col lg:col-span-1">
            <label className="flex items-end text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5 h-8">
              Target Margin (%)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  placeholder="e.g. 35"
                  value={marginPct}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') { setMarginPct(''); return; }
                    const val = parseFloat(raw);
                    setMarginPct(isNaN(val) ? '' : Math.min(100, Math.max(0, val)).toString());
                  }}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
              </div>
            </div>
            {effectiveCost > 0 && marginPct && (
              <p className="text-xs text-zinc-500 mt-1.5">
                = ₹{(effectiveCost * (1 + parseFloat(marginPct || '0') / 100)).toFixed(2)}
              </p>
            )}
          </div>

          {purchaseMode === 'list' && (
            <div className="flex flex-col lg:col-span-1">
              <label className="flex items-end text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5 h-8">
                Sales Discount (%)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    placeholder="e.g. 20"
                    value={salesDiscountPct}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') { if (setSalesDiscountPct) setSalesDiscountPct(''); return; }
                      const val = parseFloat(raw);
                      const clamped = isNaN(val) ? '' : Math.min(100, Math.max(0, val)).toString();
                      if (setSalesDiscountPct) setSalesDiscountPct(clamped);
                      setMarginPct('');
                    }}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                </div>
              </div>
            </div>
          )}

          <div className="lg:col-span-1 flex flex-col">
            <label className="flex items-end text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5 h-8">
              Selling Price (₹)
            </label>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="0.00"
              value={sellingPrice}
              disabled={!!marginPct || !!salesDiscountPct}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') { setSellingPrice(''); setBasePrice(''); return; }
                const val = parseFloat(raw);
                const clamped = isNaN(val) ? '' : Math.max(0, val).toString();
                setSellingPrice(clamped);
                setBasePrice(clamped);
                
                const spNum = parseFloat(clamped);
                if (!isNaN(spNum) && spNum > 0 && effectiveCost > 0) {
                  const newMargin = (((spNum - effectiveCost) / effectiveCost) * 100).toFixed(2);
                  setMarginPct(newMargin);
                  if (setSalesDiscountPct) setSalesDiscountPct('');
                }
              }}
              onBlur={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) {
                  const rounded = (Math.round(val * 2) / 2).toFixed(2);
                  setSellingPrice(rounded);
                  setBasePrice(rounded);
                }
              }}
              error={formErrors.sellingPrice}
            />
          </div>

          <div className="flex flex-col sm:col-span-2 lg:col-span-2">
            <label className="flex items-end text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5 h-8">
              MRP (₹)
            </label>
            <div className="flex items-start gap-2">
              <div className="w-32 shrink-0">
                <Select
                  value={mrpMultiplier}
                  onChange={(e) => setMrpMultiplier(e.target.value as any)}
                  options={[
                    { label: '2x SP (Default)', value: '2x' },
                    { label: '1x SP', value: '1x' },
                    { label: '3x SP', value: '3x' },
                    { label: 'List Price', value: 'listPrice' },
                    { label: 'Custom', value: 'custom' }
                  ]}
                  className="h-10"
                />
              </div>
              <div className="flex-1 min-w-0">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="0.00"
                  value={mrp}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') { setMrp(''); return; }
                    const val = parseFloat(raw);
                    setMrp(isNaN(val) ? '' : Math.max(0, val).toString());
                  }}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      setMrp((Math.round(val * 2) / 2).toFixed(2));
                    }
                  }}
                  readOnly={mrpMultiplier !== 'custom'}
                  className={mrpMultiplier !== 'custom' ? 'opacity-60 cursor-not-allowed' : ''}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 flex flex-col">
            <label className="flex items-end text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5 h-8">
              Base Price (₹)
            </label>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="0.00"
              value={basePrice}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') { setBasePrice(''); return; }
                const val = parseFloat(raw);
                setBasePrice(isNaN(val) ? '' : Math.max(0, val).toString());
              }}
              error={formErrors.basePrice}
            />
          </div>
        </div>

        {/* Price summary strip */}
        {effectiveCost > 0 && sellingNum > 0 && (
          <div className="flex flex-wrap gap-3 pt-2 mt-2 border-t border-zinc-200/60">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="text-zinc-500">Cost:</span>
              <span className="font-semibold text-zinc-700">₹{effectiveCost.toFixed(2)}</span>
            </div>
            <div className="text-zinc-700">→</div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="text-zinc-500">Selling:</span>
              <span className="font-semibold text-zinc-700">₹{sellingNum.toFixed(2)}</span>
            </div>
            {currentMargin && (
              <>
                <div className="text-zinc-700">→</div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-zinc-500">Profit:</span>
                  <span className="font-semibold text-amber-700">₹{(sellingNum - effectiveCost).toFixed(2)} ({currentMargin}%)</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
