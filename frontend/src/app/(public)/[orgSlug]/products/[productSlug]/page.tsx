import React from 'react';
import { Metadata } from 'next';
import { ProductDetailClient } from '../../_components/product-detail-client';

export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string, productSlug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const { orgSlug, productSlug } = resolvedParams;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  
  try {
    const res = await fetch(`${baseUrl}/products/public/${orgSlug}/products/${productSlug}`, { cache: 'no-store' });
    if (!res.ok) return { title: 'Product Not Found' };
    const json = await res.json();
    const product = json.data;

    const primaryImg = product.images?.find((img: any) => img.isPrimary) || product.images?.[0];

    return {
      title: `${product.name} | Bizion Storefront`,
      description: product.shortDescription || product.description || `Buy ${product.name} from our storefront.`,
      openGraph: {
        title: product.name,
        description: product.shortDescription || product.description || `Buy ${product.name} from our storefront.`,
        images: primaryImg ? [{ url: primaryImg.url }] : [],
      }
    };
  } catch (error) {
    return { title: 'Product' };
  }
}

export default async function StorefrontProductDetailPage({ params }: { params: Promise<{ orgSlug: string, productSlug: string }> }) {
  const resolvedParams = await params;
  const { orgSlug, productSlug } = resolvedParams;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  let product = null;

  try {
    const res = await fetch(`${baseUrl}/products/public/${orgSlug}/products/${productSlug}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      product = json.data;
    }
  } catch (err) {
    console.error('Failed to load product details:', err);
  }

  return <ProductDetailClient product={product} />;
}
