'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { SearchableSelect, SelectOption } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { formatCurrency, formatVariantName } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LucideIndianRupee, 
  LucideShoppingBag, 
  LucideActivity,
  LucidePackage,
  LucideArrowUpRight,
  LucideArrowDownLeft,
  LucideWarehouse
} from 'lucide-react';

import { useSearchParams } from 'next/navigation';

export default function ProductAnalyticsPage() {
  const searchParams = useSearchParams();
  const [selectedProduct, setSelectedProduct] = useState('');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'purchases'>('overview');
  const [salesSearch, setSalesSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');

  useEffect(() => {
    const pid = searchParams.get('productId');
    if (pid) {
      setSelectedProduct(pid);
    }
  }, [searchParams]);

  const { data: productsData } = useQuery({
    queryKey: ['products', 'list-for-analytics'],
    queryFn: async () => {
      const res = await api.get('/products?limit=1000');
      const payload = res.data;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.data?.data)) return payload.data.data;
      if (Array.isArray(payload)) return payload;
      return [];
    },
  });

  const products: SelectOption[] = useMemo(() => {
    if (!Array.isArray(productsData)) return [];
    const options: SelectOption[] = [];

    productsData.forEach((p: any) => {
      const brandCat = [p.brandName || p.brand?.name, p.categoryName || p.category?.name]
        .filter(Boolean)
        .join(' • ');

      if (p.hasVariants && Array.isArray(p.variants) && p.variants.length > 0) {
        p.variants.forEach((v: any) => {
          const varSku = v.sku || p.sku;
          const subDetails = [varSku ? `SKU: ${varSku}` : null, brandCat].filter(Boolean).join(' | ');

          options.push({
            value: `${p.id}_${v.id}`,
            label: formatVariantName(p.name, v.name, v.sku),
            sublabel: subDetails || undefined,
            sku: varSku,
            imageUrl: v.imageUrl || p.images?.[0]?.url || undefined,
          });
        });
      } else {
        const subDetails = [p.sku ? `SKU: ${p.sku}` : null, brandCat].filter(Boolean).join(' | ');

        options.push({
          value: p.id as string,
          label: p.name as string,
          sublabel: subDetails || undefined,
          sku: p.sku,
          imageUrl: p.images?.[0]?.url || undefined,
        });
      }
    });

    return options;
  }, [productsData]);

  useEffect(() => {
    if (!selectedProduct) {
      setAnalyticsData(null);
      return;
    }

    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const [productId, variantId] = selectedProduct.split('_');
        const url = variantId 
          ? `/products/${productId}/analytics?variantId=${variantId}` 
          : `/products/${productId}/analytics`;
        const res = await api.get(url);
        setAnalyticsData(res.data?.data || res.data);
      } catch (err) {
        console.error('Failed to fetch product analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [selectedProduct]);

  const {
    data: globalAnalyticsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: globalLoading,
  } = useInfiniteQuery({
    queryKey: ['globalAnalytics'],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get('/products/overview/analytics', { params: { page: pageParam, limit: 20 } });
      return res.data?.data || res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !selectedProduct,
  });

  const globalAnalytics = useMemo(() => {
    if (!globalAnalyticsData) return null;
    return {
      topSold: globalAnalyticsData.pages.flatMap((page: any) => page.topSold || []),
      topUnsold: globalAnalyticsData.pages.flatMap((page: any) => page.topUnsold || []),
    };
  }, [globalAnalyticsData]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }
  };

  const filteredSales = (analyticsData?.salesHistory || []).filter((item: any) => {
    if (!salesSearch) return true;
    const q = salesSearch.toLowerCase();
    return (
      (item.contactName && item.contactName.toLowerCase().includes(q)) ||
      (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(q)) ||
      (item.variantName && item.variantName.toLowerCase().includes(q))
    );
  });

  const filteredPurchases = (analyticsData?.purchaseHistory || []).filter((item: any) => {
    if (!purchaseSearch) return true;
    const q = purchaseSearch.toLowerCase();
    return (
      (item.contactName && item.contactName.toLowerCase().includes(q)) ||
      (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(q)) ||
      (item.variantName && item.variantName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-50">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Product Analytics</h1>
          <p className="text-sm text-zinc-500 mt-1">Deep dive into individual product sales, purchases, and performance.</p>
        </div>
        <div className="w-full md:w-80 relative z-10">
          <SearchableSelect
            options={products}
            value={selectedProduct}
            onChange={setSelectedProduct}
            placeholder="Search & select a product..."
            className="bg-white/70 backdrop-blur-md rounded-xl shadow-sm border border-zinc-200/50"
          />
        </div>
      </div>

      {!selectedProduct && (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-10 bg-white/50 backdrop-blur-xl border border-zinc-100 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
            <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <LucidePackage className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold text-zinc-800">Global Product Overview</h3>
            <p className="text-zinc-500 max-w-md text-center mt-2">
              Select a specific product above for detailed analytics, or view the overall top performers below.
            </p>
          </div>

          {globalLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
               <div className="h-64 bg-zinc-200/50 rounded-2xl"></div>
               <div className="h-64 bg-zinc-200/50 rounded-2xl"></div>
            </div>
          ) : globalAnalytics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Sold */}
              <Card className="bg-white rounded-xl shadow-sm border border-zinc-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                      <LucideArrowUpRight className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-lg font-bold text-zinc-900">Top Most Sold Items</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar" onScroll={handleScroll}>
                  {globalAnalytics.topSold?.length > 0 ? (
                    globalAnalytics.topSold.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 hover:bg-zinc-50 rounded-xl transition-colors border border-transparent hover:border-zinc-100">
                        <span className="font-medium text-zinc-800 truncate">
                          {item.variantName || item.productName}
                        </span>
                        <span className="text-amber-600 font-semibold bg-amber-50 px-2.5 py-1 rounded-md text-sm">{item.totalQuantitySold} Sold</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-500 text-sm">No sales data available yet.</p>
                  )}
                  </div>
                </CardContent>
              </Card>

              {/* Top Unsold (Available) */}
              <Card className="bg-white rounded-xl shadow-sm border border-zinc-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
                      <LucideWarehouse className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-lg font-bold text-zinc-900">Top Unsold Items (Highest Stock)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar" onScroll={handleScroll}>
                  {globalAnalytics.topUnsold?.length > 0 ? (
                    globalAnalytics.topUnsold.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 hover:bg-zinc-50 rounded-xl transition-colors border border-transparent hover:border-zinc-100">
                        <span className="font-medium text-zinc-800 truncate">
                          {item.variantName || item.productName}
                        </span>
                        <div className="flex flex-col items-end">
                          <span className="text-rose-600 font-semibold bg-rose-50 px-2.5 py-1 rounded-md text-sm mb-1">{item.totalAvailableQty} in Stock</span>
                          {item.totalStockValue > 0 && (
                            <span className="text-xs text-zinc-500 font-medium">Value: {formatCurrency(item.totalStockValue)}</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-500 text-sm">No inventory data available yet.</p>
                  )}
                  {isFetchingNextPage && (
                    <div className="py-2 text-center text-sm text-zinc-500 animate-pulse">Loading more...</div>
                  )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {loading && selectedProduct && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 bg-zinc-200/50 rounded-2xl"></div>
          ))}
        </div>
      )}

      {!loading && analyticsData && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              title="Total Quantity Sold"
              value={Number(analyticsData.insights?.totalQuantitySold || 0).toLocaleString('en-IN')}
              icon={<LucideShoppingBag className="w-5 h-5" />}
              trend="Outbound"
              gradient="from-amber-500 to-amber-700"
            />
            <StatCard
              title="Total Sales Amount"
              value={formatCurrency(analyticsData.insights?.totalAmountSold || 0)}
              icon={<LucideIndianRupee className="w-5 h-5" />}
              trend="Revenue"
              gradient="from-teal-500 to-teal-700"
            />
            <StatCard
              title="Total Quantity Bought"
              value={Number(analyticsData.insights?.totalQuantityBought || 0).toLocaleString('en-IN')}
              icon={<LucideArrowDownLeft className="w-5 h-5" />}
              trend="Inbound"
              gradient="from-rose-500 to-rose-700"
            />
            <StatCard
              title="Total Purchase Amount"
              value={formatCurrency(analyticsData.insights?.totalAmountBought || 0)}
              icon={<LucideIndianRupee className="w-5 h-5" />}
              trend="Cost"
              gradient="from-pink-500 to-pink-700"
            />
            <StatCard
              title="Current Stock"
              value={Number(analyticsData.insights?.currentStock || 0).toLocaleString('en-IN')}
              icon={<LucideWarehouse className="w-5 h-5" />}
              trend="Inventory"
              gradient="from-amber-500 to-amber-700"
            />
            <StatCard
              title="Current Stock Value"
              value={formatCurrency(analyticsData.insights?.currentStockValue || 0)}
              icon={<LucideIndianRupee className="w-5 h-5" />}
              trend="Valuation"
              gradient="from-amber-500 to-amber-700"
            />
          </div>

          {/* Tabs */}
          <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
            <div className="flex overflow-x-auto border-b border-zinc-100 p-2 gap-2">
              <TabButton
                active={activeTab === 'overview'}
                onClick={() => setActiveTab('overview')}
                icon={<LucideActivity className="w-4 h-4" />}
                label="Overview"
              />
              <TabButton
                active={activeTab === 'sales'}
                onClick={() => setActiveTab('sales')}
                icon={<LucideArrowUpRight className="w-4 h-4" />}
                label="Sales History"
              />
              <TabButton
                active={activeTab === 'purchases'}
                onClick={() => setActiveTab('purchases')}
                icon={<LucideArrowDownLeft className="w-4 h-4" />}
                label="Purchase History"
              />
            </div>

            <div className="p-6 bg-white/40">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 gap-6">
                  <Card className="bg-white rounded-xl shadow-sm border border-zinc-200">
                    <CardContent className="p-6 flex flex-col md:flex-row gap-6">
                    {analyticsData.product.imageUrl ? (
                      <div className="flex-shrink-0 w-32 h-32 rounded-xl overflow-hidden border border-zinc-100 bg-zinc-50">
                        <img 
                          src={analyticsData.product.imageUrl} 
                          alt={analyticsData.product.name} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-32 h-32 rounded-xl border border-zinc-100 bg-zinc-50 flex flex-col items-center justify-center text-zinc-500">
                        <LucidePackage className="w-10 h-10 mb-2 opacity-50" />
                        <span className="text-xs font-medium">No Image</span>
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-zinc-800 mb-4 text-lg">Product Information</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        <div>
                          <p className="text-sm text-zinc-500">Name</p>
                          <p className="font-medium text-zinc-900">{analyticsData.product.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500">SKU</p>
                          <p className="font-medium text-zinc-900">{analyticsData.product.sku || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500">Purchase Mode</p>
                          <p className="font-medium text-zinc-900 capitalize">{analyticsData.product.purchaseMode || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500">Selling Price</p>
                          <p className="font-medium text-zinc-900">{formatCurrency(analyticsData.pricing?.sellingPrice || 0)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500">Purchase / Cost Price</p>
                          <p className="font-medium text-zinc-900">{formatCurrency(analyticsData.pricing?.costPrice || 0)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500">List Price</p>
                          <p className="font-medium text-zinc-900">{formatCurrency(analyticsData.pricing?.listPrice || 0)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500">MRP</p>
                          <p className="font-medium text-zinc-900">{formatCurrency(analyticsData.pricing?.mrp || 0)}</p>
                        </div>
                      </div>
                    </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'sales' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white/70 p-4 rounded-xl shadow-sm border border-zinc-100 gap-4">
                    <h3 className="font-semibold text-zinc-800">Sales History</h3>
                    <div className="relative w-full sm:w-64">
                      <Input 
                        type="text" 
                        placeholder="Search customer, invoice..." 
                        className="pl-9 bg-white/80"
                        value={salesSearch}
                        onChange={(e) => setSalesSearch(e.target.value)}
                      />
                      <LucidePackage className="w-4 h-4 absolute left-3 top-3 text-zinc-500 z-10" />
                    </div>
                  </div>

                  <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 border overflow-hidden">
                    <CardContent className="p-0 overflow-x-auto">
                      <Table className="min-w-full text-left text-sm text-zinc-600">
                        <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                          <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                            <TableHead className="px-4 py-3">Date</TableHead>
                            <TableHead className="px-4 py-3">Customer</TableHead>
                            <TableHead className="px-4 py-3">Invoice #</TableHead>
                            <TableHead className="px-4 py-3">Variant</TableHead>
                            <TableHead className="px-4 py-3 text-right">Quantity</TableHead>
                            <TableHead className="px-4 py-3 text-right">Rate</TableHead>
                            <TableHead className="px-4 py-3 text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-zinc-100">
                          {filteredSales.map((item: any) => (
                            <TableRow key={item.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell className="px-4 py-3 whitespace-nowrap text-zinc-500">{new Date(item.invoiceDate).toLocaleDateString()}</TableCell>
                              <TableCell className="px-4 py-3 font-medium text-zinc-900">{item.contactName || item.contactCompany || '-'}</TableCell>
                              <TableCell className="px-4 py-3 text-zinc-600">{item.invoiceNumber}</TableCell>
                              <TableCell className="px-4 py-3 text-zinc-500">{item.variantName || '-'}</TableCell>
                              <TableCell className="px-4 py-3 text-right font-medium text-zinc-700">{Number(item.quantity || 0).toLocaleString('en-IN')}</TableCell>
                              <TableCell className="px-4 py-3 text-right text-zinc-700">{formatCurrency(item.unitPrice || 0)}</TableCell>
                              <TableCell className="px-4 py-3 text-right font-semibold text-zinc-900">{formatCurrency(item.totalAmount || 0)}</TableCell>
                            </TableRow>
                          ))}
                          {filteredSales.length === 0 && (
                            <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell colSpan={7} className="px-4 py-3 text-center text-zinc-500 font-medium">
                                No sales history found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'purchases' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white/70 p-4 rounded-xl shadow-sm border border-zinc-100 gap-4">
                    <h3 className="font-semibold text-zinc-800">Purchase History</h3>
                    <div className="relative w-full sm:w-64">
                      <Input 
                        type="text" 
                        placeholder="Search vendor, invoice..." 
                        className="pl-9 bg-white/80"
                        value={purchaseSearch}
                        onChange={(e) => setPurchaseSearch(e.target.value)}
                      />
                      <LucideWarehouse className="w-4 h-4 absolute left-3 top-3 text-zinc-500 z-10" />
                    </div>
                  </div>

                  <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 border overflow-hidden">
                    <CardContent className="p-0 overflow-x-auto">
                      <Table className="min-w-full text-left text-sm text-zinc-600">
                        <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                          <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                            <TableHead className="px-4 py-3">Date</TableHead>
                            <TableHead className="px-4 py-3">Vendor</TableHead>
                            <TableHead className="px-4 py-3">Invoice #</TableHead>
                            <TableHead className="px-4 py-3">Variant</TableHead>
                            <TableHead className="px-4 py-3 text-right">Quantity</TableHead>
                            <TableHead className="px-4 py-3 text-right">Rate</TableHead>
                            <TableHead className="px-4 py-3 text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-zinc-100">
                          {filteredPurchases.map((item: any) => (
                            <TableRow key={item.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell className="px-4 py-3 whitespace-nowrap text-zinc-500">{new Date(item.invoiceDate).toLocaleDateString()}</TableCell>
                              <TableCell className="px-4 py-3 font-medium text-zinc-900">{item.contactName || item.contactCompany || '-'}</TableCell>
                              <TableCell className="px-4 py-3 text-zinc-600">{item.invoiceNumber}</TableCell>
                              <TableCell className="px-4 py-3 text-zinc-500">{item.variantName || '-'}</TableCell>
                              <TableCell className="px-4 py-3 text-right font-medium text-zinc-700">{Number(item.quantity || 0).toLocaleString('en-IN')}</TableCell>
                              <TableCell className="px-4 py-3 text-right text-zinc-700">{formatCurrency(item.unitPrice || 0)}</TableCell>
                              <TableCell className="px-4 py-3 text-right font-semibold text-zinc-900">{formatCurrency(item.totalAmount || 0)}</TableCell>
                            </TableRow>
                          ))}
                          {filteredPurchases.length === 0 && (
                            <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell colSpan={7} className="px-4 py-3 text-center text-zinc-500 font-medium">
                                No purchase history found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, trend, gradient }: { title: string, value: string | number, icon: React.ReactNode, trend?: string, gradient: string }) {
  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-5 space-y-1 hover:shadow-md transition-all">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{title}</span>
        <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/80">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold font-mono text-zinc-900">{value}</div>
      {trend && <p className="text-xs font-medium text-zinc-500 font-mono">{trend}</p>}
    </Card>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
        active 
          ? "bg-amber-600 text-white shadow-sm" 
          : "text-zinc-600 hover:bg-zinc-100 border border-zinc-200/80 bg-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
