import React from 'react';
import Link from 'next/link';
import { HeroCarousel } from './_components/hero-carousel';
import { CategoryCard } from './_components/category-card';
import { ProductCard } from './_components/product-card';

const CAROUSEL_ITEMS = [
  {
    gradient: 'from-zinc-50 via-white to-zinc-50',
    accentColor: 'text-amber-800',
    badge: 'Exclusive Collection',
    title: 'Explore Premium Quality Products',
    desc: 'Uncompromising craftsmanship, hand-picked for the highest quality and value.',
  },
  {
    gradient: 'from-zinc-100 via-white to-zinc-100',
    accentColor: 'text-amber-700',
    badge: 'Special Offers',
    title: 'Modern Essentials for Everyday',
    desc: 'Refresh your style and productivity with our curated collections, now available at special rates.',
  },
  {
    gradient: 'from-zinc-50 via-white to-zinc-50',
    accentColor: 'text-amber-800',
    badge: 'New Arrivals',
    title: 'A New Standard of Business Catalogs',
    desc: 'Browse our latest arrivals and experience the difference in performance and reliability.',
  },
];

export default async function StorefrontHomePage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const resolvedParams = await params;
  const orgSlug = resolvedParams.orgSlug;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  let org = null;
  let categories = [];
  let products = [];

  try {
    const [orgRes, catsRes, prodsRes] = await Promise.all([
      fetch(`${baseUrl}/products/public/${orgSlug}/organization`, { cache: 'no-store' }),
      fetch(`${baseUrl}/products/public/${orgSlug}/categories`, { cache: 'no-store' }),
      fetch(`${baseUrl}/products/public/${orgSlug}/products?limit=8`, { cache: 'no-store' }),
    ]);

    if (orgRes.ok) {
      const json = await orgRes.json();
      org = json.data;
    }
    if (catsRes.ok) {
      const json = await catsRes.json();
      categories = json.data || [];
    }
    if (prodsRes.ok) {
      const json = await prodsRes.json();
      products = json.data || [];
    }
  } catch (err) {
    console.error('Failed to load storefront homepage data:', err);
  }

  const parentCategories = categories.filter((cat: any) => !cat.parentId);

  // Resolve custom slides from settings or fallback to defaults
  const carouselItems = org?.settings?.storefrontCarousel && org.settings.storefrontCarousel.length > 0
    ? org.settings.storefrontCarousel.map((item: any, idx: number) => {
        const gradients = [
          'from-zinc-50 via-white to-zinc-50',
          'from-zinc-100 via-white to-zinc-100',
          'from-zinc-50 via-white to-zinc-50',
        ];
        const textAccents = ['text-amber-800', 'text-amber-700', 'text-amber-800'];
        return {
          gradient: gradients[idx % gradients.length],
          accentColor: textAccents[idx % textAccents.length],
          badge: item.badge || 'Featured Announcement',
          title: item.title,
          desc: item.desc || '',
        };
      })
    : CAROUSEL_ITEMS;

  const exploreBtnText = org?.settings?.storefront?.exploreButtonText || 'Explore Catalog';
  const exploreBtnUrl = org?.settings?.storefront?.exploreButtonUrl || '';
  const requestQuoteBtnText = org?.settings?.storefront?.requestQuoteButtonText || 'Request Quotation';
  const requestQuoteBtnUrl = org?.settings?.storefront?.requestQuoteButtonUrl || '';

  return (
    <div className="flex flex-col gap-16 pb-20 animate-in fade-in duration-1000">
      
      {/* 1. Hero Carousel */}
      <HeroCarousel 
        carouselItems={carouselItems} 
        orgSlug={orgSlug}
        exploreButtonText={exploreBtnText}
        exploreButtonUrl={exploreBtnUrl}
        requestQuoteButtonText={requestQuoteBtnText}
        requestQuoteButtonUrl={requestQuoteBtnUrl}
      />

      {/* 2. Category Selection */}
      <section className="mx-auto max-w-7xl w-full px-6 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both" style={{ animationDelay: '150ms' }} aria-labelledby="categories-title">
        <div className="flex items-end justify-between border-b border-zinc-200 pb-5 mb-8">
          <div>
            <h3 id="categories-title" className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
              Browse by Category
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              Explore our curated collections designed for you.
            </p>
          </div>
          <Link href={`/${orgSlug}/products`} className="text-xs font-semibold text-amber-700 hover:text-amber-600 transition-colors">
            View All →
          </Link>
        </div>

        {parentCategories.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50">
            <p className="text-sm font-medium text-zinc-500">No categories found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {parentCategories.slice(0, 6).map((cat: any, i: number) => (
              <div key={cat.id} className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: `${200 + i * 50}ms` }}>
                <CategoryCard category={cat} orgSlug={orgSlug} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Featured Products */}
      <section className="mx-auto max-w-7xl w-full px-6 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both" style={{ animationDelay: '300ms' }} aria-labelledby="products-title">
        <div className="flex items-end justify-between border-b border-zinc-200 pb-5 mb-8">
          <div>
            <h3 id="products-title" className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
              Featured Products
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              Handpicked selections just for you.
            </p>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50">
            <p className="text-sm font-medium text-zinc-500">No featured products found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product: any, i: number) => (
              <div key={product.id} className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: `${400 + i * 50}ms` }}>
                <ProductCard product={product} orgSlug={orgSlug} priority={i < 4} />
              </div>
            ))}
          </div>
        )}
      </section>
      
      {/* 4. Trust Badges / Footer Info */}
      <section className="mx-auto max-w-7xl w-full px-6 animate-in fade-in duration-700 fill-mode-both" style={{ animationDelay: '600ms' }}>
         <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-stone-200/80 p-8 sm:p-12 flex flex-col md:flex-row items-center justify-around gap-8 text-center shadow-sm">
            <div className="flex flex-col items-center max-w-[200px]">
              <div className="h-12 w-12 bg-white shadow-sm rounded-full flex items-center justify-center text-amber-600 mb-4 border border-stone-100">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h4 className="font-bold text-zinc-900 text-sm mb-1">Premium Quality</h4>
              <p className="text-xs text-zinc-500">Guaranteed highest standards across all catalogs.</p>
            </div>
            <div className="flex flex-col items-center max-w-[200px]">
              <div className="h-12 w-12 bg-white shadow-sm rounded-full flex items-center justify-center text-amber-600 mb-4 border border-stone-100">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              </div>
              <h4 className="font-bold text-zinc-900 text-sm mb-1">Secure Payments</h4>
              <p className="text-xs text-zinc-500">End-to-end encrypted safe and secure transactions.</p>
            </div>
            <div className="flex flex-col items-center max-w-[200px]">
              <div className="h-12 w-12 bg-white shadow-sm rounded-full flex items-center justify-center text-amber-600 mb-4 border border-stone-100">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h4 className="font-bold text-zinc-900 text-sm mb-1">Fast Support</h4>
              <p className="text-xs text-zinc-500">24/7 dedicated assistance for your business needs.</p>
            </div>
         </div>
      </section>

    </div>
  );
}
