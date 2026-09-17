'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';


import React, { useEffect, useState } from 'react';
import { useStorefront } from './storefront-provider';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';

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
  barcode?: string;
  attributes: Record<string, string>;
  sellingPrice: string;
  mrp?: string;
  promoPrice?: string | null;
  promoBadge?: string | null;
  promotion?: {
    name: string;
    badgeText?: string;
    discountAmount?: string;
    promoType?: string;
  } | null;
  isActive: boolean;
  defaultPacking?: string | null;
  boxQuantity?: number;
  categoryName?: string;
  imageUrl?: string | null;
}

interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  type: string;
  sku: string;
  barcode?: string;
  basePrice: string;
  sellingPrice: string;
  mrp: string;
  promoPrice?: string | null;
  promoBadge?: string | null;
  promotion?: {
    name: string;
    badgeText?: string;
    discountAmount?: string;
    promoType?: string;
  } | null;
  categoryName?: string;
  brandName?: string;
  uomCode?: string;
  hasVariants: boolean;
  variants: Variant[];
  images: ProductImage[];
  attributes?: Record<string, string>;
  boxQuantity?: number;
}

export function ProductDetailClient({ product }: { product: ProductDetail }) {
  const { orgSlug } = useStorefront();
  const router = useRouter();

  const [activeImage, setActiveImage] = useState<string>('');
  
  // Variant Selection State
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);

  const handleVariantRowClick = (v: Variant) => {
    setSelectedVariant(v);
    setSelectedAttributes(v.attributes || {});
    if (v.imageUrl) {
      setActiveImage(v.imageUrl);
    } else if (product?.images && product.images.length > 0) {
      const primary = product.images.find((img: any) => img.isPrimary) || product.images[0];
      setActiveImage(primary.url);
    }
  };

  useEffect(() => {
    if (!product) return;
    
    // Set default active image
    const primaryImg = product.images?.find((img: ProductImage) => img.isPrimary) || product.images?.[0];
    if (primaryImg) {
      setActiveImage(primaryImg.url);
    }

    // Initialize variant attributes if variants exist
    if (product.hasVariants && product.variants?.length > 0) {
      const firstVariant = product.variants[0];
      setSelectedVariant(firstVariant);
      setSelectedAttributes(firstVariant.attributes || {});
      
      if (firstVariant.imageUrl) {
        setActiveImage(firstVariant.imageUrl);
      }
    }
  }, [product]);

  // Extract unique attribute keys and their values
  const getAttributeOptions = () => {
    if (!product || !product.variants) return {};
    
    const options: Record<string, Set<string>> = {};
    product.variants.forEach((v) => {
      if (v.attributes) {
        Object.entries(v.attributes).forEach(([key, value]) => {
          if (!options[key]) {
            options[key] = new Set();
          }
          options[key].add(value);
        });
      }
    });

    // Convert Sets to arrays for rendering
    const result: Record<string, string[]> = {};
    Object.entries(options).forEach(([key, valueSet]) => {
      result[key] = Array.from(valueSet);
    });
    return result;
  };

  // Find variant matching current selections
  const handleAttributeSelect = (key: string, value: string) => {
    if (!product) return;

    const updatedSelections = {
      ...selectedAttributes,
      [key]: value,
    };
    setSelectedAttributes(updatedSelections);

    // Find the matching variant
    const matched = product.variants.find((v) => {
      return Object.entries(updatedSelections).every(
        ([k, val]) => v.attributes?.[k] === val
      );
    });

    if (matched) {
      setSelectedVariant(matched);
      if (matched.imageUrl) {
        setActiveImage(matched.imageUrl);
      } else if (product.images && product.images.length > 0) {
        const primary = product.images.find((img: any) => img.isPrimary) || product.images[0];
        setActiveImage(primary.url);
      }
    } else {
      setSelectedVariant(null);
      if (product.images && product.images.length > 0) {
        const primary = product.images.find((img: any) => img.isPrimary) || product.images[0];
        setActiveImage(primary.url);
      }
    }
  };

  if (!product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-white text-zinc-900">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-sm bg-amber-50 text-amber-600 border border-amber-100">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 mb-2">Product Not Found</h2>
        <p className="text-sm text-zinc-500 mb-6 max-w-sm text-center">
          The product you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <Link
          href={`/${orgSlug}/products`}
          className="inline-flex h-11 items-center justify-center rounded-sm bg-zinc-900 px-6 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
        >
          Back to Catalog
        </Link>
      </div>
    );
  }

  const attributeOptions = getAttributeOptions();
  const displayMrp = selectedVariant
    ? Number(selectedVariant.mrp) || 0
    : Number(product.mrp) || 0;
  
  const displayPromoPrice = selectedVariant?.promoPrice 
    ? Number(selectedVariant.promoPrice) 
    : (product.promoPrice ? Number(product.promoPrice) : null);

  const displayBadge = selectedVariant?.promoBadge || product.promoBadge;
  const hasPromo = displayPromoPrice !== null && displayPromoPrice > 0 && displayPromoPrice < displayMrp;
  const promoDiscountPct = hasPromo ? Math.round(((displayMrp - displayPromoPrice) / displayMrp) * 100) : 0;
  
  const displaySku = selectedVariant ? selectedVariant.sku : product.sku;
  const displayBarcode = selectedVariant ? selectedVariant.barcode : product.barcode;

  return (
    <div className="mx-auto max-w-7xl w-full px-6 py-10">
      
      {/* Breadcrumbs */}
      <nav className="mb-8 flex items-center gap-2 text-xs font-semibold text-zinc-400">
        <Link href={`/${orgSlug}`} className="hover:text-zinc-700">Home</Link>
        <span>/</span>
        <Link href={`/${orgSlug}/products`} className="hover:text-zinc-700">Products</Link>
        <span>/</span>
        <span className="text-zinc-800 line-clamp-1">{product.name}</span>
      </nav>

      {/* Main product presentation block */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
        
        {/* Left Column: Image Gallery */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          
          {/* Main Display Image */}
          <div className="relative aspect-square w-full rounded-2xl border border-stone-200/80 bg-stone-100 overflow-hidden flex items-center justify-center shadow-sm">
            {activeImage ? (
              <Image
                src={activeImage}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover rounded-2xl transition-all duration-300"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <svg className="h-16 w-16 stroke-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-wider">No Image Available</span>
              </div>
            )}
          </div>

          {/* Thumbnail list */}
          {product.images?.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto py-1 scrollbar-none">
              {product.images.map((img) => (
                <Button variant="ghost"
                  key={img.id}
                  onClick={() => setActiveImage(img.url)}
                  className={`relative h-16 w-16 flex-shrink-0 rounded-sm overflow-hidden border bg-zinc-50 ${
                    activeImage === img.url ? 'border-amber-600 ring-2 ring-amber-600/20' : 'border-zinc-250/80 hover:border-zinc-300'
                  }`}
                >
                  <Image 
                    src={img.thumbnailUrl || img.url} 
                    alt="Thumbnail" 
                    fill
                    sizes="64px"
                    className="object-cover" 
                  />
                </Button>
              ))}
            </div>
          )}

        </div>

        {/* Right Column: Product Actions & Configs */}
        <div className="lg:col-span-6 flex flex-col justify-start">
          
          {/* Badges / Brand / Category */}
          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            {(selectedVariant?.categoryName || product.categoryName) && (
              <span className="text-xxs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200/50 px-2.5 py-1 rounded-full">
                {selectedVariant?.categoryName || product.categoryName}
              </span>
            )}
            {product.brandName && (
              <span className="text-xxs font-bold uppercase tracking-wider text-zinc-600 bg-zinc-50 border border-zinc-200/80 px-2.5 py-1 rounded-full">
                Brand: {product.brandName}
              </span>
            )}
            {displayBadge && (
              <span className="text-xxs font-extrabold uppercase tracking-wider text-white bg-amber-600 border border-amber-500 px-2.5 py-1 rounded-full shadow-2xs">
                ★ {displayBadge}
              </span>
            )}
          </div>

          {/* Name & Short Description */}
          <h1 className="text-2xl sm:text-4xl font-extrabold text-zinc-900 tracking-tight mb-3">
            {product.name}
          </h1>
          {product.shortDescription && (
            <p className="text-sm text-zinc-600 mb-6 leading-relaxed">
              {product.shortDescription}
            </p>
          )}

          <hr className="border-zinc-250/80 mb-6" />

          {/* Price Info */}
          <div className="mb-8">
            <span className="text-xxs font-bold uppercase tracking-widest text-stone-500 block mb-1">
              {product.hasVariants && !selectedVariant ? 'Starting from Price' : 'Price'}
            </span>
            <div className="flex items-baseline gap-3 flex-wrap">
              {hasPromo ? (
                <>
                  <span className="text-3xl font-extrabold text-amber-600">
                    ₹{displayPromoPrice.toLocaleString('en-IN', {
                      minimumFractionDigits: displayPromoPrice % 1 !== 0 ? 2 : 0,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-lg font-semibold text-stone-400 line-through">
                    ₹{displayMrp.toLocaleString('en-IN', {
                      minimumFractionDigits: displayMrp % 1 !== 0 ? 2 : 0,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-xs font-bold text-amber-700 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded-md">
                    {promoDiscountPct}% OFF
                  </span>
                </>
              ) : (
                <span className="text-3xl font-extrabold text-stone-900">
                  ₹{displayMrp.toLocaleString('en-IN', {
                    minimumFractionDigits: displayMrp % 1 !== 0 ? 2 : 0,
                    maximumFractionDigits: 2,
                  })}
                </span>
              )}
              {product.uomCode && (
                <span className="text-xs text-stone-500 font-semibold">
                  per {product.uomCode}
                </span>
              )}
            </div>
          </div>

          {/* Dynamic Variant Selector (attributes resolver) */}
          {product.hasVariants && product.variants?.length > 0 && (
            <div className="mb-8 flex flex-col gap-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-850">Select Options</h3>
              
              {Object.entries(attributeOptions).map(([key, options]) => (
                <div key={key} className="flex flex-col gap-2">
                  <span className="text-xxs font-semibold uppercase tracking-wider text-zinc-500">{key}</span>
                  <div className="flex flex-wrap gap-2">
                    {options.map((val) => {
                      const isSelected = selectedAttributes[key] === val;
                      return (
                        <Button variant="ghost"
                          key={val}
                          onClick={() => handleAttributeSelect(key, val)}
                          className={`rounded-sm border px-4 py-2 text-xs font-semibold tracking-wide transition-all ${
                            isSelected
                              ? 'border-amber-600 bg-amber-50 text-amber-800 shadow-sm'
                              : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
                          }`}
                        >
                          {val}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* No match indicator */}
              {!selectedVariant && (
                <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  The selected combination of options is currently unavailable. Please select other variants.
                </div>
              )}
            </div>
          )}

          {/* Catalog Metadata Info Grid */}
          <div className="rounded-2xl border border-stone-200/80 bg-white/80 backdrop-blur-sm p-5 mt-auto shadow-sm">
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-zinc-500 font-semibold">SKU Code</span>
                <p className="font-mono text-zinc-800 mt-0.5">{displaySku || 'N/A'}</p>
              </div>
              <div>
                <span className="text-zinc-500 font-semibold">Barcode</span>
                <p className="font-mono text-zinc-800 mt-0.5">{displayBarcode || 'N/A'}</p>
              </div>
              <div>
                <span className="text-zinc-500 font-semibold">Std Packing</span>
                <p className="font-mono text-zinc-800 mt-0.5">
                  {selectedVariant ? `${selectedVariant.boxQuantity || 1} ${product.uomCode || 'pcs'}/box` : `${product.boxQuantity || 1} ${product.uomCode || 'pcs'}/box`}
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Available Variants Matrix */}
      {product.hasVariants && product.variants?.length > 0 && (
        <section className="border-t border-zinc-200 pt-10 mb-6" aria-labelledby="variants-table-title">
          <h2 id="variants-table-title" className="text-lg font-bold text-zinc-900 mb-6">Available Sizes & Specifications</h2>
          {(() => {
            const rawMap = new Map<string, { size: string; price: string; promoPrice?: string | null; promoBadge?: string | null; packing: string }[]>();

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
              const packing = v.boxQuantity ? `${v.boxQuantity} ${product.uomCode || 'pcs'}/box` : (v.defaultPacking || '');
              const finalFn = fn || 'Standard';
              const finalSz = sz || 'Standard';
              const price = v.mrp || v.sellingPrice || '0';
              const promoPrice = v.promoPrice || null;
              const promoBadge = v.promoBadge || null;

              if (!rawMap.has(finalFn)) rawMap.set(finalFn, []);
              const list = rawMap.get(finalFn)!;
              if (!list.some(i => i.size === finalSz && i.price === price && i.promoPrice === promoPrice && i.packing === packing))
                list.push({ size: finalSz, price, promoPrice, promoBadge, packing });
            });

            // Combine finishes with identical size/price signature
            const combined: { finishes: string[]; sizes: { size: string; price: string; promoPrice?: string | null; promoBadge?: string | null; packing: string }[] }[] = [];
            const sigMap = new Map<string, number>();
            rawMap.forEach((sizes, finish) => {
              const sig = sizes.map(s => `${s.size}|${s.price}|${s.promoPrice || ''}|${s.packing}`).sort().join(';;');
              if (sigMap.has(sig)) {
                combined[sigMap.get(sig)!].finishes.push(finish);
              } else {
                sigMap.set(sig, combined.length);
                combined.push({ finishes: [finish], sizes });
              }
            });

            return (
              <div className="flex flex-col gap-4">
                {combined.map((g, i) => (
                  <div key={i} className="flex flex-col md:flex-row md:items-start gap-5 p-5 rounded-2xl border border-zinc-200/80 bg-white shadow-sm hover:shadow-md transition-all hover:border-amber-200">
                    
                    {/* Finish column */}
                    <div className="md:w-1/3 lg:w-1/4 shrink-0">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Available In</h4>
                      <div className="flex flex-wrap gap-2">
                        {g.finishes.map((fn, j) => (
                          <span key={j} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-800 text-xs font-semibold border border-zinc-200/60">
                            {fn}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Size/Price column */}
                    <div className="flex-1">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Sizes & Prices</h4>
                      <div className="flex flex-wrap gap-3">
                        {g.sizes.map((s, k) => {
                          const basePrice = Number(s.price) || 0;
                          const promoVal = s.promoPrice ? Number(s.promoPrice) : null;
                          const hasDiscount = promoVal !== null && promoVal > 0 && promoVal < basePrice;
                          const discPct = hasDiscount ? Math.round(((basePrice - promoVal) / basePrice) * 100) : 0;

                          return (
                            <div key={k} className="flex flex-col items-start p-3 rounded-xl border border-amber-200/60 bg-amber-50/40 min-w-[110px] transition-colors hover:bg-amber-50/80 relative">
                              <span className="text-xs font-medium text-zinc-600 mb-0.5">{s.size}</span>
                              {hasDiscount ? (
                                <div className="flex flex-col">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="text-base font-bold text-amber-900 tracking-tight leading-none">
                                      ₹{promoVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[10px] font-semibold text-stone-400 line-through">
                                      ₹{basePrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <span className="text-[9px] font-extrabold text-amber-700 mt-0.5">
                                    {discPct}% OFF
                                  </span>
                                </div>
                              ) : (
                                <span className="text-base font-bold text-amber-900 tracking-tight leading-none">
                                  ₹{basePrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </span>
                              )}
                              {s.packing && (
                                <span className="text-[10px] text-zinc-500 mt-1.5">
                                  {s.packing}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      )}

      {/* Specifications & Description Sheet */}
      <section className="border-t border-zinc-200 pt-10" aria-labelledby="details-title">
        <h2 id="details-title" className="text-lg font-bold text-zinc-900 mb-6">Product Details & Specs</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left: Description */}
          <div className="lg:col-span-7">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-750 mb-4">Description</h3>
            {product.description ? (
              <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            ) : (
              <p className="text-sm text-zinc-400 italic">No description provided for this product.</p>
            )}
          </div>

          {/* Right: Technical Attributes Table */}
          <div className="lg:col-span-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-750 mb-4">Specifications</h3>
            
            <div className="overflow-hidden rounded-sm border border-zinc-200">
              <Table className="min-w-full text-left text-sm text-zinc-600">
                <TableBody>
                  <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                    <TableHead scope="row" className="px-6 py-4 font-semibold text-zinc-500 w-1/3">Catalog Type</TableHead>
                    <TableCell className="px-6 py-4 text-zinc-800 uppercase">{product.type}</TableCell>
                  </TableRow>
                  <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                    <TableHead scope="row" className="px-6 py-4 font-semibold text-zinc-500">UOM</TableHead>
                    <TableCell className="px-6 py-4 text-zinc-800">{product.uomCode || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                    <TableHead scope="row" className="px-6 py-4 font-semibold text-zinc-500">Category</TableHead>
                    <TableCell className="px-6 py-4 text-zinc-800">{product.categoryName || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow className={product.attributes && Object.keys(product.attributes).length > 0 ? "border-b border-zinc-200" : ""}>
                    <TableHead scope="row" className="px-6 py-4 font-semibold text-zinc-500">Brand</TableHead>
                    <TableCell className="px-6 py-4 text-zinc-800">{product.brandName || 'N/A'}</TableCell>
                  </TableRow>
                  {product.attributes && Object.entries(product.attributes).map(([key, value], idx, arr) => (
                    <TableRow
                      key={key}
                      className={`${idx < arr.length - 1 ? "border-b border-zinc-200" : ""} ${
                        idx % 2 === 1 ? "bg-zinc-50" : ""
                      }`}>
                      <TableHead scope="row" className="px-6 py-4 font-semibold text-zinc-500">{key}</TableHead>
                      <TableCell className="px-6 py-4 text-zinc-800">{value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
