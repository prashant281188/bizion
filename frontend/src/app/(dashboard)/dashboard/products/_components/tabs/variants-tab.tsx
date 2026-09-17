'use client';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2, Plus, Sparkles, Wand2, X, Layers, Package } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PricingCalculator, type PurchaseMode } from '../pricing-calculator';

export interface BuilderAttr {
  name: string;
  valuesStr: string;
}

export interface FormVariant {
  id?: string;
  clientKey?: string;
  name: string;
  sku: string;
  barcode?: string;
  categoryId?: string | null;
  attributes: Record<string, string>;
  basePrice: string;
  sellingPrice: string;
  costPrice: string;
  mrp: string;
  listPrice: string;
  purchaseMode?: PurchaseMode | null;
  discountPct?: string;
  marginPct?: string;
  salesDiscountPct?: string;
  overridePricing?: boolean;
  defaultPacking: string;
  boxQuantity: string;
  openingBoxes: string;
  openingLoose: string;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  imageUrl?: string;
}

const DEFAULT_SAVED_ATTR_VALUES: Record<string, string[]> = {
  Size: ['96MM', '160MM', '224MM', '288MM', '320MM', 'S', 'M', 'L', 'XL', 'XXL'],
  Finish: ['SS', 'CP', 'BTT', 'Black', 'AB', 'Rose Gold', 'Matt Black', 'Gold', 'PVD Gold'],
  Color: ['Black', 'White', 'Silver', 'Gold', 'Red', 'Blue', 'Brown', 'Grey'],
  Material: ['Brass', 'Zinc', 'Aluminum', 'Stainless Steel', 'Wood', 'Acrylic'],
};

function getSavedValuesForAttr(name: string): string[] {
  if (!name || !name.trim()) return [];
  const key = name.trim();
  const normalizedKey = Object.keys(DEFAULT_SAVED_ATTR_VALUES).find(k => k.toLowerCase() === key.toLowerCase()) || key;
  const defaults = DEFAULT_SAVED_ATTR_VALUES[normalizedKey] || [];
  try {
    const custom = JSON.parse(localStorage.getItem(`bizion_attr_vals_${normalizedKey.toLowerCase()}`) || '[]');
    return Array.from(new Set([...defaults, ...custom]));
  } catch {
    return defaults;
  }
}

function saveCustomAttrValue(name: string, val: string) {
  if (!name || !name.trim() || !val || !val.trim()) return;
  const key = name.trim().toLowerCase();
  const cleanVal = val.trim();
  try {
    const existing: string[] = JSON.parse(localStorage.getItem(`bizion_attr_vals_${key}`) || '[]');
    if (!existing.some(e => e.toLowerCase() === cleanVal.toLowerCase())) {
      existing.push(cleanVal);
      localStorage.setItem(`bizion_attr_vals_${key}`, JSON.stringify(existing));
    }
  } catch {}
}

