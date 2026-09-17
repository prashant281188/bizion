import React, { Suspense } from 'react';
import { ProductsCatalogClient } from '../_components/products-catalog-client';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const orgSlug = resolvedParams.orgSlug;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  
  try {
    const res = await fetch(`${baseUrl}/products/public/${orgSlug}/organization`, { cache: 'no-store' });
    if (!res.ok) return { title: 'Products' };
    const json = await res.json();
    const org = json.data;

    return {
      title: `Products | ${org.name}`,
      description: `Browse all products from ${org.name}.`,
    };
  } catch (error) {
    return { title: 'Products' };
  }
}

export default async function StorefrontCatalogPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const resolvedParams = await params;
  const orgSlug = resolvedParams.orgSlug;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  let initialProducts = [];
  let initialCategories = [];
  let initialBrands = [];

  try {
    const [catsRes, brandsRes, prodsRes] = await Promise.all([
      fetch(`${baseUrl}/products/public/${orgSlug}/categories`, { cache: 'no-store' }),
      fetch(`${baseUrl}/products/public/${orgSlug}/brands`, { cache: 'no-store' }),
      fetch(`${baseUrl}/products/public/${orgSlug}/products?page=1&limit=12`, { cache: 'no-store' }),
    ]);

    if (catsRes.ok) {
      const json = await catsRes.json();
      initialCategories = json.data || [];
    }
    if (brandsRes.ok) {
      const json = await brandsRes.json();
      initialBrands = json.data || [];
    }
    if (prodsRes.ok) {
      const json = await prodsRes.json();
      initialProducts = json.data || [];
    }
  } catch (err) {
    console.error('Failed to load initial catalog data:', err);
  }

  return (
    <Suspense fallback={
      <div className="flex min-h-[50vh] items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-amber-600" />
      </div>
    }>
      <ProductsCatalogClient 
        initialProducts={initialProducts}
        initialCategories={initialCategories}
        initialBrands={initialBrands}
      />
    </Suspense>
  );
}
