'use client';

import React, { useState, useEffect } from 'react';
import { PresentationLayout } from '@/components/storefront/presentation/PresentationLayout';
import { SwipeGallery } from '@/components/storefront/presentation/SwipeGallery';
import api from '@/lib/api';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';

export default function PresentationPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const unwrappedParams = React.use(params);
  const orgSlug = unwrappedParams.orgSlug;


  // Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [attributeInputs, setAttributeInputs] = useState<Record<string, string>>({});
  const [debouncedAttributes, setDebouncedAttributes] = useState<Record<string, string>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({ categories: true, brands: true });

  const toggleExpand = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  // Build category tree
  const buildCategoryTree = (categories: any[]) => {
    const map: Record<string, any> = {};
    const roots: any[] = [];
    categories.forEach((cat) => {
      map[cat.id] = { id: cat.id, name: cat.name, parentId: cat.parentId, children: [] };
    });
    categories.forEach((cat) => {
      if (cat.parentId && map[cat.parentId]) {
        map[cat.parentId].children.push(map[cat.id]);
      } else {
        roots.push(map[cat.id]);
      }
    });
    return roots;
  };

  // Fetch Categories
  const { data: categoriesData } = useQuery({
    queryKey: ['public-storefront-categories', orgSlug],
    queryFn: async () => {
      const res = await api.get(`/products/public/${orgSlug}/categories`);
      return res.data?.data || [];
    },
    enabled: !!orgSlug,
  });
  const categories = categoriesData || [];

  // Fetch Brands
  const { data: brandsData } = useQuery({
    queryKey: ['public-storefront-brands', orgSlug],
    queryFn: async () => {
      const res = await api.get(`/products/public/${orgSlug}/brands`);
      return res.data?.data || [];
    },
    enabled: !!orgSlug,
  });
  const brands = brandsData || [];

  // Fetch Attributes
  const { data: attributesData } = useQuery({
    queryKey: ['presentation-attributes', orgSlug, selectedCategory],
    queryFn: async () => {
      let url = `/products/public/${orgSlug}/attributes`;
      if (selectedCategory !== 'all') url += `?categoryId=${selectedCategory}`;
      const res = await api.get(url);
      return res.data?.data || {};
    },
    enabled: !!orgSlug,
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounce attribute inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAttributes({ ...attributeInputs });
    }, 400);
    return () => clearTimeout(timer);
  }, [attributeInputs]);

  // Build selected attributes for query
  const selectedAttributes: Record<string, string[]> = {};
  Object.entries(debouncedAttributes).forEach(([key, val]) => {
    if (val.trim()) selectedAttributes[key] = [val.trim()];
  });

  // Helper to get category/brand name for chips
  const getCategoryName = (id: string) => categories.find((c: any) => c.id === id)?.name || id;
  const getBrandName = (id: string) => brands.find((b: any) => b.id === id)?.name || id;

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedBrand('all');
    setAttributeInputs({});
  };

  const hasActiveFilters = selectedCategory !== 'all' || selectedBrand !== 'all' || searchQuery.trim() !== '' || Object.values(attributeInputs).some(v => v.trim());

  // Fetch products when filters change
  const { data: productsData, isLoading: loading } = useQuery({
    queryKey: ['presentation-products', orgSlug, selectedCategory, selectedBrand, debouncedSearch, selectedAttributes],
    queryFn: async () => {
      let url = `/products/public/${orgSlug}/products?limit=50`;
      if (selectedCategory !== 'all') url += `&categoryId=${selectedCategory}`;
      if (selectedBrand !== 'all') url += `&brandId=${selectedBrand}`;
      if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;
      
      // Append attribute filters
      Object.entries(selectedAttributes).forEach(([key, values]) => {
        if (values && values.length > 0) {
          url += `&attr_${encodeURIComponent(key)}=${encodeURIComponent(values.join(','))}`;
        }
      });
      
      const res = await api.get(url);
      return res.data?.data || [];
    },
    enabled: !!orgSlug,
  });
  const products = productsData || [];
  const filteredProducts = products;

  return (
    <>
      {loading && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] pointer-events-none">
          <div className="bg-black/60 backdrop-blur text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            <span className="text-sm font-medium">Loading products...</span>
          </div>
        </div>
      )}
      <PresentationLayout 
        products={filteredProducts}
        renderProduct={(product, isActive) => (
          <SwipeGallery product={product} isActive={isActive} />
        )}
        renderFilters={() => (
          <div className="space-y-3">
            {/* Result Count */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 tracking-wider">
                {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
              </span>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Active Filter Chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2">
                {selectedCategory !== 'all' && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">
                    {getCategoryName(selectedCategory)}
                    <button onClick={() => setSelectedCategory('all')} className="hover:text-amber-950"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {selectedBrand !== 'all' && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">
                    {getBrandName(selectedBrand)}
                    <button onClick={() => setSelectedBrand('all')} className="hover:text-amber-950"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {Object.entries(attributeInputs).filter(([_, v]) => v.trim()).map(([key, val]) => (
                  <span key={key} className="inline-flex items-center gap-1 text-xs font-medium bg-zinc-100 text-zinc-700 px-2.5 py-1 rounded-full">
                    {key}: {val}
                    <button onClick={() => setAttributeInputs(prev => ({ ...prev, [key]: '' }))} className="hover:text-zinc-950"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}

            <div>
              <h3 className="font-bold text-amber-900 uppercase tracking-wider text-[10px] mb-1.5">Search</h3>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-white border border-amber-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all shadow-sm"
            />
          </div>

          <div>
            <button
              onClick={() => setCollapsedSections(prev => ({ ...prev, categories: !prev.categories }))}
              className="w-full flex items-center justify-between mb-1.5"
            >
              <h3 className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">Categories</h3>
              <svg className={`h-3 w-3 text-zinc-400 transition-transform duration-200 ${collapsedSections.categories ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {!collapsedSections.categories && (
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`text-left px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'all' 
                    ? 'bg-amber-100 text-amber-800 font-bold' 
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                All Categories
              </button>
              {(() => {
                const categoryTree = buildCategoryTree(categories);
                const renderCategoryNode = (node: any, depth = 0) => {
                  const isSelected = selectedCategory === node.id;
                  const hasChildren = node.children && node.children.length > 0;
                  const isExpanded = !!expandedCategories[node.id];

                  return (
                    <React.Fragment key={node.id}>
                      <div className="flex items-center w-full" style={{ paddingLeft: `${depth * 12}px` }}>
                        <button
                          onClick={(e) => {
                            setSelectedCategory(node.id);
                            if (hasChildren) {
                              toggleExpand(node.id, e);
                            }
                          }}
                          className={`text-left text-sm font-medium py-1.5 px-2.5 rounded-lg transition-all flex-grow w-full flex items-center justify-between gap-1.5 ${
                            isSelected
                              ? 'bg-amber-100 text-amber-800 font-bold'
                              : 'text-zinc-600 hover:bg-zinc-100'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {depth > 0 && <span className="text-zinc-300 font-normal">↳</span>}
                            <span className="truncate">{node.name}</span>
                          </div>
                          {hasChildren && (
                            <svg
                              className={`h-3 w-3 flex-shrink-0 text-zinc-400 transform transition-transform duration-200 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {hasChildren && isExpanded && (
                        <div className="flex flex-col gap-0.5">
                          {node.children.map((child: any) => renderCategoryNode(child, depth + 1))}
                        </div>
                      )}
                    </React.Fragment>
                  );
                };
                return categoryTree.map((node) => renderCategoryNode(node, 0));
              })()}
            </div>
            )}
          </div>

          <div>
            <button
              onClick={() => setCollapsedSections(prev => ({ ...prev, brands: !prev.brands }))}
              className="w-full flex items-center justify-between mb-1.5"
            >
              <h3 className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">Brands</h3>
              <svg className={`h-3 w-3 text-zinc-400 transition-transform duration-200 ${collapsedSections.brands ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {!collapsedSections.brands && (
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setSelectedBrand('all')}
                className={`text-left px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedBrand === 'all' 
                    ? 'bg-amber-100 text-amber-800' 
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                All Brands
              </button>
              {brands.map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBrand(b.id)}
                  className={`text-left px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedBrand === b.id 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
            )}
          </div>

          {/* Dynamic Attribute Filters */}
          {attributesData && Object.entries(attributesData).map(([attrKey, values]) => {
            if (!values || (Array.isArray(values) && values.length === 0)) return null;
            return (
              <div key={attrKey}>
                <h3 className="font-bold text-amber-900 uppercase tracking-wider text-[10px] mb-1.5">{attrKey}</h3>
                <input
                  type="text"
                  placeholder={`Search ${attrKey}...`}
                  value={attributeInputs[attrKey] || ''}
                  onChange={(e) => setAttributeInputs(prev => ({ ...prev, [attrKey]: e.target.value }))}
                  className="w-full h-9 px-3 text-sm bg-white border border-amber-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all shadow-sm"
                />
              </div>
            );
          })}
        </div>
      )}
      renderDetails={(product) => (
        <div className="flex flex-col gap-3 pb-4">
          {/* Compact Header: Name + Price inline */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {product.brandName && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                  {product.brandName}
                </span>
              )}
              {product.categoryName && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                  {product.categoryName}
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight leading-tight">
              {product.name}
            </h1>
            {product.variantName && (
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mt-0.5">{product.variantName}</p>
            )}

            {/* Price row */}
            {(() => {
              if (!product.variants || product.variants.length === 0) {
                return (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100">
                    <span className="text-lg font-bold text-amber-900">₹{product.mrp || product.sellingPrice}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${product.stockQuantity > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                      {product.stockQuantity > 0 ? `In Stock (${product.stockQuantity})` : 'Out of Stock'}
                    </span>
                  </div>
                );
              }
              const prices = product.variants.map((v: any) => parseFloat(v.mrp || v.sellingPrice || '0')).filter((p: number) => p > 0);
              const min = prices.length ? Math.min(...prices) : 0;
              const max = prices.length ? Math.max(...prices) : 0;
              return (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100">
                  <span className="text-lg font-bold text-amber-900">
                    {min === max ? `₹${min}` : `₹${min} – ₹${max}`}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                    {product.variants.length} variants
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Compact Variant List */}
          {(() => {
            if (!product.variants || product.variants.length === 0) return null;

            const rawMap = new Map<string, { size: string; price: string; packing: string }[]>();

            product.variants.forEach((v: any) => {
              const attrs = v.attributes || {};
              const finishKey = Object.keys(attrs).find(k => ['finish', 'color', 'colour'].includes(k.toLowerCase()));
              const sizeKey = Object.keys(attrs).find(k => k.toLowerCase() === 'size');
              let sz = '', fn = '';
              if (sizeKey || finishKey) {
                sz = sizeKey ? attrs[sizeKey] : '';
                fn = finishKey ? attrs[finishKey] : v.name;
              } else {
                const parts = v.name.split('-').map((p: string) => p.trim());
                if (parts.length > 1) { sz = parts[0]; fn = parts.slice(1).join(' - '); }
                else { sz = v.name; fn = v.name; }
              }
              const packing = v.boxQuantity ? `${v.boxQuantity}/box` : '';
              const finalFn = fn || 'Standard';
              const finalSz = sz || 'Standard';
              const price = v.mrp || v.sellingPrice || '0';

              if (!rawMap.has(finalFn)) rawMap.set(finalFn, []);
              const list = rawMap.get(finalFn)!;
              if (!list.some(i => i.size === finalSz && i.price === price && i.packing === packing))
                list.push({ size: finalSz, price, packing });
            });

            // Combine finishes with identical size/price signature
            const combined: { finishes: string[]; sizes: { size: string; price: string; packing: string }[] }[] = [];
            const sigMap = new Map<string, number>();
            rawMap.forEach((sizes, finish) => {
              const sig = sizes.map(s => `${s.size}|${s.price}|${s.packing}`).sort().join(';;');
              if (sigMap.has(sig)) {
                combined[sigMap.get(sig)!].finishes.push(finish);
              } else {
                sigMap.set(sig, combined.length);
                combined.push({ finishes: [finish], sizes });
              }
            });

            return (
              <div className="flex flex-wrap gap-2">
                {combined.map((g, i) => (
                  <div key={i} className="flex-1 min-w-[45%] p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/80 space-y-1.5">
                    <div className="flex flex-wrap gap-1">
                      {g.finishes.map((fn, j) => (
                        <span key={j} className="text-[11px] font-bold text-zinc-800 bg-white border border-zinc-200 px-1.5 py-0.5 rounded shadow-2xs">
                          {fn}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {g.sizes.map((s, k) => (
                        <span key={k} className="inline-flex items-center gap-1 text-[11px] text-amber-900 bg-amber-50 border border-amber-200/60 rounded px-1.5 py-0.5">
                          <span className="font-medium text-zinc-600">{s.size}</span>
                          <span className="font-bold">₹{s.price}</span>
                          {s.packing && <span className="text-zinc-400 text-[9px]">({s.packing})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    />
    </>
  );
}
