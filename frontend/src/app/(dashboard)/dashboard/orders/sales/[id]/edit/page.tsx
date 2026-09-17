'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import OrderForm from '@/components/orders/OrderForm';
import { toast } from 'sonner';

export default function EditSalesOrderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.get(`/orders/${id}`)
        .then(res => {
          const data = res.data.data;
          if (!['draft', 'confirmed'].includes(data.status)) {
            toast.error('Only draft and confirmed orders can be edited');
            router.push(`/dashboard/orders/sales/${id}`);
          } else {
            setOrder(data);
          }
        })
        .catch(() => {
          toast.error('Failed to load order');
          router.push('/dashboard/orders/sales');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id, router]);

  if (loading) {
    return (
    <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 mb-6">Edit Sales Order</h1>
        <div className="animate-pulse flex flex-col gap-6">
          <div className="h-10 bg-zinc-100 rounded-lg" />
          <div className="h-40 bg-zinc-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="p-6 pb-0">
        <h1 className="text-2xl font-bold text-zinc-900">Edit Sales Order {order.orderNumber}</h1>
      </div>
      <OrderForm type="sales" isEdit={true} initialData={order} />
    </div>
  );
}
