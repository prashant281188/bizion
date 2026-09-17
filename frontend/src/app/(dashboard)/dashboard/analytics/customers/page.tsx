'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SearchableSelect, SelectOption } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  LucideTrendingUp, 
  LucideIndianRupee, 
  LucideCreditCard, 
  LucideShoppingBag, 
  LucideActivity,
  LucidePackage,
  LucideFileText,
  LucideSearch
} from 'lucide-react';

import { useSearchParams } from 'next/navigation';

export default function CustomerAnalyticsPage() {
  const searchParams = useSearchParams();
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'products' | 'payments'>('overview');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const cid = searchParams.get('customerId');
    if (cid) {
      setSelectedCustomer(cid);
    }
  }, [searchParams]);

  const { data: customersData } = useQuery({
    queryKey: ['customers', 'list'],
    queryFn: async () => {
      const res = await api.get('/contacts?limit=1000');
      const payload = res.data;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.data?.data)) return payload.data.data;
      if (Array.isArray(payload)) return payload;
      return [];
    }
  });

  const customers: SelectOption[] = useMemo(() => {
    if (!Array.isArray(customersData)) return [];
    return customersData
      .filter((c: any) => c.type !== 'vendor')
      .map((c: any) => {
        const name = c.displayName || c.name || c.companyName || 'Unnamed Contact';
        const subDetails = [c.companyName && c.companyName !== name ? c.companyName : null, c.mobile || c.phone, c.gstin]
          .filter(Boolean)
          .join(' • ');

        return {
          value: (c.id || c._id) as string,
          label: name,
          sublabel: subDetails || c.email || undefined,
        };
      });
  }, [customersData]);

  const { data: analyticsData, isLoading: loading } = useQuery({
    queryKey: ['customer-analytics', selectedCustomer],
    queryFn: async () => {
      const res = await api.get(`/contacts/${selectedCustomer}/analytics`);
      return res.data?.data || res.data;
    },
    enabled: !!selectedCustomer
  });

  const groupedProducts = useMemo(() => {
    if (!analyticsData?.productHistory) return [];
    
    const groups: Record<string, any> = {};
    
    analyticsData.productHistory.forEach((item: any) => {
      const key = `${item.productName}_${item.variantName || 'base'}`;
      
      if (!groups[key]) {
        groups[key] = {
          key,
          productName: item.productName,
          variantName: item.variantName,
          totalQuantity: 0,
          totalAmount: 0,
          history: []
        };
      }
      
      groups[key].totalQuantity += Number(item.quantity || 0);
      groups[key].totalAmount += Number(item.total || 0);
      groups[key].history.push(item);
    });
    
    Object.values(groups).forEach((g: any) => {
      g.history.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      g.latestRate = g.history[0]?.rate || 0;
    });
    
    let result = Object.values(groups);
    
    if (productSearch) {
      const q = productSearch.toLowerCase();
      result = result.filter((g: any) => 
        g.productName.toLowerCase().includes(q) || 
        (g.variantName && g.variantName.toLowerCase().includes(q))
      );
    }
    
    result.sort((a: any, b: any) => a.productName.localeCompare(b.productName));
    return result;
  }, [analyticsData?.productHistory, productSearch]);

  const filteredLedger = useMemo(() => {
    if (!analyticsData?.ledger) return { entries: [], totalDebit: 0, totalCredit: 0 };
    
    let entries = [...analyticsData.ledger];
    
    if (ledgerSearch) {
      const q = ledgerSearch.toLowerCase();
      entries = entries.filter((e: any) => 
        (e.description && e.description.toLowerCase().includes(q)) || 
        (e.transactionNumber && e.transactionNumber.toLowerCase().includes(q))
      );
    }
    
    // Sort descending by date
    entries.sort((a: any, b: any) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff === 0 && a.id && b.id) {
        // Fallback to sort by ID if same date to maintain stable order
        return b.id.localeCompare(a.id);
      }
      return dateDiff;
    });
    
    let totalDebit = 0;
    let totalCredit = 0;
    entries.forEach((e: any) => {
      if (e.entryType === 'debit') totalDebit += Number(e.amount || 0);
      if (e.entryType === 'credit') totalCredit += Number(e.amount || 0);
    });
    
    return { entries, totalDebit, totalCredit };
  }, [analyticsData?.ledger, ledgerSearch]);

  const toggleExpand = (key: string) => {
    setExpandedProducts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-50">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Customer Analytics</h1>
          <p className="text-sm text-zinc-500 mt-1">Deep dive into individual customer insights, behavior, and ledger.</p>
        </div>
        <div className="w-full md:w-80 relative z-10">
          <SearchableSelect
            options={customers}
            value={selectedCustomer}
            onChange={setSelectedCustomer}
            placeholder="Search & select a customer..."
            className="bg-white/70 backdrop-blur-md rounded-xl shadow-sm border border-zinc-200/50"
          />
        </div>
      </div>

      {!selectedCustomer && (
        <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 flex flex-col items-center justify-center py-20 text-center">
          <CardContent className="flex flex-col items-center">
            <div className="h-24 w-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <LucideActivity className="w-10 h-10 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold text-zinc-800">No Customer Selected</h3>
            <p className="text-zinc-500 max-w-md text-center mt-2">
              Select a customer from the dropdown above to view their purchasing patterns, financial ledger, and detailed analytics.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && selectedCustomer && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-zinc-200/50 rounded-2xl"></div>
          ))}
        </div>
      )}

      {!loading && analyticsData && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard
              title="Total Billed"
              value={formatCurrency(analyticsData.insights?.totalBilled || 0)}
              icon={<LucideIndianRupee className="w-5 h-5" />}
              trend="Lifetime Value"
              gradient="from-amber-500 to-amber-700"
            />
            <KpiCard
              title="Total Paid"
              value={formatCurrency(analyticsData.insights?.totalPaid || 0)}
              icon={<LucideCreditCard className="w-5 h-5" />}
              trend="Received amount"
              gradient="from-amber-500 to-teal-600"
            />
            <KpiCard
              title="Balance Due"
              value={formatCurrency(analyticsData.insights?.balanceDue || 0)}
              icon={<LucideTrendingUp className="w-5 h-5" />}
              trend={analyticsData.insights?.balanceDue > 0 ? "Pending" : "Cleared"}
              gradient={analyticsData.insights?.balanceDue > 0 ? "from-rose-500 to-pink-600" : "from-zinc-400 to-zinc-600"}
            />
            <KpiCard
              title="Avg. Order Value"
              value={formatCurrency(analyticsData.insights?.avgOrderValue || 0)}
              icon={<LucideShoppingBag className="w-5 h-5" />}
              trend={`${analyticsData.insights?.totalInvoices || 0} Invoices`}
              gradient="from-amber-500 to-blue-600"
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
                active={activeTab === 'ledger'}
                onClick={() => setActiveTab('ledger')}
                icon={<LucideFileText className="w-4 h-4" />}
                label="Ledger"
              />
              <TabButton
                active={activeTab === 'products'}
                onClick={() => setActiveTab('products')}
                icon={<LucidePackage className="w-4 h-4" />}
                label="Product History"
              />
              <TabButton
                active={activeTab === 'payments'}
                onClick={() => setActiveTab('payments')}
                icon={<LucideCreditCard className="w-4 h-4" />}
                label="Payments"
              />
            </div>

            <div className="p-6 bg-white/40">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Orders */}
                  <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 border overflow-hidden">
                    <CardHeader className="px-6 py-4 border-b">
                      <CardTitle className="text-lg">Recent Orders</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table className="min-w-full text-left text-sm text-zinc-600">
                          <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                          <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                            <TableHead className="px-4 py-3">Order #</TableHead>
                            <TableHead className="px-4 py-3">Date</TableHead>
                            <TableHead className="px-4 py-3 text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-zinc-100">
                          {analyticsData.orders?.map((order: any) => (
                            <TableRow key={order.id as string} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell className="px-4 py-3 font-medium text-zinc-900">{order.orderNumber as string}</TableCell>
                              <TableCell className="px-4 py-3 text-zinc-500">{new Date(order.createdAt as string).toLocaleDateString()}</TableCell>
                              <TableCell className="px-4 py-3 text-right font-medium">₹{Number(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                          ))}
                          {(!analyticsData.orders || analyticsData.orders.length === 0) && (
                            <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell colSpan={3} className="px-4 py-3 text-center text-zinc-500">No orders found.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Invoices */}
                  <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 border overflow-hidden">
                    <CardHeader className="px-6 py-4 border-b">
                      <CardTitle className="text-lg">Recent Invoices</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table className="min-w-full text-left text-sm text-zinc-600">
                          <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                          <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                            <TableHead className="px-4 py-3">Invoice #</TableHead>
                            <TableHead className="px-4 py-3">Date</TableHead>
                            <TableHead className="px-4 py-3 text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-zinc-100">
                          {analyticsData.invoices?.map((invoice: any) => (
                            <TableRow key={invoice.id as string} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell className="px-4 py-3 font-medium text-zinc-900">{invoice.invoiceNumber as string}</TableCell>
                              <TableCell className="px-4 py-3 text-zinc-500">{new Date(invoice.invoiceDate as string).toLocaleDateString()}</TableCell>
                              <TableCell className="px-4 py-3 text-right font-medium">₹{Number(invoice.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                          ))}
                          {(!analyticsData.invoices || analyticsData.invoices.length === 0) && (
                            <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell colSpan={3} className="px-4 py-3 text-center text-zinc-500">No invoices found.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'ledger' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white/70 p-4 rounded-xl shadow-sm border border-zinc-100 gap-4">
                    <div className="flex flex-col">
                      <h3 className="font-semibold text-zinc-800">Financial Ledger</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm">
                        <span className="text-amber-600 font-medium">Total Debit: ₹{Number(filteredLedger.totalDebit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="text-rose-600 font-medium">Total Credit: ₹{Number(filteredLedger.totalCredit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Input 
                        type="text" 
                        placeholder="Search description or reference..." 
                        className="pl-9 bg-white/80"
                        value={ledgerSearch}
                        onChange={(e) => setLedgerSearch(e.target.value)}
                      />
                      <svg className="w-4 h-4 absolute left-3 top-3 text-zinc-500 z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>

                  <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 border overflow-hidden">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                      <Table className="min-w-full text-left text-sm text-zinc-600">
                        <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                          <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                            <TableHead className="px-4 py-3">Date</TableHead>
                            <TableHead className="px-4 py-3">Description</TableHead>
                            <TableHead className="px-4 py-3 text-right">Debit</TableHead>
                            <TableHead className="px-4 py-3 text-right">Credit</TableHead>
                            <TableHead className="px-4 py-3 text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-zinc-100">
                          {filteredLedger.entries.map((entry: any) => (
                            <TableRow key={entry.id as string} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell className="px-4 py-3 whitespace-nowrap text-zinc-500">{new Date(entry.date as string).toLocaleDateString()}</TableCell>
                              <TableCell className="px-4 py-3 text-zinc-900">
                                <span className="font-medium block">{entry.description as string}</span>
                                <span className="text-xs text-zinc-500">{entry.transactionNumber as string}</span>
                              </TableCell>
                              <TableCell className="px-4 py-3 whitespace-nowrap text-right text-amber-600 font-medium">
                                {entry.entryType === 'debit' ? `₹${Number(entry.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                              </TableCell>
                              <TableCell className="px-4 py-3 whitespace-nowrap text-right text-rose-600 font-medium">
                            {entry.entryType === 'credit' ? `₹${Number(entry.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                          </TableCell>
                          <TableCell className="px-4 py-3 whitespace-nowrap text-right font-semibold text-zinc-900">
                            ₹{Number(entry.runningBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                          ))}
                          {filteredLedger.entries.length === 0 && (
                            <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell colSpan={5} className="px-4 py-3 flex flex-col items-center justify-center text-center">
                                <LucideFileText className="w-8 h-8 text-zinc-700 mb-3" />
                                <p className="text-zinc-500 font-medium">
                                  {ledgerSearch ? 'No ledger entries match your search.' : 'No ledger entries found.'}
                                </p>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'products' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white/70 p-4 rounded-xl shadow-sm border border-zinc-100 gap-4">
                    <h3 className="font-semibold text-zinc-800">Purchased Products</h3>
                    <div className="relative w-full sm:w-64">
                      <Input 
                        type="text" 
                        placeholder="Search products..." 
                        className="pl-9 bg-white/80"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                      />
                      <LucideSearch className="w-4 h-4 absolute left-3 top-3 text-zinc-500 z-10" />
                    </div>
                  </div>

                  <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 border overflow-hidden">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                      <Table className="min-w-full text-left text-sm text-zinc-600">
                        <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                          <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                            <TableHead className="px-4 py-3 w-10"></TableHead>
                            <TableHead className="px-4 py-3">Product Name</TableHead>
                            <TableHead className="px-4 py-3 text-right">Latest Rate</TableHead>
                            <TableHead className="px-4 py-3 text-right">Total Quantity</TableHead>
                            <TableHead className="px-4 py-3 text-right">Total Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-zinc-100">
                          {groupedProducts.map((group: any) => (
                            <React.Fragment key={group.key}>
                              <TableRow 
                                className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50" 
                                onClick={() => toggleExpand(group.key)}
                              >
                                <TableCell className="px-4 py-3 text-zinc-500">
                                  <svg className={`w-4 h-4 transition-transform duration-200 group-hover:text-amber-500 ${expandedProducts[group.key] ? 'rotate-90 text-amber-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </TableCell>
                                <TableCell className="px-4 py-3 font-medium text-zinc-900">
                                  {group.productName}
                                  {group.variantName && <span className="text-xs text-zinc-500 ml-2 px-1.5 py-0.5 bg-zinc-100 rounded">({group.variantName})</span>}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-right font-medium text-zinc-700">₹{Number(group.latestRate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell className="px-4 py-3 text-right font-medium text-zinc-700">{Number(group.totalQuantity).toLocaleString('en-IN')}</TableCell>
                                <TableCell className="px-4 py-3 text-right font-semibold text-zinc-900">₹{Number(group.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              </TableRow>
                              {expandedProducts[group.key] && (
                                <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                                  <TableCell className="px-4 py-3"></TableCell>
                                  <TableCell colSpan={4} className="px-4 py-3 border-t border-zinc-100/50">
                                    <div className="px-6 py-4 pl-0 sm:pl-12 overflow-x-auto">
                                      <Table className="min-w-full text-left text-sm text-zinc-600">
                                        <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                                          <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                                            <TableHead className="px-4 py-3">Date</TableHead>
                                            <TableHead className="px-4 py-3">Document</TableHead>
                                            <TableHead className="px-4 py-3 text-right">Qty</TableHead>
                                            <TableHead className="px-4 py-3 text-right">Rate</TableHead>
                                            <TableHead className="px-4 py-3 text-right">Total</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody className="divide-y divide-zinc-100">
                                          {group.history.map((item: any, idx: number) => (
                                            <TableRow key={idx} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                                              <TableCell className="px-4 py-3 text-zinc-600">{new Date(item.date).toLocaleDateString()}</TableCell>
                                              <TableCell className="px-4 py-3 text-zinc-500">{item.documentNumber || '-'}</TableCell>
                                              <TableCell className="px-4 py-3 text-right text-zinc-700 font-medium">{Number(item.quantity || 0).toLocaleString('en-IN')}</TableCell>
                                              <TableCell className="px-4 py-3 text-right text-zinc-700">₹{Number(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                              <TableCell className="px-4 py-3 text-right font-medium text-zinc-800">₹{Number(item.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          ))}
                          {groupedProducts.length === 0 && (
                            <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell colSpan={5} className="px-4 py-3 flex flex-col items-center justify-center text-center">
                                <LucidePackage className="w-8 h-8 text-zinc-700 mb-3" />
                                <p className="text-zinc-500 font-medium">
                                  {productSearch ? 'No products match your search.' : 'No product history found.'}
                                </p>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'payments' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center bg-white/70 p-4 rounded-xl shadow-sm border border-zinc-100">
                    <h3 className="font-semibold text-zinc-800">Payment History</h3>
                  </div>

                  <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 border overflow-hidden">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                      <Table className="min-w-full text-left text-sm text-zinc-600">
                        <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                          <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                            <TableHead className="px-4 py-3">Date</TableHead>
                            <TableHead className="px-4 py-3">Payment #</TableHead>
                            <TableHead className="px-4 py-3">Mode</TableHead>
                            <TableHead className="px-4 py-3">Direction</TableHead>
                            <TableHead className="px-4 py-3">Status</TableHead>
                            <TableHead className="px-4 py-3 text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-zinc-100">
                          {analyticsData.payments?.map((payment: any) => (
                            <TableRow key={payment.id as string} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell className="px-4 py-3 whitespace-nowrap text-zinc-500">{new Date(payment.paymentDate as string).toLocaleDateString()}</TableCell>
                              <TableCell className="px-4 py-3 font-medium text-zinc-900">{payment.paymentNumber as string}</TableCell>
                              <TableCell className="px-4 py-3 whitespace-nowrap text-zinc-700 capitalize">{String(payment.paymentMode).replace('_', ' ')}</TableCell>
                              <TableCell className="px-4 py-3 whitespace-nowrap">
                                <span className={cn(
                                  "px-2 py-1 rounded text-xs font-medium capitalize",
                                  payment.direction === 'inbound' ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                                )}>
                                  {payment.direction as string}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-3 whitespace-nowrap">
                                <span className={cn(
                                  "px-2 py-1 rounded text-xs font-medium capitalize",
                                  payment.status === 'completed' ? "bg-amber-100 text-amber-800" :
                                  payment.status === 'pending' ? "bg-amber-100 text-amber-800" :
                                  "bg-zinc-100 text-zinc-800"
                                )}>
                                  {payment.status as string}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-3 whitespace-nowrap text-right font-semibold text-zinc-900">
                                ₹{Number(payment.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!analyticsData.payments || analyticsData.payments.length === 0) && (
                            <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell colSpan={6} className="px-4 py-3 flex flex-col items-center justify-center text-center">
                                <LucideCreditCard className="w-8 h-8 text-zinc-700 mb-3" />
                                <p className="text-zinc-500 font-medium">No payments found.</p>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
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

function KpiCard({ title, value, icon, trend, gradient }: { title: string, value: string | number, icon: React.ReactNode, trend?: string, gradient: string }) {
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
