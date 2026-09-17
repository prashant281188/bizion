import React from 'react';
import OrderForm from '@/components/orders/OrderForm';

export default function NewPurchaseOrderPage() {
  return (
    <div className="space-y-6">
      <div className="p-6 border-b border-zinc-200">
        <h2 className="text-lg font-semibold text-zinc-900">Create New Purchase Order</h2>
        <p className="text-sm text-zinc-500 mt-1">Place an order to restock from a supplier.</p>
      </div>
      <OrderForm type="purchase" />
    </div>
  );
}
