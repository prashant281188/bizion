'use client';

import { useAuth } from '@/providers/auth-provider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ShoppingCart, FileText, Package, CreditCard, ArrowRight, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function PortalDashboard() {
  const { user } = useAuth();

  // Fetch Orders
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['portal', 'orders'],
    queryFn: async () => {
      const res = await api.get('/portal/orders');
      return res.data?.data || [];
    },
  });

  // Fetch Invoices
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['portal', 'invoices'],
    queryFn: async () => {
      const res = await api.get('/portal/invoices');
      return res.data?.data || [];
    },
  });

  // Fetch Ledger Summary for true outstanding balance
  const { data: ledgerSummary, isLoading: loadingLedger } = useQuery({
    queryKey: ['portal', 'ledger', 'summary'],
    queryFn: async () => {
      const res = await api.get('/portal/ledger');
      return res.data?.data?.summary || { closingBalance: 0 };
    },
  });

  const isLoading = loadingOrders || loadingInvoices || loadingLedger;

  // Compute Metrics
  const totalOutstanding = Math.abs(ledgerSummary?.closingBalance || 0);
  const isCreditBalance = (ledgerSummary?.closingBalance || 0) < 0;

  const recentOrdersCount = orders.filter((o: any) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(o.orderDate) >= thirtyDaysAgo;
  }).length;

  const latestOrder = orders.length > 0 ? orders[0] : null;

  return (
    <div className="space-y-8 pb-10">
      {/* Modern Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-amber-50/80 border border-amber-100/50 px-8 py-12 text-zinc-900 shadow-sm">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-amber-200 opacity-20 blur-3xl"></div>
        
        <div className="relative z-10 max-w-3xl">
          <Badge className="mb-4 bg-amber-100 text-amber-800 hover:bg-amber-200 border-none shadow-none">
            Customer Portal
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
            Welcome back, {user?.firstName || 'Customer'}!
          </h1>
          <p className="text-lg text-zinc-600 max-w-xl font-medium">
            Manage your account, track recent activity, and access your custom catalog all in one place.
          </p>
          
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/portal/orders">
              <Button className="bg-amber-600 text-white hover:bg-amber-700 rounded-full font-semibold px-6 shadow-sm">
                View My Orders
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/portal/products">
              <Button variant="outline" className="border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-full font-semibold px-6">
                Browse Catalog
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
          <CardContent className="p-0">
            <div className="p-6 md:p-8 flex flex-col justify-between h-full relative">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <CreditCard className="w-32 h-32 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  {isCreditBalance ? 'Advance Balance' : 'Outstanding Balance'}
                </p>
                <div className="flex items-end gap-3">
                  <h3 className={`text-4xl font-bold tracking-tight ${isCreditBalance ? 'text-emerald-700' : 'text-zinc-900'}`}>
                    {formatCurrency(totalOutstanding)}
                  </h3>
                  {isCreditBalance && <span className="text-sm font-medium text-emerald-600 mb-1">(Advance)</span>}
                </div>
              </div>
              <div className="mt-8 relative z-10">
                <Link href="/portal/invoices">
                  <Button variant="outline" className="w-full sm:w-auto border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 font-medium">
                    View Invoices
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
          <CardContent className="p-0">
            <div className="p-6 md:p-8 flex flex-col justify-between h-full relative">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <ShoppingCart className="w-32 h-32 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-2">Recent Orders (30 Days)</p>
                <div className="flex items-end gap-3">
                  <h3 className="text-4xl font-bold text-zinc-900 tracking-tight">
                    {recentOrdersCount} <span className="text-xl font-medium text-zinc-500">orders</span>
                  </h3>
                </div>
                {latestOrder && (
                  <div className="mt-4 flex items-center text-sm font-medium text-zinc-600 bg-zinc-50 px-3 py-2 rounded-lg w-fit border border-zinc-100">
                    <Clock className="w-4 h-4 mr-2 text-zinc-400" />
                    Latest: {latestOrder.orderNumber} ({formatDate(latestOrder.orderDate)})
                  </div>
                )}
              </div>
              <div className="mt-8 relative z-10">
                <Link href="/portal/orders">
                  <Button variant="outline" className="w-full sm:w-auto font-medium">
                    Track Orders
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div>
        <h3 className="text-xl font-bold text-zinc-900 mb-4 tracking-tight">Quick Links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/portal/orders">
            <Card className="hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer group h-full">
              <CardHeader className="pb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 mb-2 group-hover:scale-110 transition-transform">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold text-zinc-800">Orders</CardTitle>
                <CardDescription className="text-xs">View all past orders</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/portal/invoices">
            <Card className="hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer group h-full">
              <CardHeader className="pb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-2 group-hover:scale-110 transition-transform">
                  <FileText className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold text-zinc-800">Invoices</CardTitle>
                <CardDescription className="text-xs">Download statements</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/portal/payments">
            <Card className="hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group h-full">
              <CardHeader className="pb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2 group-hover:scale-110 transition-transform">
                  <CreditCard className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold text-zinc-800">Payments</CardTitle>
                <CardDescription className="text-xs">Track payment history</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/portal/products">
            <Card className="hover:border-indigo-500/50 hover:shadow-md transition-all cursor-pointer group h-full">
              <CardHeader className="pb-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mb-2 group-hover:scale-110 transition-transform">
                  <Package className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold text-zinc-800">Products</CardTitle>
                <CardDescription className="text-xs">View your custom catalog</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
