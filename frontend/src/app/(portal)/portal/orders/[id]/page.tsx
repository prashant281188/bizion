'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ArrowLeft, Package, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { use } from 'react';

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  
  // Use the same query key as the main orders page to fetch from cache if available
  const { data: orders, isLoading } = useQuery({
    queryKey: ['portal', 'orders'],
    queryFn: async () => {
      const res = await api.get('/portal/orders');
      return res.data?.data || [];
    },
  });

  const { data: allInvoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['portal', 'invoices'],
    queryFn: async () => {
      const res = await api.get('/portal/invoices');
      return res.data?.data || [];
    },
  });

  const order = orders?.find((o: any) => o.id === unwrappedParams.id);
  const relatedInvoices = allInvoices?.filter((i: any) => i.orderId === unwrappedParams.id) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-zinc-900">Order not found</h2>
        <p className="text-zinc-500 mt-2 mb-6">The order you're looking for doesn't exist or you don't have access to it.</p>
        <Button onClick={() => router.push('/portal/orders')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push('/portal/orders')}
          className="rounded-full hover:bg-zinc-100"
        >
          <ArrowLeft className="h-5 w-5 text-zinc-600" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
            Order {order.orderNumber}
            <Badge 
              variant="outline" 
              className={`capitalize text-sm font-semibold border px-3 py-1 ${
                order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                order.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {order.status}
            </Badge>
          </h1>
          <p className="text-zinc-500 mt-1">Placed on {formatDate(order.orderDate)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 border-zinc-200/60 shadow-sm">
          <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-600" />
              Items Ordered
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {order.items && order.items.length > 0 ? (
              <div className="divide-y divide-zinc-100">
                {order.items.map((item: any) => (
                  <div key={item.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-zinc-50/50 transition-colors">
                    <div>
                      <h4 className="font-bold text-zinc-900 text-lg">{item.product?.name || 'Unknown Product'}</h4>
                      <p className="text-sm text-zinc-500 mt-1">SKU: {item.variant?.sku || 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Price</p>
                        <p className="font-medium text-zinc-900">{formatCurrency(Number(item.unitPrice))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Qty</p>
                        <p className="font-medium text-zinc-900">{item.orderQuantity}</p>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Taxable</p>
                        <p className="font-medium text-zinc-700">{formatCurrency(Number(item.taxableValue))}</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">+ {formatCurrency(Number(item.totalPrice) - Number(item.taxableValue))} tax</p>
                        <p className="font-bold text-amber-700 text-base mt-1 border-t border-zinc-100 pt-1">{formatCurrency(Number(item.totalPrice))}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500">
                No items found for this order.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-zinc-200/60 shadow-sm">
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-zinc-600" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {(() => {
                const taxableAmount = order.items?.reduce((s: number, i: any) => s + Number(i.taxableValue || 0), 0) || 0;
                const cgst = order.items?.reduce((s: number, i: any) => s + Number(i.cgstAmount || 0), 0) || 0;
                const sgst = order.items?.reduce((s: number, i: any) => s + Number(i.sgstAmount || 0), 0) || 0;
                const igst = order.items?.reduce((s: number, i: any) => s + Number(i.igstAmount || 0), 0) || 0;
                const totalTax = cgst + sgst + igst;
                return (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-600">Subtotal (Taxable)</span>
                      <span className="font-medium text-zinc-900">{formatCurrency(taxableAmount)}</span>
                    </div>
                    {cgst > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-500">CGST</span>
                        <span className="font-medium text-zinc-700">{formatCurrency(cgst)}</span>
                      </div>
                    )}
                    {sgst > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-500">SGST</span>
                        <span className="font-medium text-zinc-700">{formatCurrency(sgst)}</span>
                      </div>
                    )}
                    {igst > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-500">IGST</span>
                        <span className="font-medium text-zinc-700">{formatCurrency(igst)}</span>
                      </div>
                    )}
                    {totalTax > 0 && (
                      <div className="flex justify-between items-center text-sm border-t border-zinc-100 pt-3">
                        <span className="text-zinc-600 font-medium">Total Tax</span>
                        <span className="font-medium text-zinc-800">{formatCurrency(totalTax)}</span>
                      </div>
                    )}
                    <div className="pt-4 border-t border-zinc-100 flex justify-between items-center">
                      <span className="font-bold text-zinc-900">Total</span>
                      <span className="font-bold text-2xl text-amber-700">{formatCurrency(Number(order.totalAmount))}</span>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {relatedInvoices.length > 0 && (
            <Card className="border-zinc-200/60 shadow-sm">
              <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-indigo-600" />
                  Related Invoices
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-zinc-100">
                  {relatedInvoices.map((invoice: any) => (
                    <div 
                      key={invoice.id} 
                      className="p-4 flex justify-between items-center hover:bg-zinc-50/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/portal/invoices/${invoice.id}`)}
                    >
                      <div>
                        <p className="font-semibold text-zinc-900">{invoice.invoiceNumber}</p>
                        <p className="text-xs text-zinc-500 mt-1">{formatDate(invoice.invoiceDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-zinc-900">{formatCurrency(Number(invoice.totalAmount))}</p>
                        <Badge 
                          variant="outline" 
                          className={`mt-1 capitalize text-[10px] px-1.5 py-0 border ${
                            invoice.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            invoice.status === 'overdue' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {invoice.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
