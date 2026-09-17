'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';

interface SwipeGalleryProps {
  product: any;
  isActive: boolean;
}

export function SwipeGallery({ product, isActive }: SwipeGalleryProps) {
  const images = product.images || [];
  const hasImages = images.length > 0;
  
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Reset thumbnail index when product changes
  useEffect(() => {
    setActiveImageIndex(0);
  }, [product.id]);
  
  const activeImage = hasImages ? images[activeImageIndex]?.url : null;

  return (
    <div className="relative w-full h-full flex flex-col justify-center items-center bg-gradient-to-b from-zinc-100 via-white to-zinc-200 pointer-events-none select-none">
      {/* Main Image */}
      <div className="relative w-full h-full flex justify-center items-center overflow-hidden p-2 sm:p-4 md:p-8 pb-16 sm:pb-20 md:pb-16">
        {activeImage ? (
          <motion.img 
            key={activeImage}
            src={activeImage} 
            alt={product.name}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full h-full object-contain object-center pointer-events-auto mix-blend-multiply drop-shadow-xl"
            // @ts-ignore
            fetchPriority="high"
            decoding="async"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 bg-zinc-50">
            <Package className="w-20 h-20 mb-3 opacity-40" />
            <p className="text-xs font-semibold tracking-widest uppercase">No Image Available</p>
          </div>
        )}
      </div>

      {/* Dark Gradient Overlay for flawless text contrast */}
      <div className="absolute bottom-0 inset-x-0 h-52 sm:h-64 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none z-10" />

      {/* Floating Presentation Overlay Content */}
      <div className="absolute bottom-3 sm:bottom-6 md:bottom-8 left-4 right-4 sm:left-12 sm:right-12 md:left-24 md:right-24 z-20 flex flex-col gap-1 pointer-events-auto">
        {/* SKU / Code */}
        {product.sku && (
          <span className="text-[10px] sm:text-xs font-extrabold text-amber-400 uppercase tracking-widest drop-shadow">
            {product.sku}
          </span>
        )}
        
        {/* Product Title */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-md">
          {product.name}
        </h1>
        
        {/* Short Description */}
        {(product.shortDescription || product.short_description) && (
          <p className="text-xs sm:text-sm md:text-base font-medium text-zinc-200/95 max-w-2xl line-clamp-2 leading-relaxed drop-shadow">
            {product.shortDescription || product.short_description}
          </p>
        )}
        
        {/* Thumbnails Bar (Guaranteed zero-clipping active gold ring) */}
        {images.length > 1 && (
          <div className="flex gap-2.5 sm:gap-3.5 mt-1.5 overflow-x-auto py-2 px-2 items-center scrollbar-hide">
            {images.map((img: any, idx: number) => {
              const isSelected = idx === activeImageIndex;
              return (
                <button
                  key={img.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex(idx);
                  }}
                  className={`relative p-0.5 rounded-full shrink-0 transition-all duration-200 ${
                    isSelected 
                      ? 'bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 shadow-lg shadow-black/50 scale-105' 
                      : 'bg-transparent opacity-65 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  <div className="w-9 h-9 sm:w-13 sm:h-13 rounded-full overflow-hidden border border-white/90 bg-white">
                    <img src={img.url} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
