'use client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

import React, { useEffect, useState, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStorefront } from './storefront-provider';
import api from '@/lib/api';
import { ProductCard } from '../_components/product-card';
import { useSearchParams, useRouter } from 'next/navigation';

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
}

interface CategoryNode extends Category {
  children: CategoryNode[];
}

const buildCategoryTree = (flatCategories: Category[]): CategoryNode[] => {
  const map: Record<string, CategoryNode> = {};
  const roots: CategoryNode[] = [];

  flatCategories.forEach((cat) => {
    map[cat.id] = { ...cat, children: [] };
  });

  flatCategories.forEach((cat) => {
    const node = map[cat.id];
    if (cat.parentId && map[cat.parentId]) {
      map[cat.parentId].children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

interface Brand {
  id: string;
  name: string;
  slug: string;
}

interface ProductImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  isPrimary: boolean;
}

interface Variant {
  id: string;
  name: string;
  sku: string;
  sellingPrice: string;
  mrp: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  brandName?: string;
  categoryName?: string;
  basePrice: string;
  sellingPrice: string;
  hasVariants: boolean;
  variants: Variant[];
  images: ProductImage[];
  mrp?: string;
}

export function ProductsCatalogClient({
  initialProducts,
  initialCategories,
  initialBrands
}: {
  initialProducts: Product[];
  initialCategories: Category[];
  initialBrands: Brand[];
}) {
  const { orgSlug } = useStorefront();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Search, Filter & Sort States
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [attributeInputs, setAttributeInputs] = useState<Record<string, string>>({});
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string[]>>({});
  
  // Data States
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [brands, setBrands] = useState<Brand[]>(initialBrands);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleExpand = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  // Auto-expand ancestors when selectedCategory changes
  useEffect(() => {
    if (!selectedCategory || categories.length === 0) return;
    
    setExpandedCategories((prev) => {
      const newExpanded = { ...prev };
      let hasUpdates = false;
      
      if (!newExpanded[selectedCategory]) {
        newExpanded[selectedCategory] = true;
        hasUpdates = true;
      }

      let currentId: string | undefined | null = selectedCategory;
      
      while (currentId) {
        const cat = categories.find(c => c.id === currentId);
        if (cat && cat.parentId) {
          if (!newExpanded[cat.parentId]) {
            newExpanded[cat.parentId] = true;
            hasUpdates = true;
          }
          currentId = cat.parentId;
        } else {
          break;
        }
      }
      
      return hasUpdates ? newExpanded : prev;
    });
  }, [selectedCategory, categories]);

  // Pagination State
  const [page, setPage] = useState(1);

  // Read initial filters from query parameter if present
  useEffect(() => {
    const catQuery = searchParams.get('category');
    if (catQuery) {
      setSelectedCategory(catQuery);
    }
    
    // Parse attributes
    const initialAttrs: Record<string, string[]> = {};
    const initialInputs: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith('attr_')) {
        const attrName = key.replace('attr_', '');
        initialAttrs[attrName] = value.split(',');
        initialInputs[attrName] = value;
      }
    });
    setSelectedAttributes(initialAttrs);
    setAttributeInputs(initialInputs);
  }, [searchParams]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on search
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Debounce attribute inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      const newAttrs: Record<string, string[]> = {};
      const currentParams = new URLSearchParams(Array.from(searchParams.entries()));
      let changed = false;

      // Handle additions / updates
      Object.entries(attributeInputs).forEach(([key, val]) => {
        const paramKey = `attr_${key}`;
        if (val.trim()) {
          newAttrs[key] = [val.trim()];
          if (currentParams.get(paramKey) !== val.trim()) {
            currentParams.set(paramKey, val.trim());
            changed = true;
          }
        } else {
          if (currentParams.has(paramKey)) {
            currentParams.delete(paramKey);
            changed = true;
          }
        }
      });

      // Handle deletions
      searchParams.forEach((value, key) => {
        if (key.startsWith('attr_')) {
          const attrName = key.replace('attr_', '');
          if (!attributeInputs[attrName] || !attributeInputs[attrName].trim()) {
            currentParams.delete(key);
            changed = true;
          }
        }
      });

      if (changed) {
        setPage(1);
        setSelectedAttributes(newAttrs);
        const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
        window.history.pushState(null, '', newUrl);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [attributeInputs, searchParams]);

  // Fetch Attributes for current organization and category
  const { data: attributesData } = useQuery({
    queryKey: ['public-storefront-attributes', orgSlug, selectedCategory],
    queryFn: async () => {
      let url = `/products/public/${orgSlug}/attributes`;
      if (selectedCategory) url += `?categoryId=${selectedCategory}`;
      const res = await api.get(url);
      return res.data?.data || {};
    },
  });

  // TanStack Query for high performance, caching & smooth pagination
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'public-storefront-products',
      orgSlug,
      page,
      selectedCategory,
      selectedBrand,
      debouncedSearch,
      sortBy,
      sortOrder,
      selectedAttributes,
    ],
    queryFn: async () => {
      let url = `/products/public/${orgSlug}/products?page=${page}&limit=12`;
      if (selectedCategory) url += `&categoryId=${selectedCategory}`;
      if (selectedBrand) url += `&brandId=${selectedBrand}`;
      if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;
      if (sortBy) url += `&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      
      // Append attribute filters
      Object.entries(selectedAttributes).forEach(([key, values]) => {
        if (values && values.length > 0) {
          url += `&attr_${encodeURIComponent(key)}=${encodeURIComponent(values.join(','))}`;
        }
      });

      const res = await api.get(url);
      return res.data;
    },
    placeholderData: (prev) => prev,
    initialData: page === 1 && !selectedCategory && !selectedBrand && !debouncedSearch && sortBy === 'createdAt' && sortOrder === 'desc'
      ? {
          data: initialProducts,
          pagination: {
            page: 1,
            limit: 12,
            total: initialProducts.length,
            totalPages: Math.ceil(initialProducts.length / 12) || 1,
          },
        }
      : undefined,
  });

  const products: Product[] = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 12, total: products.length, totalPages: 1 };
  const totalProducts = pagination.total || 0;
  const totalPages = Math.max(1, pagination.totalPages || 1);
  const loading = isLoading || isFetching;

  const handleSortChange = (value: string) => {
    setPage(1);
    switch (value) {
      case 'newest':
        setSortBy('createdAt');
        setSortOrder('desc');
        break;
      case 'price_asc':
        setSortBy('mrp');
        setSortOrder('asc');
        break;
      case 'price_desc':
        setSortBy('mrp');
        setSortOrder('desc');
        break;
      case 'name_asc':
        setSortBy('name');
        setSortOrder('asc');
        break;
      case 'name_desc':
        setSortBy('name');
        setSortOrder('desc');
        break;
      default:
        setSortBy('createdAt');
        setSortOrder('desc');
    }
  };


  return (
    <div className="mx-auto max-w-7xl w-full px-6 py-10">
      
      {/* Header Info */}
      <div className="mb-8 border-b border-stone-200/80 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 mb-2">Product Catalog</h1>
        <p className="text-sm text-stone-600">
          Explore our complete collection of quality inventory products with interactive filters.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Filters Sidebar (Desktop) / Header (Mobile) */}
        <aside className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-6" aria-label="Product Filters">
          
          {/* Search Box */}
          <div className="relative" role="search">
            <Input
              type="text"
              placeholder="Search by name or SKU..."
              value={search}
              aria-label="Search product catalog"
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white border-stone-200 text-stone-900 placeholder-stone-400 focus-visible:border-amber-600 focus-visible:ring-2 focus-visible:ring-amber-600/30 shadow-xs h-[42px] text-xs rounded-xl pl-3 pr-9"
            />
            <svg className="absolute top-3 right-3 h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Categories Filter list (Desktop) */}
          <div className="hidden lg:block rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-4 flex items-center justify-between">
              Categories
            </h3>
            <div className="flex flex-col gap-1.5">
              <Button
                variant="ghost"
                onClick={() => { setSelectedCategory(''); setPage(1); }}
                className={`text-left justify-start text-xs font-semibold py-2 px-3 rounded-xl transition-all flex items-center gap-1.5 min-h-[38px] ${
                  selectedCategory === '' ? 'bg-amber-600 text-white font-bold shadow-xs' : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <span>All Categories</span>
              </Button>
              {(() => {
                const categoryTree = buildCategoryTree(categories);
                const renderCategoryNode = (node: CategoryNode, depth = 0) => {
                  const isSelected = selectedCategory === node.id;
                  const hasChildren = node.children.length > 0;
                  const isExpanded = !!expandedCategories[node.id];

                  return (
                    <React.Fragment key={node.id}>
                      <div className="flex items-center w-full" style={{ paddingLeft: `${depth * 12}px` }}>
                        <Button variant="ghost"
                          onClick={(e) => { 
                            setSelectedCategory(node.id); 
                            setPage(1); 
                            if (hasChildren) {
                              toggleExpand(node.id, e);
                            }
                          }}
                          className={`text-left text-xs font-medium py-1.5 px-2 rounded-sm transition-all hover:text-amber-800 flex-grow w-full flex items-center justify-between gap-1.5 ${
                            isSelected
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold'
                              : 'text-zinc-600 hover:bg-amber-50/80 hover:text-amber-900 border border-transparent'
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
                        </Button>
                      </div>
                      {hasChildren && isExpanded && (
                        <div className="flex flex-col gap-1.5">
                          {node.children.map((child) => renderCategoryNode(child, depth + 1))}
                        </div>
                      )}
                    </React.Fragment>
                  );
                };
                return categoryTree.map((node) => renderCategoryNode(node, 0));
              })()}
            </div>
          </div>

          {/* Brands Filter list (Desktop) */}
          <div className="hidden lg:block rounded-2xl border border-stone-200/80 bg-white/85 backdrop-blur-sm p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 mb-4">Brands</h3>
            <div className="flex flex-col gap-2">
              <Button variant="ghost"
                onClick={() => { setSelectedBrand(''); setPage(1); }}
                className={`text-left justify-start text-xs font-medium py-1 px-2 rounded-sm transition-colors hover:text-amber-800 ${
                  selectedBrand === '' ? 'bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold' : 'text-zinc-600 hover:bg-zinc-50 border border-transparent'
                }`}
              >
                All Brands
              </Button>
              {brands.map((br) => (
                <Button variant="ghost"
                  key={br.id}
                  onClick={() => { setSelectedBrand(br.id); setPage(1); }}
                  className={`text-left justify-start text-xs font-medium py-1 px-2 rounded-sm transition-colors hover:text-amber-800 ${
                    selectedBrand === br.id ? 'bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold' : 'text-zinc-600 hover:bg-zinc-50 border border-transparent'
                  }`}
                >
                  {br.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Dynamic Attribute Filters (Desktop) */}
          {attributesData && Object.entries(attributesData).map(([attrKey, values]) => {
            const vals = values as string[];
            if (!vals || vals.length === 0) return null;
            return (
              <div key={attrKey} className="hidden lg:block rounded-2xl border border-stone-200/80 bg-white/85 backdrop-blur-sm p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 mb-4">{attrKey}</h3>
                <div className="flex flex-col gap-2">
                  <Input
                    type="text"
                    placeholder={`e.g. ${vals[0] || 'Type here'}`}
                    value={attributeInputs[attrKey] || ''}
                    onChange={(e) => setAttributeInputs(prev => ({ ...prev, [attrKey]: e.target.value }))}
                    className="w-full text-sm bg-stone-50 border-stone-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl"
                  />
                </div>
              </div>
            );
          })}

          {/* Mobile Filters (Select dropdowns) */}
          <div className="flex lg:hidden flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="mobile-category" className="sr-only">Category</label>
              {(() => {
                const categoryTree = buildCategoryTree(categories);
                const flatOptions = [{label: 'All Categories', value: ''}];
                const traverse = (nodes: CategoryNode[], depth: number) => {
                  nodes.forEach(node => {
                    const prefix = depth > 0 ? '\u00A0\u00A0'.repeat(depth * 2) + '↳ ' : '';
                    flatOptions.push({value: node.id, label: prefix + node.name});
                    if (node.children.length > 0) traverse(node.children, depth + 1);
                  });
                };
                traverse(categoryTree, 0);
                return (
                  <Select
                    value={selectedCategory}
                    onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                    options={flatOptions}
                    className="bg-white text-zinc-700 border-zinc-200"
                  />
                );
              })()}
            </div>
            
            <div className="flex-1">
              <label htmlFor="mobile-brand" className="sr-only">Brand</label>
              <Select
                value={selectedBrand}
                onChange={(e) => { setSelectedBrand(e.target.value); setPage(1); }}
                options={[
                  { label: 'All Brands', value: '' },
                  ...brands.map(br => ({ label: br.name, value: br.id }))
                ]}
                className="bg-white text-zinc-700 border-zinc-200"
              />
            </div>

            {/* Dynamic Attribute Filters (Mobile) */}
            {attributesData && Object.entries(attributesData).map(([attrKey, values]) => {
              const vals = values as string[];
              if (!vals || vals.length === 0) return null;
              
              return (
                <div key={`mobile-${attrKey}`} className="flex-1">
                  <label htmlFor={`mobile-attr-${attrKey}`} className="sr-only">{attrKey}</label>
                  <Input
                    type="text"
                    placeholder={`Search ${attrKey}...`}
                    value={attributeInputs[attrKey] || ''}
                    onChange={(e) => setAttributeInputs(prev => ({ ...prev, [attrKey]: e.target.value }))}
                    className="bg-white text-zinc-700 border-zinc-200 w-full"
                  />
                </div>
              );
            })}
          </div>

        </aside>

        {/* Products List & Sort Section */}
        <section className="flex-grow flex flex-col gap-6" aria-labelledby="catalog-title">
          <h2 id="catalog-title" className="sr-only">Product List</h2>
          
          {/* Top Sort Panel */}
          <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
            <span className="text-xs text-zinc-500 font-medium">
              Showing {totalProducts} {totalProducts === 1 ? 'product' : 'products'}
            </span>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-full px-5 gap-2 text-amber-900 bg-white hover:bg-amber-50 border border-amber-200 shadow-sm hidden sm:flex transition-all"
                onClick={() => {
                  const defaultHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
                  const baseUrl = process.env.NEXT_PUBLIC_API_URL || `http://${defaultHost}:3000/api/v1`;
                  let url = `${baseUrl}/products/public/${orgSlug}/catalog-pdf?`;
                  if (selectedCategory) url += `categoryId=${selectedCategory}&`;
                  if (selectedBrand) url += `brandId=${selectedBrand}&`;
                  window.open(url, '_blank');
                }}
              >
                <svg className="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Catalog PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-full px-5 gap-2 text-white bg-amber-700 hover:bg-amber-800 border border-amber-800 shadow-md hidden sm:flex font-semibold transition-all"
                onClick={() => {
                  const defaultHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
                  const baseUrl = process.env.NEXT_PUBLIC_API_URL || `http://${defaultHost}:3000/api/v1`;
                  let url = `${baseUrl}/products/public/${orgSlug}/price-list-pdf?`;
                  if (selectedCategory) url += `categoryId=${selectedCategory}&`;
                  if (selectedBrand) url += `brandId=${selectedBrand}&`;
                  window.open(url, '_blank');
                }}
              >
                <svg className="w-4 h-4 text-amber-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Price List PDF
              </Button>
              <label htmlFor="sort-select" className="text-xs text-zinc-500 font-semibold whitespace-nowrap">SORT BY</label>
              <Select
                value={
                  sortBy === 'createdAt' ? 'newest' :
                  sortBy === 'mrp' && sortOrder === 'asc' ? 'price_asc' :
                  sortBy === 'mrp' && sortOrder === 'desc' ? 'price_desc' :
                  sortBy === 'name' && sortOrder === 'asc' ? 'name_asc' :
                  sortBy === 'name' && sortOrder === 'desc' ? 'name_desc' : 'newest'
                }
                onChange={(e) => handleSortChange(e.target.value)}
                options={[
                  { value: 'newest', label: 'Newest Arrivals' },
                  { value: 'price_asc', label: 'Price: Low to High' },
                  { value: 'price_desc', label: 'Price: High to Low' },
                  { value: 'name_asc', label: 'Name: A to Z' },
                  { value: 'name_desc', label: 'Name: Z to A' },
                ]}
                className="bg-white text-zinc-700 border-zinc-200 h-9"
              />
            </div>
          </div>

          {/* Loader */}
          {loading && page === 1 ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-amber-600" />
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-sm border border-zinc-200 bg-zinc-50 py-24 text-center text-zinc-500">
              <svg className="mx-auto h-12 w-12 text-zinc-300 stroke-1 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.143 17.082a24.248 24.248 0 003.844.148m-3.844-.148a23.856 23.856 0 01-5.08-.614m9.753.614c.325.03.649.062.973.095m-9.753-.095a24.247 24.247 0 00-3.844-.148m3.844.148a23.856 23.856 0 005.08-.614m-9.753.614a24.444 24.444 0 00-3.844-.148m3.844.148v.008c0 .167-.008.333-.023.5a2.25 2.25 0 01-2.24 2.155H4.5a2.25 2.25 0 01-2.24-2.154 24.453 24.453 0 01-.022-.51v-.008m0 0z" />
              </svg>
              <h3 className="text-sm font-bold text-zinc-850 mb-1">No Products Found</h3>
              <p className="text-xs text-zinc-500">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <>
              {/* Product Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both" style={{ animationDelay: '150ms' }}>
                {products.map((prod, i) => (
                  <ProductCard key={prod.id} product={prod} orgSlug={orgSlug} priority={i < 4} />
                ))}
              </div>

              {/* Numbered Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-12 flex flex-wrap items-center justify-center gap-2 pt-6 border-t border-zinc-200">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => {
                      setPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="h-9 px-3 text-xs font-semibold text-zinc-700 hover:bg-amber-50 hover:text-amber-800 border-zinc-200 disabled:opacity-40"
                  >
                    ← Previous
                  </Button>

                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                    <Button
                      key={p}
                      variant={page === p ? 'default' : 'outline'}
                      size="sm"
                      disabled={loading}
                      onClick={() => {
                        setPage(p);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`h-9 w-9 text-xs font-semibold transition-all ${
                        page === p
                          ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                          : 'text-zinc-700 hover:bg-amber-50 hover:text-amber-800 border-zinc-200'
                      }`}
                    >
                      {p}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => {
                      setPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="h-9 px-3 text-xs font-semibold text-zinc-700 hover:bg-amber-50 hover:text-amber-800 border-zinc-200 disabled:opacity-40"
                  >
                    Next →
                  </Button>
                </div>
              )}
            </>
          )}

        </section>

      </div>
    </div>
  );
}
