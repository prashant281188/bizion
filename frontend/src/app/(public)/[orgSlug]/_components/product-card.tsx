import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Package, Layers, Sparkles, Tag, CheckCircle2 } from 'lucide-react';

interface ProductCardProps {
  product: any;
  orgSlug: string;
  priority?: boolean;
}

export function ProductCard({ product: prod, orgSlug, priority }: ProductCardProps) {
  const mainImage = prod.images?.find((img: any) => img.isPrimary) || prod.images?.[0];

  const getLowestMrp = (p: any) => {
    if (p.hasVariants && p.variants && p.variants.length > 0) {
      const prices = p.variants.map((v: any) => Number(v.mrp) || 0).filter((val: number) => val > 0);
      if (prices.length > 0) return Math.min(...prices);
    }
    return Number(prod.mrp) || 0;
  };

  const mrp = getLowestMrp(prod);
  const promoPrice = prod.promoPrice ? Number(prod.promoPrice) : null;
  const hasDiscount = promoPrice !== null && promoPrice > 0 && promoPrice < mrp;
  const discountPercent = hasDiscount ? Math.round(((mrp - promoPrice) / mrp) * 100) : 0;
  const variantCount = prod.variants?.length || (prod.hasVariants ? 1 : 0);

  return (
    <Link
      href={`/${orgSlug}/products/${prod.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-xs transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-500/80 relative"
    >
      {/* Full-Bleed Square Image Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-b from-stone-50 to-stone-100/70 flex items-center justify-center">
        {mainImage?.url ? (
          <Image
            src={mainImage.url}
            alt={prod.name}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-stone-300">
            <Package className="w-10 h-10 stroke-[1.25]" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">No Image</span>
          </div>
        )}

        {/* Top Badges Floating Layer */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none z-10">
          {/* Left Column Badges */}
          <div className="flex flex-col gap-1.5 items-start">
            {(prod.promoBadge || prod.promotion?.badgeText) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-white bg-gradient-to-r from-amber-600 to-amber-700 border border-amber-400/40 px-2.5 py-0.5 rounded-full shadow-sm tracking-tight backdrop-blur-md">
                <Sparkles className="w-2.5 h-2.5 text-amber-200" />
                {prod.promoBadge || prod.promotion?.badgeText}
              </span>
            )}

            {hasDiscount && !(prod.promoBadge || prod.promotion?.badgeText) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-white bg-gradient-to-r from-amber-600 to-amber-700 border border-amber-400/40 px-2.5 py-0.5 rounded-full shadow-sm tracking-tight backdrop-blur-md">
                <Tag className="w-2.5 h-2.5" />
                {discountPercent}% OFF
              </span>
            )}

            {prod.categoryName && (
              <span className="inline-flex items-center text-[10px] font-semibold text-stone-800 bg-white/95 backdrop-blur-md border border-stone-200/90 px-2.5 py-0.5 rounded-full shadow-2xs">
                {prod.categoryName}
              </span>
            )}
          </div>

          {/* Right Column Badges */}
          <div className="flex flex-col gap-1.5 items-end">
            {prod.brandName && (
              <span className="inline-flex items-center text-[9px] font-extrabold text-amber-300 bg-stone-900/90 backdrop-blur-md border border-amber-500/25 px-2.5 py-0.5 rounded-full shadow-xs tracking-widest uppercase">
                {prod.brandName}
              </span>
            )}

            {variantCount > 1 && (
              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-amber-950 bg-amber-50/95 backdrop-blur-md border border-amber-200/90 px-2 py-0.5 rounded-full shadow-2xs">
                <Layers className="w-2.5 h-2.5 text-amber-700" />
                {variantCount} Options
              </span>
            )}
          </div>
        </div>

        {/* Bottom subtle specs overlay tag */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          {prod.boxQuantity && prod.boxQuantity > 1 ? (
            <span className="inline-flex items-center text-[9px] font-semibold text-stone-700 bg-white/95 backdrop-blur-md border border-stone-200/80 px-2 py-0.5 rounded-md shadow-2xs">
              Box of {prod.boxQuantity} {prod.uomCode || 'pcs'}
            </span>
          ) : (
            <span />
          )}

          <span className="opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 inline-flex items-center gap-1 text-[9.5px] font-bold text-amber-800 bg-amber-50/95 backdrop-blur-md border border-amber-200 px-2.5 py-0.5 rounded-full shadow-xs">
            View Details
            <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Details Container */}
      <div className="flex flex-col p-4 bg-white flex-1 justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-stone-900 text-sm line-clamp-1 group-hover:text-amber-700 transition-colors">
              {prod.name}
            </h4>
            {(prod.promoBadge || prod.promotion?.badgeText) && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-2xs">
                ★ {prod.promoBadge || prod.promotion?.badgeText}
              </span>
            )}
          </div>
          {prod.sku && (
            <p className="text-[11px] font-mono text-stone-400 mt-0.5">Item Code: {prod.sku}</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2.5 border-t border-stone-100">
          <div>
            <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider block">
              {variantCount > 1 ? 'Starting from' : 'Price'}
            </span>
            <div className="flex items-baseline gap-1.5">
              {hasDiscount ? (
                <>
                  <span className="text-base font-extrabold text-amber-800">
                    ₹{promoPrice!.toLocaleString('en-IN', {
                      minimumFractionDigits: promoPrice! % 1 !== 0 ? 2 : 0,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-xs text-stone-400 line-through font-medium">
                    ₹{mrp.toLocaleString('en-IN')}
                  </span>
                </>
              ) : (
                <span className="text-base font-extrabold text-amber-900">
                  {mrp > 0
                    ? `₹${mrp.toLocaleString('en-IN', {
                        minimumFractionDigits: mrp % 1 !== 0 ? 2 : 0,
                        maximumFractionDigits: 2,
                      })}`
                    : 'Inquire for Quote'}
                </span>
              )}
            </div>
          </div>

          <div className="h-8.5 w-8.5 rounded-full bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-all flex items-center justify-center shadow-xs">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}
