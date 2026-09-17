"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Tag, Percent, Sparkles, Flame, Check } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

interface SchemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheme?: any;
}

const PROMO_TYPES = [
  { value: 'special_offer', label: 'Special Offer', icon: Sparkles, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'clearance_sale', label: 'Clearance Sale', icon: Flame, color: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'seasonal_sale', label: 'Seasonal Sale', icon: Tag, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'flash_sale', label: 'Flash Sale / Limited Time', icon: Flame, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { value: 'bulk_deal', label: 'Bulk Volume Deal', icon: Tag, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { value: 'custom', label: 'Custom Campaign', icon: Tag, color: 'text-purple-600 bg-purple-50 border-purple-200' },
];

export function SchemeModal({ isOpen, onClose, scheme }: SchemeModalProps) {
  const [name, setName] = useState("");
  const [promoType, setPromoType] = useState("special_offer");
  const [badgeText, setBadgeText] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [minQuantity, setMinQuantity] = useState("1");
  const [priority, setPriority] = useState("1");
  const [appliesTo, setAppliesTo] = useState("all_products");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  
  // Selected IDs for targets
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);

  const queryClient = useQueryClient();

  // Fetch Master Data
  const { data: brands = [] } = useQuery({
    queryKey: ['masters-brands'],
    queryFn: async () => {
      const res = await api.get('/masters/brands?limit=500');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['masters-categories'],
    queryFn: async () => {
      const res = await api.get('/masters/categories?limit=500');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  const { data: productsData = [] } = useQuery({
    queryKey: ['products-for-promos'],
    queryFn: async () => {
      const res = await api.get('/products?limit=500');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (scheme) {
      setName(scheme.name || "");
      setPromoType(scheme.promoType || "special_offer");
      setBadgeText(scheme.badgeText || "");
      setDescription(scheme.description || "");
      setDiscountType(scheme.discountType || "percentage");
      setDiscountValue(scheme.discountValue || "");
      setMinQuantity(String(scheme.minQuantity || "1"));
      setPriority(String(scheme.priority || "1"));
      setAppliesTo(scheme.appliesTo || "all_products");
      setValidFrom(scheme.validFrom ? scheme.validFrom.split('T')[0] : "");
      setValidTo(scheme.validTo ? scheme.validTo.split('T')[0] : "");

      const items = scheme.items || [];
      setSelectedBrandIds(items.filter((i: any) => i.brandId).map((i: any) => i.brandId));
      setSelectedCategoryIds(items.filter((i: any) => i.categoryId).map((i: any) => i.categoryId));
      setSelectedProductIds(items.filter((i: any) => i.productId && !i.variantId).map((i: any) => i.productId));
      setSelectedVariantIds(items.filter((i: any) => i.variantId).map((i: any) => i.variantId));
    } else {
      setName("");
      setPromoType("special_offer");
      setBadgeText("");
      setDescription("");
      setDiscountType("percentage");
      setDiscountValue("");
      setMinQuantity("1");
      setPriority("1");
      setAppliesTo("all_products");
      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setValidFrom(today);
      setValidTo(nextMonth);
      setSelectedBrandIds([]);
      setSelectedCategoryIds([]);
      setSelectedProductIds([]);
      setSelectedVariantIds([]);
    }
  }, [scheme, isOpen]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (scheme?.id) {
        const res = await api.put(`/pricing/schemes/${scheme.id}`, payload);
        return res.data;
      }
      const res = await api.post('/pricing/schemes', payload);
      return res.data;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to save promotional scheme");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["promotional-schemes"] });
      queryClient.invalidateQueries({ queryKey: ["public-storefront-promotions"] });
    },
    onSuccess: () => {
      toast.success(`Promotional Scheme ${scheme ? "updated" : "created"} successfully`);
      onClose();
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !validFrom || !validTo || !discountValue) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Build items payload based on appliesTo
    const items: any[] = [];
    if (appliesTo === 'specific_brands') {
      selectedBrandIds.forEach(brandId => items.push({ brandId }));
    } else if (appliesTo === 'specific_categories') {
      selectedCategoryIds.forEach(categoryId => items.push({ categoryId }));
    } else if (appliesTo === 'specific_products') {
      selectedProductIds.forEach(productId => items.push({ productId }));
    } else if (appliesTo === 'specific_variants') {
      selectedVariantIds.forEach(variantId => {
        // Find product ID for this variant
        let prodId = null;
        for (const p of productsData) {
          const v = (p.variants || []).find((varItem: any) => varItem.id === variantId);
          if (v) {
            prodId = p.id;
            break;
          }
        }
        items.push({ productId: prodId, variantId });
      });
    }

    mutation.mutate({
      name,
      promoType,
      badgeText: badgeText || undefined,
      description: description || undefined,
      discountType,
      discountValue: Number(discountValue),
      minQuantity: Number(minQuantity) || 1,
      priority: Number(priority) || 1,
      appliesTo,
      validFrom,
      validTo,
      items,
    });
  };

  const toggleBrand = (id: string) => {
    setSelectedBrandIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleVariant = (id: string) => {
    setSelectedVariantIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-zinc-200">
        <DialogHeader className="border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 font-bold border border-amber-500/20">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <DialogTitle className="text-base font-extrabold text-zinc-900">
                {scheme ? "Edit Promotional Scheme" : "Create New Promotion / Offer"}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Define time-limited clearance sales, special offers, brand discounts, or product-specific deals.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          
          {/* 1. Campaign Name & Promotion Type */}
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                Promotion / Campaign Type *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PROMO_TYPES.map((pt) => {
                  const Icon = pt.icon;
                  const isSelected = promoType === pt.value;
                  return (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => setPromoType(pt.value)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all text-left ${
                        isSelected
                          ? `${pt.color} border-amber-600 ring-2 ring-amber-500/20 shadow-xs`
                          : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{pt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                  Scheme / Campaign Name *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Summer Clearance Sale 2026 / Hettich Brand 15% Off"
                  required
                  className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl font-medium"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                  Badge Tag on Bill &amp; Store
                </label>
                <Input
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  placeholder="e.g. Clearance / 20% OFF"
                  className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Description / Internal Notes
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional notes regarding the terms or target customers for this promotion..."
                className="text-xs bg-zinc-50 border-zinc-200 rounded-xl resize-none"
              />
            </div>
          </div>

          {/* 2. Target Scope (Brand-wise, Product-wise, Variant-wise, Category-wise, Storewide) */}
          <div className="space-y-3 p-4 rounded-2xl border border-zinc-200 bg-zinc-50/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-800 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-700" />
                Target Scope &amp; Applicability *
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { value: 'all_products', label: 'All Products (Storewide)' },
                { value: 'specific_brands', label: 'Brand-Wise' },
                { value: 'specific_categories', label: 'Category-Wise' },
                { value: 'specific_products', label: 'Product-Wise' },
                { value: 'specific_variants', label: 'Variant-Specific' },
              ].map((scope) => (
                <button
                  key={scope.value}
                  type="button"
                  onClick={() => setAppliesTo(scope.value)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                    appliesTo === scope.value
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  {scope.label}
                </button>
              ))}
            </div>

            {/* Scope Selection Pickers */}
            {appliesTo === 'specific_brands' && (
              <div className="pt-2 space-y-2">
                <div className="text-[11px] font-bold text-zinc-500 uppercase">Select Applicable Brands ({selectedBrandIds.length} selected):</div>
                <div className="max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 bg-white rounded-xl border border-zinc-200">
                  {brands.map((b: any) => {
                    const checked = selectedBrandIds.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBrand(b.id)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border text-left transition-all ${
                          checked ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold' : 'border-zinc-100 hover:bg-zinc-50 text-zinc-700'
                        }`}
                      >
                        <span className="truncate">{b.name}</span>
                        {checked && <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {appliesTo === 'specific_categories' && (
              <div className="pt-2 space-y-2">
                <div className="text-[11px] font-bold text-zinc-500 uppercase">Select Applicable Categories ({selectedCategoryIds.length} selected):</div>
                <div className="max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 bg-white rounded-xl border border-zinc-200">
                  {categories.map((c: any) => {
                    const checked = selectedCategoryIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCategory(c.id)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border text-left transition-all ${
                          checked ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold' : 'border-zinc-100 hover:bg-zinc-50 text-zinc-700'
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        {checked && <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {appliesTo === 'specific_products' && (
              <div className="pt-2 space-y-2">
                <div className="text-[11px] font-bold text-zinc-500 uppercase">Select Applicable Products ({selectedProductIds.length} selected):</div>
                <div className="max-h-48 overflow-y-auto space-y-1 p-2 bg-white rounded-xl border border-zinc-200">
                  {productsData.map((p: any) => {
                    const checked = selectedProductIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProduct(p.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border text-left transition-all ${
                          checked ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold' : 'border-zinc-100 hover:bg-zinc-50 text-zinc-700'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{p.name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">{p.sku} {p.brand?.name ? `• ${p.brand.name}` : ''}</span>
                        </div>
                        {checked && <Check className="w-4 h-4 text-amber-700 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {appliesTo === 'specific_variants' && (
              <div className="pt-2 space-y-2">
                <div className="text-[11px] font-bold text-zinc-500 uppercase">Select Specific Product Variants ({selectedVariantIds.length} selected):</div>
                <div className="max-h-48 overflow-y-auto space-y-1 p-2 bg-white rounded-xl border border-zinc-200">
                  {productsData.flatMap((p: any) =>
                    (p.variants || []).map((v: any) => {
                      const checked = selectedVariantIds.includes(v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => toggleVariant(v.id)}
                          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs border text-left transition-all ${
                            checked ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold' : 'border-zinc-100 hover:bg-zinc-50 text-zinc-700'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span>{p.name} - <span className="font-semibold text-amber-800">{v.name}</span></span>
                            <span className="text-[10px] text-zinc-400 font-mono">SKU: {v.sku}</span>
                          </div>
                          {checked && <Check className="w-4 h-4 text-amber-700 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Discount Rate & Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Discount Structure *
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="w-full h-9 text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="percentage">Percentage Off (%)</option>
                <option value="flat_amount">Flat Unit Discount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Discount Value *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percentage' ? 'e.g. 15 (for 15%)' : 'e.g. 250 (for ₹250)'}
                required
                className="h-9 text-xs font-mono bg-zinc-50 border-zinc-200 rounded-xl font-bold text-amber-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Min Order Qty (MOQ)
              </label>
              <Input
                type="number"
                min="1"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder="1"
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
          </div>

          {/* 4. Validity Period & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Valid From Date *
              </label>
              <Input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                required
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Valid To Date *
              </label>
              <Input
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                required
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
                Priority Rank
              </label>
              <Input
                type="number"
                min="0"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder="1 (Highest overrides)"
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-zinc-100 flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending} className="text-xs rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 rounded-xl shadow-sm">
              {mutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {mutation.isPending ? "Saving..." : scheme ? "Update Promotion" : "Create Promotion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
