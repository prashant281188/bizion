'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ArrowLeft, Package, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { use } from 'react';

export default function InvoiceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  
  // Use the same query key as the main invoices page to fetch from cache if available
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['portal', 'invoices'],
    queryFn: async () => {
      const res = await api.get('/portal/invoices');
      return res.data?.data || [];
    },
  });

  const invoice = invoices?.find((i: any) => i.id === unwrappedParams.id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-zinc-900">Invoice not found</h2>
        <p className="text-zinc-500 mt-2 mb-6">The invoice you're looking for doesn't exist or you don't have access to it.</p>
        <Button onClick={() => router.push('/portal/invoices')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices
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
          onClick={() => router.push('/portal/invoices')}
          className="rounded-full hover:bg-zinc-100"
        >
          <ArrowLeft className="h-5 w-5 text-zinc-600" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
            Invoice {invoice.invoiceNumber}
            <Badge 
              variant="outline" 
              className={`capitalize text-sm font-semibold border px-3 py-1 ${
                invoice.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                invoice.status === 'overdue' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                invoice.status === 'void' ? 'bg-zinc-100 text-zinc-700 border-zinc-300' :
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {invoice.status}
            </Badge>
          </h1>
          <p className="text-zinc-500 mt-1">Date: {formatDate(invoice.invoiceDate)}{invoice.dueDate && ` • Due: ${formatDate(invoice.dueDate)}`}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 border-zinc-200/60 shadow-sm">
          <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-slate-600" />
              Billed Items
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {invoice.lineItems && invoice.lineItems.length > 0 ? (
              <div className="divide-y divide-zinc-100">
                {invoice.lineItems.map((item: any) => (
                  <div key={item.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-zinc-50/50 transition-colors">
                    <div>
                      <h4 className="font-bold text-zinc-900 text-lg">{item.product?.name || item.description || 'Unknown Product'}</h4>
                      <p className="text-sm text-zinc-500 mt-1">SKU: {item.variant?.sku || 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Rate</p>
                        <p className="font-medium text-zinc-900">{formatCurrency(Number(item.unitPrice))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Qty</p>
                        <p className="font-medium text-zinc-900">{item.quantity}</p>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Taxable</p>
                        <p className="font-medium text-zinc-700">{formatCurrency(Number(item.taxableValue))}</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">+ {formatCurrency(Number(item.totalAmount) - Number(item.taxableValue))} tax</p>
                        <p className="font-bold text-slate-800 text-base mt-1 border-t border-zinc-100 pt-1">{formatCurrency(Number(item.totalAmount))}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500">
                No items found for this invoice.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-zinc-200/60 shadow-sm">
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-slate-600" />
                Invoice Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-600">Subtotal (Taxable)</span>
                <span className="font-medium text-zinc-900">{formatCurrency(Number(invoice.taxableAmount || invoice.subtotal || 0))}</span>
              </div>
              {Number(invoice.discountAmount) > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Discount</span>
                  <span className="font-medium text-red-600">- {formatCurrency(Number(invoice.discountAmount))}</span>
                </div>
              )}
              {Number(invoice.cgstAmount) > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">CGST</span>
                  <span className="font-medium text-zinc-700">{formatCurrency(Number(invoice.cgstAmount))}</span>
                </div>
              )}
              {Number(invoice.sgstAmount) > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">SGST</span>
                  <span className="font-medium text-zinc-700">{formatCurrency(Number(invoice.sgstAmount))}</span>
                </div>
              )}
              {Number(invoice.igstAmount) > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">IGST</span>
                  <span className="font-medium text-zinc-700">{formatCurrency(Number(invoice.igstAmount))}</span>
                </div>
              )}
              {Number(invoice.totalTaxAmount) > 0 && (
                <div className="flex justify-between items-center text-sm border-t border-zinc-100 pt-3">
                  <span className="text-zinc-600 font-medium">Total Tax</span>
                  <span className="font-medium text-zinc-800">{formatCurrency(Number(invoice.totalTaxAmount))}</span>
                </div>
              )}
              <div className="pt-4 border-t border-zinc-100 flex justify-between items-center">
                <span className="font-bold text-zinc-900">Total Billed</span>
                <span className="font-bold text-xl text-slate-800">{formatCurrency(Number(invoice.totalAmount))}</span>
              </div>
              <div className="pt-4 border-t border-zinc-100 flex justify-between items-center bg-rose-50/50 p-3 -mx-3 rounded-lg border border-rose-100">
                <span className="font-bold text-rose-900">Balance Due</span>
                <span className="font-bold text-xl text-rose-700">{formatCurrency(Number(invoice.balanceDue))}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