function AttrValueTagInput({
  attr,
  idx,
  handleAttributeChange,
}: {
  attr: BuilderAttr;
  idx: number;
  handleAttributeChange: (idx: number, field: keyof BuilderAttr, val: string) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const parts = attr.valuesStr.split(',');
  const currentInputValue = parts[parts.length - 1] || '';
  const currentTags = parts.slice(0, -1).map((s) => s.trim()).filter(Boolean);

  const savedList = getSavedValuesForAttr(attr.name);
  const availableSaved = savedList.filter(
    (sv) => !currentTags.some((ct) => ct.toLowerCase() === sv.toLowerCase())
  );

  const query = currentInputValue.trim().toLowerCase();
  const suggestions = query
    ? availableSaved.filter((sv) => sv.toLowerCase().includes(query))
    : availableSaved.slice(0, 6);

  const topMatch = suggestions.find((s) => s.toLowerCase().startsWith(query)) || (query ? suggestions[0] : null);

  // Reset keyboard selection when input query or suggestion list changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [query, suggestions.length]);

  const addValueTag = (valToAdd: string) => {
    const cleanVal = valToAdd.trim();
    if (!cleanVal) return;
    const existing = parts.slice(0, -1).map((s) => s.trim()).filter(Boolean);
    if (!existing.some((t) => t.toLowerCase() === cleanVal.toLowerCase())) {
      existing.push(cleanVal);
      saveCustomAttrValue(attr.name, cleanVal);
    }
    handleAttributeChange(idx, 'valuesStr', existing.join(',') + ',');
    setSelectedIndex(-1);
  };

  const removeValueTag = (tagIdx: number) => {
    const existing = parts.slice(0, -1).map((s) => s.trim()).filter(Boolean);
    existing.splice(tagIdx, 1);
    handleAttributeChange(
      idx,
      'valuesStr',
      existing.length > 0 ? existing.join(',') + ',' : ''
    );
  };

  return (
    <div className="relative w-full">
      <div className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm transition-colors focus-within:border-amber-500 focus-within:ring-0 focus-within:outline-none outline-none ring-0">
        {currentTags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-800 border border-amber-500/20 group/tag"
          >
            {tag}
            <button
              type="button"
              className="ml-1.5 text-amber-600 hover:text-amber-950 focus:outline-none p-0.5 rounded hover:bg-amber-500/20 transition-colors"
              onClick={() => removeValueTag(i)}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <div className="relative flex-1 min-w-[140px]">
          {query && topMatch && topMatch.toLowerCase().startsWith(query) && (
            <div className="absolute inset-0 flex items-center pointer-events-none text-zinc-400 font-normal text-sm select-none">
              <span className="opacity-0">{currentInputValue}</span>
              <span>{topMatch.slice(currentInputValue.length)}</span>
              <span className="ml-2 text-[9px] bg-zinc-100/80 text-zinc-500 px-1.5 py-0.5 rounded font-mono">
                Tab ↹
              </span>
            </div>
          )}

          <input
            type="text"
            className="w-full bg-transparent p-0 placeholder:text-zinc-400 text-zinc-800 text-sm focus:outline-none focus:ring-0 border-none outline-none ring-0 focus:ring-transparent focus:border-none"
            placeholder={currentTags.length === 0 ? "Type values (e.g. 4 inch, 6 inch, 8 inch)..." : "Add value..."}
            value={currentInputValue}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setTimeout(() => setIsFocused(false), 200);
              if (currentInputValue.trim()) {
                addValueTag(currentInputValue);
              }
            }}
            onChange={(e) => {
              const val = e.target.value;
              if (val.endsWith(',')) {
                addValueTag(val.slice(0, -1));
              } else {
                const nextParts = [...parts];
                nextParts[nextParts.length - 1] = val;
                handleAttributeChange(idx, 'valuesStr', nextParts.join(','));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                if (suggestions.length > 0) {
                  e.preventDefault();
                  setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
                }
              } else if (e.key === 'ArrowUp') {
                if (suggestions.length > 0) {
                  e.preventDefault();
                  setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
                }
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                  addValueTag(suggestions[selectedIndex]);
                } else if (query && topMatch) {
                  addValueTag(topMatch);
                } else if (currentInputValue.trim()) {
                  addValueTag(currentInputValue);
                }
              } else if (e.key === 'Tab') {
                if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                  e.preventDefault();
                  addValueTag(suggestions[selectedIndex]);
                } else if (query && topMatch) {
                  e.preventDefault();
                  addValueTag(topMatch);
                } else if (currentInputValue.trim()) {
                  e.preventDefault();
                  addValueTag(currentInputValue);
                }
              } else if (e.key === 'Backspace' && !currentInputValue) {
                if (currentTags.length > 0) {
                  e.preventDefault();
                  removeValueTag(currentTags.length - 1);
                }
              }
            }}
          />
        </div>
      </div>

      {isFocused && suggestions.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg p-1.5 flex flex-col gap-0.5 max-h-48 overflow-y-auto animate-in fade-in-50 zoom-in-95">
          <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
            <span>Suggestions for {attr.name || 'Attribute'}</span>
            <span className="text-[9px] text-zinc-400">Use ↑ ↓ arrows & Enter to select</span>
          </div>
          {suggestions.map((s, sIdx) => {
            const isHighlighted = selectedIndex === sIdx || (selectedIndex === -1 && sIdx === 0 && Boolean(query));
            return (
              <button
                key={s}
                type="button"
                onMouseEnter={() => setSelectedIndex(sIdx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addValueTag(s);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                  isHighlighted ? 'bg-amber-100/90 text-amber-950 font-semibold border border-amber-300/50' : 'hover:bg-zinc-50 text-zinc-700'
                }`}
              >
                <span>{s}</span>
                <span className="text-[10px] text-amber-700 font-normal">
                  {isHighlighted ? '↵ Enter to select' : '+ Select'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface VariantsTabProps {
  categories: any[];
  hasVariants: boolean;
  setHasVariants?: (v: boolean) => void;
  setActiveTab: (v: 'basic' | 'pricing' | 'specifications' | 'variants' | 'seo' | 'images') => void;
  existingAttributes: string[];
  attributesList: BuilderAttr[];
  setAttributesList?: React.Dispatch<React.SetStateAction<BuilderAttr[]>>;
  handleAttributeChange: (idx: number, field: keyof BuilderAttr, val: string) => void;
  handleRemoveAttribute: (idx: number) => void;
  handleAddAttribute: () => void;
  generateCombinations: () => void;
  variants: FormVariant[];
  setVariants: React.Dispatch<React.SetStateAction<FormVariant[]>>;
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
  formErrors?: Record<string, string>;
  trackInventory: boolean;
  handleRemoveVariantImage: (idx: number) => void;
  uploadingVariantIdx: number | null;
  handleVariantImageUpload: (idx: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  handleVariantChange: (idx: number, field: keyof FormVariant, val: any) => void;
  handleRemoveVariant: (idx: number) => void;
  uomCode?: string;
  uomName?: string;
}

export function VariantsTab({
  categories, hasVariants, setHasVariants, setActiveTab,
  existingAttributes, attributesList, setAttributesList, handleAttributeChange, handleRemoveAttribute, handleAddAttribute, generateCombinations,
  variants, setVariants,
  costPrice, setCostPrice, sellingPrice, setSellingPrice, basePrice, setBasePrice,
  purchaseMode, setPurchaseMode, discountPct, setDiscountPct, marginPct, setMarginPct, salesDiscountPct, setSalesDiscountPct, listPrice, setListPrice,
  mrp, setMrp, mrpMultiplier, setMrpMultiplier,
  formErrors = {}, trackInventory,
  handleRemoveVariantImage, uploadingVariantIdx, handleVariantImageUpload, handleVariantChange, handleRemoveVariant,
  uomCode = '', uomName = ''
}: VariantsTabProps) {

  // Rate Bulk Update State & Handlers
  const [rateFilters, setRateFilters] = useState<Record<string, string[]>>({});
  const [bulkCostPriceInput, setBulkCostPriceInput] = useState<string>('');

  // Packing Bulk Update State & Handlers
  const [packingFilters, setPackingFilters] = useState<Record<string, string[]>>({});
  const [bulkBoxQtyInput, setBulkBoxQtyInput] = useState<string>('');

  const attributeOptionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    variants.forEach(v => {
      if (v.attributes) {
        Object.entries(v.attributes).forEach(([attrKey, attrVal]) => {
          if (!map[attrKey]) map[attrKey] = [];
          if (attrVal && !map[attrKey].includes(attrVal)) {
            map[attrKey].push(attrVal);
          }
        });
      }
    });
    return map;
  }, [variants]);

  // Rate Filter Helpers
  const isRateAllSelected = (attrKey: string) => {
    const selected = rateFilters[attrKey];
    return !selected || selected.length === 0;
  };

  const isRateValSelected = (attrKey: string, val: string) => {
    const selected = rateFilters[attrKey];
    if (!selected || selected.length === 0) return true;
    return selected.includes(val);
  };

  const toggleRateVal = (attrKey: string, val: string) => {
    const selected = rateFilters[attrKey] || [];
    if (isRateAllSelected(attrKey)) {
      // When 'All' is active, selecting a specific chip removes 'All' and selects ONLY this chip!
      setRateFilters(prev => ({ ...prev, [attrKey]: [val] }));
    } else {
      let updated: string[];
      if (selected.includes(val)) {
        updated = selected.filter(v => v !== val);
      } else {
        updated = [...selected, val];
      }
      setRateFilters(prev => ({ ...prev, [attrKey]: updated }));
    }
  };

  const toggleRateAll = (attrKey: string) => {
    setRateFilters(prev => ({ ...prev, [attrKey]: [] })); // Empty array means All Selected
  };

  const handleRateBulkApply = () => {
    if (!bulkCostPriceInput) {
      toast.error(`Please enter a ${purchaseMode === 'list' ? 'List Price' : 'Cost Price / Rate'} to apply.`);
      return;
    }

    let count = 0;
    setVariants(prev => prev.map(v => {
      let match = true;
      if (v.attributes) {
        for (const [attrKey, selectedVals] of Object.entries(rateFilters)) {
          if (selectedVals && selectedVals.length > 0) {
            const varVal = v.attributes[attrKey];
            if (!varVal || !selectedVals.includes(varVal)) {
              match = false;
              break;
            }
          }
        }
      }

      if (match) {
        count++;
        const inputNum = parseFloat(bulkCostPriceInput) || 0;
        const marginNum = parseFloat(marginPct) || 0;
        const discNum = parseFloat(discountPct) || 0;

        let calculatedListPrice = v.listPrice;
        let calculatedCostPrice = v.costPrice;

        if (purchaseMode === 'list') {
          // Input is List Price
          calculatedListPrice = bulkCostPriceInput;
          const derivedCost = discNum > 0 ? inputNum * (1 - discNum / 100) : inputNum;
          calculatedCostPrice = derivedCost.toFixed(2);
        } else {
          // Input is Direct Cost Price
          calculatedCostPrice = bulkCostPriceInput;
          calculatedListPrice = bulkCostPriceInput;
        }

        const costNum = parseFloat(calculatedCostPrice) || 0;

        let calculatedMrp = v.mrp;
        if (costNum > 0) {
          if (mrpMultiplier === '1x') calculatedMrp = (costNum * (1 + marginNum / 100)).toFixed(2);
          else if (mrpMultiplier === '2x') calculatedMrp = (costNum * 2).toFixed(2);
          else if (mrpMultiplier === '3x') calculatedMrp = (costNum * 3).toFixed(2);
          else if (mrpMultiplier === 'listPrice') calculatedMrp = calculatedListPrice;
          else calculatedMrp = (costNum * (1 + marginNum / 100)).toFixed(2);
        }

        const calculatedSelling = (costNum * (1 + marginNum / 100)).toFixed(2);

        return {
          ...v,
          listPrice: calculatedListPrice,
          costPrice: calculatedCostPrice,
          basePrice: calculatedCostPrice,
          mrp: calculatedMrp,
          sellingPrice: calculatedSelling,
        };
      }
      return v;
    }));

    const activeSpecs = Object.entries(rateFilters)
      .filter(([_, selectedVals]) => selectedVals && selectedVals.length > 0)
      .map(([key, vals]) => `${key}: ${vals.join(', ')}`);

    const filterDesc = activeSpecs.length > 0 ? activeSpecs.join(' | ') : 'all variants';
    const modeDesc = purchaseMode === 'list' ? 'List Price & Cost' : 'Cost Rate & MRP';
    toast.success(`Updated ${modeDesc} for ${count} variant(s) (${filterDesc})`);
  };

  // Packing Filter Helpers
  const isPackingAllSelected = (attrKey: string) => {
    const selected = packingFilters[attrKey];
    return !selected || selected.length === 0;
  };

  const isPackingValSelected = (attrKey: string, val: string) => {
    const selected = packingFilters[attrKey];
    if (!selected || selected.length === 0) return true;
    return selected.includes(val);
  };

  const togglePackingVal = (attrKey: string, val: string) => {
    const selected = packingFilters[attrKey] || [];
    if (isPackingAllSelected(attrKey)) {
      // When 'All' is active, selecting a specific chip removes 'All' and selects ONLY this chip!
      setPackingFilters(prev => ({ ...prev, [attrKey]: [val] }));
    } else {
      let updated: string[];
      if (selected.includes(val)) {
        updated = selected.filter(v => v !== val);
      } else {
        updated = [...selected, val];
      }
      setPackingFilters(prev => ({ ...prev, [attrKey]: updated }));
    }
  };

  const togglePackingAll = (attrKey: string) => {
    setPackingFilters(prev => ({ ...prev, [attrKey]: [] })); // Empty array means All Selected
  };

  const handlePackingBulkApply = () => {
    if (!bulkBoxQtyInput) {
      toast.error("Please enter a Box Quantity to apply.");
      return;
    }

    let count = 0;
    setVariants(prev => prev.map(v => {
      let match = true;
      if (v.attributes) {
        for (const [attrKey, selectedVals] of Object.entries(packingFilters)) {
          if (selectedVals && selectedVals.length > 0) {
            const varVal = v.attributes[attrKey];
            if (!varVal || !selectedVals.includes(varVal)) {
              match = false;
              break;
            }
          }
        }
      }

      if (match) {
        count++;
        const boxQty = parseInt(bulkBoxQtyInput, 10) || 1;
        const opBoxes = parseInt(v.openingBoxes || '0', 10);
        const opLoose = parseInt(v.openingLoose || '0', 10);
        const newStock = (opBoxes * boxQty) + opLoose;

        return {
          ...v,
          boxQuantity: bulkBoxQtyInput,
          stockQuantity: newStock,
        };
      }
      return v;
    }));

    const activeSpecs = Object.entries(packingFilters)
      .filter(([_, selectedVals]) => selectedVals && selectedVals.length > 0)
      .map(([key, vals]) => `${key}: ${vals.join(', ')}`);

    const filterDesc = activeSpecs.length > 0 ? activeSpecs.join(' | ') : 'all variants';
    toast.success(`Updated Box Quantity & Stock for ${count} variant(s) (${filterDesc})`);
  };

  const handleTableKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    const target = e.target as HTMLElement;
    if (!['INPUT', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

    if (target.tagName === 'INPUT') {
      const input = target as HTMLInputElement;
      if (input.type !== 'checkbox') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          try {
            if (e.key === 'ArrowLeft' && input.selectionStart !== null && input.selectionStart > 0) return;
            if (e.key === 'ArrowRight' && input.selectionEnd !== null && input.selectionEnd < input.value.length) return;
          } catch (err) {
            return;
          }
        }
      }
    }

    const cell = target.closest('td');
    const row = target.closest('tr');
    if (!cell || !row) return;

    const tbody = row.parentElement;
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    const rowIndex = rows.indexOf(row as HTMLTableRowElement);
    const cells = Array.from(row.querySelectorAll('td'));
    const cellIndex = cells.indexOf(cell as HTMLTableCellElement);

    let nextTarget: HTMLElement | null = null;

    if (e.key === 'ArrowUp' && rowIndex > 0) {
      nextTarget = rows[rowIndex - 1].querySelectorAll('td')[cellIndex]?.querySelector('input:not([disabled]), select:not([disabled]), button:not([disabled])');
    } else if (e.key === 'ArrowDown' && rowIndex < rows.length - 1) {
      nextTarget = rows[rowIndex + 1].querySelectorAll('td')[cellIndex]?.querySelector('input:not([disabled]), select:not([disabled]), button:not([disabled])');
    } else if (e.key === 'ArrowLeft' && cellIndex > 0) {
      for (let i = cellIndex - 1; i >= 0; i--) {
        nextTarget = rows[rowIndex].querySelectorAll('td')[i]?.querySelector('input:not([disabled]), select:not([disabled]), button:not([disabled])');
        if (nextTarget) break;
      }
    } else if (e.key === 'ArrowRight' && cellIndex < cells.length - 1) {
      for (let i = cellIndex + 1; i < cells.length; i++) {
        nextTarget = rows[rowIndex].querySelectorAll('td')[i]?.querySelector('input:not([disabled]), select:not([disabled]), button:not([disabled])');
        if (nextTarget) break;
      }
    }

    if (nextTarget) {
      e.preventDefault();
      nextTarget.focus();
      if (nextTarget.tagName === 'INPUT') {
        const nextInput = nextTarget as HTMLInputElement;
        if (nextInput.type !== 'checkbox') {
          try {
            nextInput.select();
          } catch (err) {}
        }
      }
    }
  };

  useEffect(() => {
    if (variants.length === 0) return;
    
    let hasChanges = false;
    const nextVariants = variants.map(v => {
      let newCost = parseFloat(v.costPrice) || 0;
      let newSell = parseFloat(v.sellingPrice) || 0;
      let newMrp = parseFloat(v.mrp) || 0;
      
      const discStr = v.overridePricing ? (v.discountPct || discountPct) : discountPct;
      const margStr = v.overridePricing ? (v.marginPct || marginPct) : marginPct;
      const disc = parseFloat(discStr) || 0;
      let marg = parseFloat(margStr) || 0;
      const sDisc = parseFloat(salesDiscountPct || '') || 0;
      
      if (purchaseMode === 'list') {
        const lpNum = parseFloat(v.listPrice) || 0;
        newCost = lpNum * (1 - disc / 100);
        
        if (salesDiscountPct && !v.overridePricing) {
          const rawSell = lpNum * (1 - sDisc / 100);
          newSell = Math.round(rawSell * 2) / 2;
        } else {
          const rawSell = newCost * (1 + marg / 100);
          newSell = Math.round(rawSell * 2) / 2;
        }
        
        if (mrpMultiplier === '1x') newMrp = newSell * 1;
        else if (mrpMultiplier === '2x') newMrp = newSell * 2;
        else if (mrpMultiplier === '3x') newMrp = newSell * 3;
        else if (mrpMultiplier === 'listPrice') newMrp = lpNum;
      } else {
        const rawSell = newCost * (1 + marg / 100);
        newSell = Math.round(rawSell * 2) / 2;
        
        if (mrpMultiplier === '1x') newMrp = newSell * 1;
        else if (mrpMultiplier === '2x') newMrp = newSell * 2;
        else if (mrpMultiplier === '3x') newMrp = newSell * 3;
      }
      
      let newMarginStr = v.overridePricing ? (v.marginPct || '') : (salesDiscountPct ? '' : marginPct);
      if (salesDiscountPct && purchaseMode === 'list' && newCost > 0 && !v.overridePricing) {
        newMarginStr = (((newSell - newCost) / newCost) * 100).toFixed(2);
      }
      
      const newDiscStr = v.overridePricing ? (v.discountPct || '') : discountPct;
      
      const newCostStr = purchaseMode === 'list' ? newCost.toFixed(2) : v.costPrice;
      const hasCalculatedSell = !!marginPct || !!salesDiscountPct || !!v.marginPct || !!v.salesDiscountPct;
      const newSellStr = hasCalculatedSell ? newSell.toFixed(2) : v.sellingPrice;
      const newMrpStr = mrpMultiplier !== 'custom' ? newMrp.toFixed(2) : v.mrp;
      
      if (
        v.costPrice !== newCostStr || 
        v.sellingPrice !== newSellStr || 
        (mrpMultiplier !== 'custom' && v.mrp !== newMrpStr) || 
        v.marginPct !== newMarginStr ||
        v.discountPct !== newDiscStr
      ) {
        hasChanges = true;
        return {
          ...v,
          costPrice: newCostStr,
          sellingPrice: newSellStr,
          basePrice: newSellStr,
          marginPct: newMarginStr,
          discountPct: newDiscStr,
          ...(mrpMultiplier !== 'custom' ? { mrp: newMrpStr } : {})
        };
      }
      return v;
    });

    if (hasChanges) {
      setVariants(nextVariants);
    }
  }, [variants, purchaseMode, discountPct, marginPct, salesDiscountPct, mrpMultiplier, setVariants]);

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6 overflow-hidden">
      {!hasVariants ? (
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <Wand2 className="w-6 h-6 text-amber-600" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-900">Product Variants Are Disabled</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Enable variants to create multiple SKUs with different attributes (e.g. Size, Color, Finish) and individual pricing.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setHasVariants?.(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm"
          >
            Enable Product Variants Now
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Attribute Template Form */}
          <div className="space-y-5 bg-white p-5 border border-zinc-200/80 rounded-2xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-700 rounded-xl shrink-0 mt-0.5">
                  <Wand2 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    Dynamic Variants Matrix Generator
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Define attribute parameters (e.g. Size, Color) with comma-separated values to automatically construct SKU combinations.
                  </p>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mr-1">Quick Presets:</span>
                {[
                  { name: 'Size', values: '4 inch, 6 inch, 8 inch, 10 inch' },
                  { name: 'Finish', values: 'SS, CP, BTT, Black' },
                  { name: 'Color', values: 'Red, Blue, Black, White' }
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      const exists = attributesList.some(a => a.name.trim().toLowerCase() === preset.name.toLowerCase());
                      if (exists) {
                        toast.warning(`Attribute "${preset.name}" is already present.`);
                        return;
                      }
                      // Check if first attribute is empty
                      if (attributesList.length === 1 && !attributesList[0].name.trim() && !attributesList[0].valuesStr.trim()) {
                        handleAttributeChange(0, 'name', preset.name);
                        handleAttributeChange(0, 'valuesStr', preset.values + ',');
                      } else if (setAttributesList) {
                        setAttributesList(prev => [...prev, { name: preset.name, valuesStr: preset.values + ',' }]);
                      } else {
                        const newIdx = attributesList.length;
                        handleAddAttribute();
                        setTimeout(() => {
                          handleAttributeChange(newIdx, 'name', preset.name);
                          handleAttributeChange(newIdx, 'valuesStr', preset.values + ',');
                        }, 0);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium bg-zinc-100 hover:bg-amber-50 text-zinc-600 hover:text-amber-700 border border-zinc-200 hover:border-amber-300 px-2.5 py-1 rounded-lg transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3.5">
              {attributesList.map((attr, idx) => (
                <div key={idx} className="group relative flex flex-col md:flex-row gap-3 items-start p-3.5 bg-zinc-50/70 hover:bg-zinc-50 border border-zinc-200/70 rounded-xl transition-all">
                  <div className="w-full md:w-1/3">
                    <Input
                      id={`attr-name-${idx}`}
                      label="Attribute Name"
                      placeholder="e.g. Size, Color, Material"
                      value={attr.name}
                      onChange={(e) => handleAttributeChange(idx, 'name', e.target.value)}
                    />
                    {(() => {
                      const cleanedAttrs = Array.from(
                        new Map(
                          (existingAttributes || []).map(a => [a.trim().toLowerCase(), a.trim().replace(/\b\w/g, c => c.toUpperCase())])
                        ).values()
                      );
                      const activeLower = attributesList.map(a => a.name.trim().toLowerCase());
                      const suggestions = cleanedAttrs.filter(ea => !activeLower.includes(ea.toLowerCase()));
                      if (suggestions.length === 0 || attr.name.trim()) return null;
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Saved:</span>
                          {suggestions.slice(0, 5).map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => handleAttributeChange(idx, 'name', s)}
                              className="inline-flex items-center text-[11px] font-medium bg-zinc-100/80 hover:bg-amber-100 text-zinc-700 hover:text-amber-900 border border-zinc-200/80 hover:border-amber-300 px-2 py-0.5 rounded-md transition-all cursor-pointer"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                      Variation Values (Type comma or press Tab)
                    </label>
                    <AttrValueTagInput
                      attr={attr}
                      idx={idx}
                      handleAttributeChange={handleAttributeChange}
                    />
                  </div>
                  <div className="pt-0 md:pt-7 align-self-center self-end md:self-auto">
                    <Button
                      variant="ghost"
                      type="button"
                      size="icon"
                      className="h-10 w-10 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      onClick={() => handleRemoveAttribute(idx)}
                      disabled={attributesList.length === 1}
                      title="Remove Parameter"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100 min-w-0">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleAddAttribute}
                className="w-full sm:w-auto gap-2 border-zinc-200 hover:bg-zinc-50 text-zinc-700 justify-center shrink-0"
              >
                <Plus className="w-4 h-4 text-zinc-500" />
                Add Attribute Parameter
              </Button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto min-w-0">
                {(() => {
                  const validAttrs = attributesList.filter(a => a.name.trim() !== '');
                  const totalCombinations = validAttrs.length > 0 
                    ? validAttrs.reduce((acc, a) => {
                        const count = a.valuesStr.split(',').map(v => v.trim()).filter(Boolean).length;
                        return count > 0 ? acc * count : acc;
                      }, 1) 
                    : 0;

                  return (
                    <>
                      {totalCombinations > 0 && (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full flex items-center justify-center gap-1.5 shrink-0 self-center sm:self-auto">
                          <Layers className="w-3.5 h-3.5" />
                          {totalCombinations} SKU {totalCombinations === 1 ? 'combination' : 'combinations'}
                        </span>
                      )}
                      <Button 
                        type="button" 
                        size="sm" 
                        onClick={generateCombinations}
                        className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-medium gap-2 shadow-sm shadow-amber-600/20 transition-all justify-center text-xs py-2 shrink-0 min-w-0 max-w-full"
                      >
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span className="truncate">Generate Combinations Matrix</span>
                      </Button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {variants.length > 0 && (
            <div className="space-y-6">
              {/* Global Pricing Calculator Settings */}
              <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-350">
                  Configure Variation Pricing Settings
                </h4>
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
                  salesDiscountPct={salesDiscountPct}
                  setSalesDiscountPct={setSalesDiscountPct}
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

              {/* Matrix Table */}
              <div className="space-y-4">
                <div className="space-y-3 border-b border-zinc-200 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-700">Compiled Matrix Table ({variants.length} rows)</h3>
                      <p className="text-xs text-zinc-500">Specify SKU codes, list/cost values, and stock limits for each variation.</p>
                    </div>
                  </div>

                  {/* TWO DEDICATED BULK ATTRIBUTE UPDATE BARS */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* 1. RATE BULK UPDATE */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-amber-700" />
                          Rate Bulk Update ({purchaseMode === 'list' ? 'List Price' : 'Cost Rate'})
                          {uomCode && (
                            <span className="text-[10px] bg-amber-200/80 text-amber-900 border border-amber-300 font-extrabold px-1.5 py-0.2 rounded">
                              {uomCode}
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => setRateFilters({})}
                          className="text-[11px] text-amber-800 font-semibold underline"
                        >
                          Reset Filters
                        </button>
                      </div>

                      {/* Multi-Select Rate Filters */}
                      <div className="space-y-1.5 pt-0.5">
                        {Object.keys(attributeOptionsMap).length === 0 ? (
                          <span className="text-xs text-zinc-400 italic">No attributes defined</span>
                        ) : (
                          Object.entries(attributeOptionsMap).map(([attrKey, values]) => (
                            <div key={attrKey} className="flex flex-wrap items-center gap-1">
                              <span className="text-xs font-medium text-zinc-600 min-w-[50px]">{attrKey}:</span>
                              <button
                                type="button"
                                onClick={() => toggleRateAll(attrKey)}
                                className={`px-2 py-0.5 text-[11px] rounded-full border transition-all ${
                                  isRateAllSelected(attrKey)
                                    ? 'bg-amber-700 text-white font-medium border-amber-700'
                                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                                }`}
                              >
                                All {attrKey}s
                              </button>
                              {values.map(val => {
                                const selected = isRateValSelected(attrKey, val) && !isRateAllSelected(attrKey);
                                return (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => toggleRateVal(attrKey, val)}
                                    className={`px-2 py-0.5 text-[11px] rounded-full border transition-all ${
                                      selected
                                        ? 'bg-amber-600 text-white font-medium border-amber-600 shadow-xs'
                                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                                    }`}
                                  >
                                    {val} {selected && '✓'}
                                  </button>
                                );
                              })}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Rate Input & Apply Button */}
                      <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
                        <span className="text-xs text-zinc-600 font-medium">
                          {purchaseMode === 'list' ? 'List Price' : 'Cost Rate'} ({uomCode ? `₹ / ${uomCode}` : '₹'}):
                        </span>
                        <Input 
                          type="number" 
                          placeholder={purchaseMode === 'list' ? 'e.g. 500' : 'e.g. 250'} 
                          value={bulkCostPriceInput}
                          onChange={(e) => setBulkCostPriceInput(e.target.value)}
                          className="w-28 h-7 text-xs bg-white" 
                        />
                        <Button 
                          size="sm" 
                          className="h-7 text-xs bg-amber-700 hover:bg-amber-800 text-white font-semibold px-3 ml-auto"
                          onClick={handleRateBulkApply}
                        >
                          Apply {purchaseMode === 'list' ? 'List Price' : 'Rate'}
                        </Button>
                      </div>
                    </div>

                    {/* 2. PACKING (BOX QTY) BULK UPDATE */}
                    <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-blue-700" />
                          Packing Bulk Update
                          {uomCode && (
                            <span className="text-[10px] bg-blue-200/80 text-blue-900 border border-blue-300 font-extrabold px-1.5 py-0.2 rounded">
                              {uomCode}/Box
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => setPackingFilters({})}
                          className="text-[11px] text-blue-800 font-semibold underline"
                        >
                          Reset Filters
                        </button>
                      </div>

                      {/* Multi-Select Packing Filters */}
                      <div className="space-y-1.5 pt-0.5">
                        {Object.keys(attributeOptionsMap).length === 0 ? (
                          <span className="text-xs text-zinc-400 italic">No attributes defined</span>
                        ) : (
                          Object.entries(attributeOptionsMap).map(([attrKey, values]) => (
                            <div key={attrKey} className="flex flex-wrap items-center gap-1">
                              <span className="text-xs font-medium text-zinc-600 min-w-[50px]">{attrKey}:</span>
                              <button
                                type="button"
                                onClick={() => togglePackingAll(attrKey)}
                                className={`px-2 py-0.5 text-[11px] rounded-full border transition-all ${
                                  isPackingAllSelected(attrKey)
                                    ? 'bg-blue-700 text-white font-medium border-blue-700'
                                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                                }`}
                              >
                                All {attrKey}s
                              </button>
                              {values.map(val => {
                                const selected = isPackingValSelected(attrKey, val) && !isPackingAllSelected(attrKey);
                                return (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => togglePackingVal(attrKey, val)}
                                    className={`px-2 py-0.5 text-[11px] rounded-full border transition-all ${
                                      selected
                                        ? 'bg-blue-600 text-white font-medium border-blue-600 shadow-xs'
                                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                                    }`}
                                  >
                                    {val} {selected && '✓'}
                                  </button>
                                );
                              })}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Packing Input & Apply Button */}
                      <div className="flex items-center gap-2 pt-1 border-t border-blue-200/60">
                        <span className="text-xs text-zinc-600 font-medium">
                          Box Qty ({uomCode ? `${uomCode}/Box` : 'Pcs/Box'}):
                        </span>
                        <Input 
                          type="number" 
                          placeholder="e.g. 10" 
                          value={bulkBoxQtyInput}
                          onChange={(e) => setBulkBoxQtyInput(e.target.value)}
                          className="w-28 h-7 text-xs bg-white" 
                        />
                        <Button 
                          size="sm" 
                          className="h-7 text-xs bg-blue-700 hover:bg-blue-800 text-white font-semibold px-3 ml-auto"
                          onClick={handlePackingBulkApply}
                        >
                          Apply Packing
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                  <Table className="min-w-full text-left text-sm text-zinc-600">
                    <TableHeader>
                      <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                        <TableHead className="px-4 py-3 w-[80px] min-w-[80px]">Image</TableHead>
                        <TableHead className="px-4 py-3 min-w-[160px] max-w-[250px]">Variant details</TableHead>
                        <TableHead className="px-4 py-3 min-w-[160px]">Category Override</TableHead>
                        <TableHead className="px-4 py-3 min-w-[140px]">SKU</TableHead>
                        {purchaseMode === 'list' && (
                          <TableHead className="px-4 py-3 min-w-[110px]">List (₹ {uomCode ? `/ ${uomCode}` : ''})</TableHead>
                        )}
                        <TableHead className="px-4 py-3 min-w-[110px]">Cost (₹ {uomCode ? `/ ${uomCode}` : ''})</TableHead>
                        <TableHead className="px-4 py-3 min-w-[110px]">Selling (₹ {uomCode ? `/ ${uomCode}` : ''})</TableHead>
                        <TableHead className="px-4 py-3 min-w-[90px] text-center">Margin (%)</TableHead>
                        <TableHead className="px-4 py-3 min-w-[110px]">MRP (₹ {uomCode ? `/ ${uomCode}` : ''})</TableHead>
                        <TableHead className="px-4 py-3 min-w-[100px]">Box Qty ({uomCode ? `${uomCode}/Box` : 'Pcs/Box'})</TableHead>
                        {trackInventory && <TableHead className="px-4 py-3 min-w-[100px]">Op. Boxes</TableHead>}
                        {trackInventory && <TableHead className="px-4 py-3 min-w-[100px]">Op. Loose ({uomCode || 'Pcs'})</TableHead>}
                        {trackInventory && <TableHead className="px-4 py-3 min-w-[100px]">Total ({uomCode || 'Pcs'})</TableHead>}
                        <TableHead className="px-4 py-3 min-w-[80px] text-center">Active</TableHead>
                        <TableHead className="px-4 py-3 min-w-[70px] text-center">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-zinc-100" onKeyDown={handleTableKeyDown}>
                      {variants.map((v, idx) => (
                        <TableRow key={idx} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                          <TableCell className="px-4 py-3 min-w-[80px]">
                            <div className="flex items-center space-x-2">
                              {v.imageUrl ? (
                                <div className="relative group/varimg h-9 w-9 rounded border border-zinc-200 bg-zinc-50 overflow-hidden shrink-0">
                                  <img src={v.imageUrl} alt={v.name} className="h-full w-full object-cover" />
                                  <Button variant="ghost"
                                    type="button"
                                    onClick={() => handleRemoveVariantImage(idx)}
                                    className="absolute inset-0 bg-black/60 opacity-0 group-hover/varimg:opacity-100 flex items-center justify-center text-[10px] text-red-700 font-bold transition-all"
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ) : (
                                <div className="relative h-9 w-9 rounded border border-dashed border-zinc-200 bg-zinc-50 hover:border-amber-500/50 flex items-center justify-center shrink-0 transition-all cursor-pointer">
                                  {uploadingVariantIdx === idx ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={(e) => handleVariantImageUpload(idx, e)}
                                        disabled={uploadingVariantIdx !== null}
                                      />
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[160px] max-w-[250px] truncate">
                            <div className="font-semibold text-zinc-900 truncate" title={v.name}>{v.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                              {Object.entries(v.attributes).map(([key, value]) => `${key}: ${value}`).join(' • ')}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[160px]">
                            <select
                              value={v.categoryId || ''}
                              onChange={(e) => handleVariantChange(idx, 'categoryId', e.target.value || null)}
                              className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 outline-none focus:border-amber-500 min-w-[140px]"
                            >
                              <option value="">Inherit Parent</option>
                              {categories.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[140px]">
                            <Input
                              type="text"
                              value={v.sku}
                              disabled={false}
                              onChange={(e) => handleVariantChange(idx, 'sku', e.target.value)}
                              className="min-w-[120px] bg-zinc-50"
                            />
                          </TableCell>
                           {purchaseMode === 'list' && (
                            <TableCell className="px-4 py-3 min-w-[110px]">
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                className="font-mono min-w-[90px]"
                                value={v.listPrice}
                                onChange={(e) => {
                                  const lp = e.target.value;
                                  if (lp === '') {
                                    setVariants(prev => prev.map((item, i) => i === idx ? { ...item, listPrice: '' } : item));
                                    return;
                                  }
                                  const val = parseFloat(lp);
                                  const clamped = isNaN(val) ? '' : Math.max(0, val).toString();
                                  setVariants(prev => prev.map((item, i) => i === idx ? { ...item, listPrice: clamped } : item));
                                }}
                              />
                            </TableCell>
                          )}
                          <TableCell className="px-4 py-3 min-w-[110px]">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              className="font-mono min-w-[90px]"
                              value={v.costPrice}
                              disabled={purchaseMode === 'list'}
                              onChange={(e) => {
                                const cost = e.target.value;
                                if (cost === '') {
                                  setVariants(prev => prev.map((item, i) => i === idx ? { ...item, costPrice: '' } : item));
                                  return;
                                }
                                const val = parseFloat(cost);
                                const clamped = isNaN(val) ? '' : Math.max(0, val).toString();
                                setVariants(prev => prev.map((item, i) => i === idx ? { ...item, costPrice: clamped } : item));
                              }}
                            />
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[110px]">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              className="font-mono min-w-[90px]"
                              value={v.sellingPrice}
                              disabled={!!marginPct || !!salesDiscountPct || !!v.marginPct || !!v.salesDiscountPct}
                              onChange={(e) => {
                                const sp = e.target.value;
                                if (sp === '') {
                                  setVariants(prev => prev.map((item, i) => i === idx ? { ...item, sellingPrice: '', basePrice: '' } : item));
                                  return;
                                }
                                const val = parseFloat(sp);
                                const clampedSp = isNaN(val) ? '' : Math.max(0, val).toString();
                                const spNum = parseFloat(clampedSp) || 0;
                                const costNum = parseFloat(v.costPrice) || 0;
                                let newMargin = 0;
                                if (costNum > 0 && spNum > 0) {
                                  newMargin = ((spNum - costNum) / costNum) * 100;
                                }
                                setVariants(prev => prev.map((item, i) => {
                                  if (i !== idx) return item;
                                  let newMrp = parseFloat(item.mrp) || 0;
                                  if (mrpMultiplier === '1x') newMrp = spNum * 1;
                                  else if (mrpMultiplier === '2x') newMrp = spNum * 2;
                                  else if (mrpMultiplier === '3x') newMrp = spNum * 3;
                                  else if (mrpMultiplier === 'listPrice') newMrp = parseFloat(item.listPrice) || 0;
                                  return {
                                    ...item,
                                    overridePricing: true,
                                    sellingPrice: clampedSp,
                                    basePrice: clampedSp,
                                    marginPct: newMargin.toFixed(2),
                                    mrp: newMrp.toString()
                                  };
                                }));
                              }}
                            />
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[90px] text-center">
                            <span className="inline-block bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2 py-1 rounded-md text-[11px] font-medium font-mono min-w-[60px]">
                              {parseFloat(v.costPrice) > 0 && parseFloat(v.sellingPrice) > 0
                                ? (((parseFloat(v.sellingPrice) - parseFloat(v.costPrice)) / parseFloat(v.costPrice)) * 100).toFixed(2) + '%'
                                : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[110px]">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              className={`font-mono min-w-[90px] ${mrpMultiplier !== 'custom' ? 'bg-zinc-50' : ''}`}
                              value={v.mrp}
                              disabled={mrpMultiplier !== 'custom'}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === '') { handleVariantChange(idx, 'mrp', ''); return; }
                                const val = parseFloat(raw);
                                const clamped = isNaN(val) ? '' : Math.max(0, val).toString();
                                handleVariantChange(idx, 'mrp', clamped);
                              }}
                            />
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[100px]">
                            <Input
                              type="number"
                              min="1"
                              className="font-mono min-w-[80px]"
                              value={v.boxQuantity}
                              onChange={(e) => handleVariantChange(idx, 'boxQuantity', e.target.value)}
                            />
                          </TableCell>
                          {trackInventory && (
                            <>
                              <TableCell className="px-4 py-3 min-w-[100px]">
                                <Input
                                  type="number"
                                  min="0"
                                  className="font-mono min-w-[80px]"
                                  value={v.openingBoxes}
                                  onChange={(e) => handleVariantChange(idx, 'openingBoxes', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="px-4 py-3 min-w-[100px]">
                                <Input
                                  type="number"
                                  min="0"
                                  className="font-mono min-w-[80px]"
                                  value={v.openingLoose}
                                  onChange={(e) => handleVariantChange(idx, 'openingLoose', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="px-4 py-3 min-w-[100px]">
                                <div className="font-mono text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 w-full text-center">
                                  {((parseInt(v.openingBoxes, 10) || 0) * (parseInt(v.boxQuantity, 10) || 1)) + (parseInt(v.openingLoose, 10) || 0)}
                                </div>
                              </TableCell>
                            </>
                          )}
                          <TableCell className="px-4 py-3 min-w-[80px] text-center">
                            <input
                              type="checkbox"
                              checked={v.isActive}
                              onChange={(e) => handleVariantChange(idx, 'isActive', e.target.checked)}
                              className="w-4 h-4 text-amber-600 rounded border-zinc-300 focus:ring-amber-500"
                            />
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[70px] text-center">
                            <Button variant="ghost"
                              type="button"
                              onClick={() => {
                                const newVars = [...variants];
                                newVars.splice(idx, 1);
                                setVariants(newVars);
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0 shrink-0"
                            >
                              ✕
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="flex justify-between pt-4 border-t border-zinc-200">
        <Button type="button" variant="ghost" onClick={() => setActiveTab('basic')}>Back</Button>
        <Button type="button" onClick={() => setActiveTab('specifications')}>Continue to Specifications</Button>
      </div>
    </Card>
  );
}
