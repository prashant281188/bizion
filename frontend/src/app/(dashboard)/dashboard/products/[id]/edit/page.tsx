'use client';

import { useEffect, useState, use } from 'react';
import api from '@/lib/api';
import type { Product } from '@/types';
import ProductFormPage from '../../form-page';
import { Skeleton } from '@/components/ui/skeleton';

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default function EditProductPage({ params }: EditProductPageProps) {
  const { id } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/products/${id}`);
        setProduct(res.data.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to retrieve product details');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) {
    return (
    <div className="space-y-6">
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-12">
        <p className="text-red-700 font-semibold">{error || 'Product not found'}</p>
      </div>
    );
  }

  return <ProductFormPage isEdit={true} initialProduct={product} />;
}
