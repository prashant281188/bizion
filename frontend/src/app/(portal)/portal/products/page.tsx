'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable } from '@/components/ui/data-table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Package, History, ShoppingCart, TrendingUp } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

export default function PortalProductsPage() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['portal', 'products'],
    queryFn: async () => {
      const res = await api.get('/portal/products');
      return res.data?.data || [];
    },
  });

  // Calculate metrics
  const totalProducts = products?.length || 0;
  
  let totalUnits = 0;
  let totalSpend = 0;
  
  products?.forEach((p: any) => {
    p.priceHistory?.forEach((historyItem: any) => {
      totalUnits += historyItem.quantity || 0;
      totalSpend += (historyItem.price || 0) * (historyItem.quantity || 0);
    });
  });
  
  const avgPrice = totalUnits > 0 ? totalSpend / totalUnits : 0;

  return (
    <div className="space-y-8 pb-10">
      {/* Custom Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-indigo-50/80 border border-indigo-100/50 px-8 py-10 text-zinc-900 shadow-sm">
        <div className="absolute top-0 left-0 h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Order History & Pricing</h1>
            <p className="text-zinc-600 max-w-xl">
              Review the products you've previously purchased and track price changes over time.
            </p>
          </div>
          <div className="hidden sm:block p-4 bg-indigo-100/50 rounded-full">
            <History className="h-10 w-10 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Unique Items Billed</p>
              <h3 className="text-2xl font-bold text-zinc-900">{totalProducts}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Units Purchased</p>
              <h3 className="text-2xl font-bold text-zinc-900">{totalUnits}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Avg. Purchase Price</p>
              <h3 className="text-2xl font-bold text-zinc-900">{formatCurrency(avgPrice)}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main DataTable */}
      <DataTable
          isLoading={isLoading}
          isEmpty={!products || products.length === 0}
          headers={[
            { key: 'sku', label: 'SKU' },
            { key: 'name', label: 'Product Name' },
            { key: 'lastPurchased', label: 'Last Purchased' },
            { key: 'finalPrice', label: 'Last Billed Rate', align: 'right' },
            { key: 'history', label: 'Price History', align: 'center' },
          ]}
        >
          <>
            {products?.map((product: any) => {
              const finalPrice = Number(product.finalPrice || 0);
              const history = product.priceHistory || [];
              const lastPurchasedDate = history.length > 0 ? history[0].date : null;

              return (
                <TableRow key={product.variantId || product.productId} className="hover:bg-zinc-50/50 transition-colors border-zinc-100">
                  <TableCell className="font-semibold text-indigo-700">{product.sku}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden bg-zinc-100 border border-zinc-200">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400">
                          <Package className="h-5 w-5" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-800">{product.name}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-500 font-medium">
                    {lastPurchasedDate ? formatDate(lastPurchasedDate) : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-bold text-zinc-900 text-lg">
                      {formatCurrency(finalPrice)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Popover>
                      <PopoverTrigger className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer">
                        <History className="h-3.5 w-3.5" />
                        View History
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0 rounded-xl overflow-hidden shadow-xl" align="end">
                        <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
                          <h4 className="font-semibold text-indigo-900 text-sm">Purchase History</h4>
                          <p className="text-xs text-indigo-600/80 mt-0.5 truncate">{product.name}</p>
                        </div>
                        <div className="h-[250px] w-full overflow-y-auto">
                          <div className="p-3">
                            {history.length > 0 ? (
                              <div className="space-y-3">
                                {history.map((h: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-center text-sm border-b border-zinc-100 last:border-0 pb-3 last:pb-0">
                                    <div>
                                      <p className="font-medium text-zinc-900">{formatCurrency(h.price)} <span className="text-xs font-normal text-zinc-500">x {h.quantity}</span></p>
                                      <p className="text-xs text-zinc-500 mt-0.5">{h.invoiceNumber}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs font-medium text-zinc-700">{formatDate(h.date)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-zinc-500 text-center py-4">No history available</p>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                </TableRow>
              );
            })}
          </>
        </DataTable>
    </div>
  );
}
