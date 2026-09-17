'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from "@/components/ui/card";
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { useCategories, useBrands } from '@/hooks/useMasters';

type DirtyMap = Record<string, { basePrice: string; sellingPrice: string }>;
type DirtyProductMap = Record<string, { basePrice: string; sellingPrice: string }>;

interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  basePrice: string;
  sellingPrice: string;
  isActive: boolean;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  hasVariants: boolean;
  basePrice: string;
  sellingPrice: string;
  categoryName: string | null;
  brandName: string | null;
  variants: ProductVariant[];
}

interface PriceEdit {
  basePrice: string;
  sellingPrice: string;
}

function fmt(val: string | number | null | undefined) {
  if (val === null || val === undefined) return '0.00';
  const n = Number(val);
  return isNaN(n) ? '0.00' : n.toFixed(2);
}

function PriceCell({
  value,
  onChange,
  isDirty,
}: {
  value: string;
  onChange: (v: string) => void;
  isDirty: boolean;
}) {
  return (
    <div className={`relative rounded-lg transition-all ${isDirty ? 'ring-2 ring-amber-500/50' : ''}`}>
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs select-none">₹</span>
      <Input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full pl-6 pr-2 bg-white text-zinc-900 transition-colors ${
          isDirty
            ? 'border-amber-500 focus-visible:ring-amber-500/20'
            : 'border-zinc-200 focus-visible:ring-amber-500/20 focus-visible:border-amber-500'
        }`}
      />
    </div>
  );
}

export default function PriceListManageItemsPage() {
  const queryClient = useQueryClient();
  const { id } = useParams() as { id: string };
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [dirtyMap, setDirtyMap] = useState<DirtyMap>({});
  const [dirtyProductMap, setDirtyProductMap] = useState<DirtyProductMap>({});
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    clearTimeout((window as any).__searchTimer);
    (window as any).__searchTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 300);
  }, []);

  const { data: priceList } = useQuery({
    queryKey: ['price-list', id],
    queryFn: async () => {
      const res = await api.get(`/pricing/lists/${id}`);
      return res.data.data;
    },
  });

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['price-list-items', id, debouncedSearch, categoryId, brandId, page, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit };
      if (debouncedSearch) params.q = debouncedSearch;
      if (categoryId) params.categoryId = categoryId;
      if (brandId) params.brandId = brandId;
      const res = await api.get(`/pricing/lists/${id}/items`, { params });
      return res.data.data;
    },
  });

  const { data: categoriesData } = useCategories();
  const { data: brandsData } = useBrands();

  const products = rawData?.data || [];
  const totalPages = rawData?.pagination?.totalPages || 1;
  const categories = categoriesData || [];
  const brands = brandsData || [];

  const dirtyCount = Object.keys(dirtyMap).length + Object.keys(dirtyProductMap).length;

  const toggleExpand = (productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const allExpanded = useMemo(() => {
    return products.length > 0 && products.every((p: any) => expandedProducts.has(p.id));
  }, [products, expandedProducts]);

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedProducts(new Set());
    } else {
      setExpandedProducts(new Set(products.map((p: any) => p.id)));
    }
  };

  const getValue = (variantId: string, field: keyof PriceEdit, original: string) => {
    return dirtyMap[variantId]?.[field] ?? fmt(original);
  };

  const isDirty = (variantId: string) => !!dirtyMap[variantId];
  const isProductDirty = (productId: string) => !!dirtyProductMap[productId];

  const handleVariantChange = (variant: ProductVariant, field: keyof PriceEdit, val: string) => {
    setDirtyMap(prev => ({
      ...prev,
      [variant.id]: {
        basePrice: prev[variant.id]?.basePrice ?? fmt(variant.basePrice),
        sellingPrice: prev[variant.id]?.sellingPrice ?? fmt(variant.sellingPrice),
        [field]: val,
      },
    }));
  };

  const handleProductChange = (product: Product, field: keyof PriceEdit, val: string) => {
    setDirtyProductMap(prev => ({
      ...prev,
      [product.id]: {
        basePrice: prev[product.id]?.basePrice ?? fmt(product.basePrice),
        sellingPrice: prev[product.id]?.sellingPrice ?? fmt(product.sellingPrice),
        [field]: val,
      },
    }));
  };

  const discardAll = () => {
    setDirtyMap({});
    setDirtyProductMap({});
  };

  const saveMutation = useMutation({
    mutationFn: async (items: any[]) => {
      const res = await api.patch(`/pricing/lists/${id}/items`, { items });
      return res.data;
    },
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: ['price-list-items', id] });
      const previousQueries = queryClient.getQueriesData({ queryKey: ['price-list-items', id] });

      queryClient.setQueriesData({ queryKey: ['price-list-items', id] }, (oldData: any) => {
        if (!oldData?.data) return oldData;
        const newData = { ...oldData };
        newData.data = newData.data.map((product: any) => {
          const updatedProduct = { ...product };
          const pUpdate = items.find(i => i.productId === product.id && i.variantId === null);
          if (pUpdate) {
            updatedProduct.basePrice = pUpdate.basePrice.toString();
            updatedProduct.sellingPrice = pUpdate.sellingPrice.toString();
          }

          if (updatedProduct.hasVariants && updatedProduct.variants) {
            updatedProduct.variants = updatedProduct.variants.map((variant: any) => {
              const vUpdate = items.find(i => i.productId === product.id && i.variantId === variant.id);
              if (vUpdate) {
                return {
                  ...variant,
                  basePrice: vUpdate.basePrice.toString(),
                  sellingPrice: vUpdate.sellingPrice.toString(),
                };
              }
              return variant;
            });
          }
          return updatedProduct;
        });
        return newData;
      });

      return { previousQueries };
    },
    onError: (err: any, _newTodo, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, oldData]) => {
          queryClient.setQueryData(queryKey, oldData);
        });
      }
      toast.error(err.response?.data?.message || 'Failed to save changes');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['price-list-items', id] });
    },
    onSuccess: () => {
      toast.success('Price list items updated successfully');
      setDirtyMap({});
      setDirtyProductMap({});
    }
  });

  const handleSave = () => {
    if (dirtyCount === 0) return;
    
    const items = [];
    
    for (const [productId, prices] of Object.entries(dirtyProductMap)) {
      items.push({
        productId,
        variantId: null,
        basePrice: parseFloat(prices.basePrice) || 0,
        sellingPrice: parseFloat(prices.sellingPrice) || 0,
      });
    }

    for (const [variantId, prices] of Object.entries(dirtyMap)) {
      const product = products.find((p: any) => p.variants.some((v: any) => v.id === variantId));
      if (product) {
        items.push({
          productId: product.id,
          variantId,
          basePrice: parseFloat(prices.basePrice) || 0,
          sellingPrice: parseFloat(prices.sellingPrice) || 0,
        });
      }
    }

    saveMutation.mutate(items);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-zinc-200 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/products/price-lists"
            className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors border border-zinc-200 bg-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Manage Items: {priceList?.name || 'Loading...'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={dirtyCount === 0 || saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <Card className="bg-white rounded-xl shadow-sm border border-zinc-200">
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-start gap-4">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-3"
            />
          </div>

          <div className="w-48">
            <Select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Categories', value: '' },
                ...categories.map((c: any) => ({ label: c.name, value: c.id }))
              ]}
            />
          </div>
          <div className="w-48">
            <Select
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Brands', value: '' },
                ...brands.map((b: any) => ({ label: b.name, value: b.id }))
              ]}
            />
          </div>

          {products.length > 0 && (
            <Button
              variant="outline"
              onClick={toggleExpandAll}
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </Button>
          )}
        </div>
      </Card>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-zinc-600 font-medium">No products found</p>
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_120px_60px] gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 bg-zinc-50">
              <span>Product / Variant</span>
              <span className="text-center">Base Price</span>
              <span className="text-center">Selling Price</span>
              <span></span>
            </div>
            <div className="divide-y divide-zinc-200">
              {products.map((product: any) => {
                const isExpanded = expandedProducts.has(product.id);
                const pDirtyRaw = dirtyProductMap[product.id];
                const isPDirty = !!pDirtyRaw;

                return (
                  <Card
                    key={product.id}
                    className={`transition-all rounded-none border-x-0 border-t-0 shadow-none ${
                      (isPDirty || product.variants.some((v: any) => isDirty(v.id))) ? 'border-amber-500/30 bg-amber-50/20' : ''
                    }`}
                  >
                    {!product.hasVariants ? (
                      <div className="w-full grid grid-cols-[1fr_120px_120px_60px] gap-3 items-center px-4 py-3">
                        <span className="font-semibold">{product.name}</span>
                        <PriceCell
                          value={pDirtyRaw?.basePrice ?? fmt(product.basePrice)}
                          onChange={v => handleProductChange(product, 'basePrice', v)}
                          isDirty={isPDirty && pDirtyRaw?.basePrice !== fmt(product.basePrice)}
                        />
                        <PriceCell
                          value={pDirtyRaw?.sellingPrice ?? fmt(product.sellingPrice)}
                          onChange={v => handleProductChange(product, 'sellingPrice', v)}
                          isDirty={isPDirty && pDirtyRaw?.sellingPrice !== fmt(product.sellingPrice)}
                        />
                      </div>
                    ) : (
                      <>
                        <div onClick={() => toggleExpand(product.id)} className="grid grid-cols-[1fr_120px_120px_60px] gap-3 items-center px-4 py-3 cursor-pointer">
                          <span className="font-semibold">{product.name}</span>
                        </div>
                        {isExpanded && product.variants.map((variant: any) => {
                          const dirty = isDirty(variant.id);
                          return (
                            <div key={variant.id} className={`grid grid-cols-[1fr_120px_120px_60px] gap-3 items-center px-4 py-3 border-t border-zinc-200 ${dirty ? 'bg-amber-50/20' : ''}`}>
                              <div className="pl-7 text-sm">{variant.name}</div>
                              <PriceCell
                                value={getValue(variant.id, 'basePrice', variant.basePrice)}
                                onChange={(v) => handleVariantChange(variant, 'basePrice', v)}
                                isDirty={dirty && dirtyMap[variant.id]?.basePrice !== fmt(variant.basePrice)}
                              />
                              <PriceCell
                                value={getValue(variant.id, 'sellingPrice', variant.sellingPrice)}
                                onChange={(v) => handleVariantChange(variant, 'sellingPrice', v)}
                                isDirty={dirty && dirtyMap[variant.id]?.sellingPrice !== fmt(variant.sellingPrice)}
                              />
                            </div>
                          );
                        })}
                      </>
                    )}
                  </Card>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-zinc-200">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  limit={limit}
                  onLimitChange={(newLimit) => {
                    setLimit(newLimit);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </Card>
        )}
      </div>

      {dirtyCount > 0 && (
        <div className="fixed bottom-6 right-6 z-40 animate-slide-up">
          <div className="flex items-center gap-3 bg-white border border-amber-200 rounded-2xl px-5 py-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
               <div className="h-2 w-2 rounded-full bg-amber-600 animate-pulse" />
               <span className="text-sm text-amber-800 font-semibold">
                 {dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}
               </span>
             </div>
             <div className="h-4 w-px bg-zinc-200" />
             <Button variant="ghost"
               onClick={discardAll}
               className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-semibold"
             >
               Discard
             </Button>
             <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              Save All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
