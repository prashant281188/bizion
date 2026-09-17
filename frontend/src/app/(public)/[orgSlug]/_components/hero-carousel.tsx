'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';

export function HeroCarousel({ 
  carouselItems, 
  orgSlug,
  exploreButtonText = 'Explore Hardware Catalog',
  exploreButtonUrl,
  requestQuoteButtonText = 'Request Quotation',
  requestQuoteButtonUrl,
}: { 
  carouselItems: any[]; 
  orgSlug: string;
  exploreButtonText?: string;
  exploreButtonUrl?: string;
  requestQuoteButtonText?: string;
  requestQuoteButtonUrl?: string;
}) {
  const [activeSlide, setActiveSlide] = useState(0);

  const primaryUrl = exploreButtonUrl || `/${orgSlug}/products`;
  const secondaryUrl = requestQuoteButtonUrl || `/${orgSlug}/contact`;

  useEffect(() => {
    if (!carouselItems || carouselItems.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % carouselItems.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [carouselItems]);

  if (!carouselItems || carouselItems.length === 0) return null;

  return (
    <section className="relative h-[480px] sm:h-[580px] w-full overflow-hidden bg-stone-100/80 border-b border-stone-200/80" aria-label="Featured Architectural Hardware Carousel">
      <div className="relative h-full w-full">
        {carouselItems.map((item, index) => {
          const isActive = index === activeSlide;
          return (
            <div
              key={index}
              className={`absolute inset-0 flex items-center bg-gradient-to-r from-stone-100 via-amber-50/60 to-stone-100 transition-all duration-1000 ease-in-out ${
                isActive ? 'opacity-100 z-10 scale-100' : 'opacity-0 z-0 scale-95 pointer-events-none'
              }`}
            >
              <div className="mx-auto max-w-7xl px-8 w-full z-10">
                <div className="max-w-2xl">
                  {isActive && (
                    <>
                      <div className="inline-flex items-center gap-2 mb-4 rounded-full border border-amber-600/30 bg-amber-500/10 backdrop-blur-md px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-900 shadow-xs animate-in slide-in-from-bottom-3 fade-in duration-500">
                        <Compass className="w-3.5 h-3.5 text-amber-700" />
                        {item.badge || 'Architectural Hardware Collection'}
                      </div>
                      <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-stone-900 mb-6 leading-tight animate-in slide-in-from-bottom-5 fade-in duration-700 delay-100">
                        {item.title}
                      </h2>
                      <p className="text-sm sm:text-base text-stone-600 mb-8 leading-relaxed max-w-xl animate-in slide-in-from-bottom-6 fade-in duration-700 delay-200">
                        {item.desc}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-300">
                        <Link
                          href={primaryUrl}
                          className="inline-flex h-12 items-center justify-center rounded-full bg-amber-600 px-7 text-xs font-bold text-white shadow-md shadow-amber-600/20 hover:bg-amber-700 transition-all hover:scale-[1.02] gap-2"
                        >
                          {exploreButtonText}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                          href={secondaryUrl}
                          className="inline-flex h-12 items-center justify-center rounded-xl border border-stone-200 bg-white px-6 text-xs font-bold text-stone-800 hover:bg-stone-50 transition-all shadow-xs"
                        >
                          {requestQuoteButtonText}
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Carousel Indicators */}
      {carouselItems.length > 1 && (
        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-3 z-20">
          {carouselItems.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveSlide(index)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                index === activeSlide ? 'w-8 bg-amber-600 shadow-md' : 'w-2.5 bg-stone-300 hover:bg-stone-400'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
