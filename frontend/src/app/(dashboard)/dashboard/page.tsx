'use client';

import { useAuth } from '@/providers/auth-provider';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  TrendingUp, 
  Receipt, 
  ShoppingCart, 
  AlertTriangle, 
  Landmark, 
  Package, 
  Plus, 
  ArrowUpRight, 
  ArrowRight, 
  Truck, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Sparkles, 
  ExternalLink,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

interface DashboardStats {
  salesOrdersThisMonth: number;
  pendingOrdersCount: number;
  pendingOrdersValue: number;
  revenueThisMonth: number;
  unpaidInvoicesCount: number;
  unpaidInvoicesValue: number;
  unpaidPayablesCount: number;
  unpaidPayablesValue: number;
  pendingPurchasesCount: number;
  pendingPurchasesValue: number;
  lowStockCount: number;
  recentOrders: RecentOrder[];
  monthlySales?: { m: string; val: number }[];
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  customerName?: string;
}

const formatINR = (val: number) =>
  Number(val || 0).toLocaleString('en-IN', { 
    style: 'currency', 
    currency: 'INR', 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });

const defaultMonthlySales = [
  { m: 'Apr', val: 0 }, { m: 'May', val: 0 }, { m: 'Jun', val: 0 },
  { m: 'Jul', val: 0 }, { m: 'Aug', val: 0 }, { m: 'Sep', val: 0 },
  { m: 'Oct', val: 0 }, { m: 'Nov', val: 0 }, { m: 'Dec', val: 0 },
  { m: 'Jan', val: 0 }, { m: 'Feb', val: 0 }, { m: 'Mar', val: 0 },
];

const statusPills: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Confirmed', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  pending: { label: 'Pending', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  processing: { label: 'Processing', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  shipped: { label: 'Dispatched', color: 'bg-purple-50 text-purple-800 border-purple-200' },
  delivered: { label: 'Delivered', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'Cancelled', color: 'bg-rose-50 text-rose-800 border-rose-200' },
  draft: { label: 'Draft', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
};

export default function DashboardOverviewPage() {
  const { user } = useAuth();

  const { data: statsData, isLoading: loading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/reports/dashboard-stats');
      return response.data.data;
    },
    refetchOnWindowFocus: true,
  });

  const stats: DashboardStats = statsData || {
    salesOrdersThisMonth: 0,
    pendingOrdersCount: 0,
    pendingOrdersValue: 0,
    revenueThisMonth: 0,
    unpaidInvoicesCount: 0,
    unpaidInvoicesValue: 0,
    unpaidPayablesCount: 0,
    unpaidPayablesValue: 0,
    pendingPurchasesCount: 0,
    pendingPurchasesValue: 0,
    lowStockCount: 0,
    recentOrders: [],
    monthlySales: defaultMonthlySales,
  };

  const netLiquidity = (stats.unpaidInvoicesValue || 0) - (stats.unpaidPayablesValue || 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* ─── Modern Executive Welcome Banner ────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950 p-6 md:p-8 text-white shadow-xl border border-zinc-800/80">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Executive Command Center</span>
              <span>•</span>
              <span className="font-mono">FY 2026-27</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Welcome back, <span className="text-amber-400">{user?.firstName || 'Workspace User'}</span> 👋
            </h1>
            <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
              Real-time snapshot of revenue, open collections, order fulfillment queues, and inventory health.
            </p>
          </div>

          {/* Direct Quick Launchers */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/dashboard/invoices/new?type=sales_invoice">
              <Button className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md shadow-amber-600/20 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>New Invoice</span>
                <kbd className="hidden sm:inline-block ml-1 text-[10px] font-mono bg-amber-700/60 px-1.5 py-0.5 rounded text-amber-200">Alt+I</kbd>
              </Button>
            </Link>

            <Link href="/dashboard/orders/sales/new">
              <Button variant="outline" className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-200 font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-zinc-400" />
                <span>New Order</span>
                <kbd className="hidden sm:inline-block ml-1 text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">Alt+O</kbd>
              </Button>
            </Link>

            <Link href="/dashboard/products/new">
              <Button variant="outline" className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-200 font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-zinc-400" />
                <span>Add Product</span>
                <kbd className="hidden sm:inline-block ml-1 text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">Alt+N</kbd>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── 4 Primary KPI Summary Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Revenue MTD */}
        <Link href="/dashboard/reports" className="group block">
          <Card className="p-5 rounded-2xl border border-zinc-200/80 bg-white shadow-sm hover:border-amber-400 hover:shadow-md transition-all h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-amber-800">
                  Revenue (This Month)
                </span>
                <div className="text-2xl font-extrabold font-mono text-zinc-900">
                  {loading ? <span className="inline-block h-7 w-28 bg-zinc-100 rounded animate-pulse" /> : formatINR(stats.revenueThisMonth)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-xs text-zinc-500 flex items-center gap-1.5 pt-2 border-t border-zinc-100">
              <span className="font-semibold text-emerald-800 font-mono">{stats.salesOrdersThisMonth}</span>
              <span>sales orders processed this month</span>
            </div>
          </Card>
        </Link>

        {/* Card 2: Receivables Awaiting Collection */}
        <Link href="/dashboard/invoices" className="group block">
          <Card className="p-5 rounded-2xl border border-zinc-200/80 bg-white shadow-sm hover:border-amber-400 hover:shadow-md transition-all h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-amber-800">
                  Receivables (Incoming)
                </span>
                <div className="text-2xl font-extrabold font-mono text-zinc-900">
                  {loading ? <span className="inline-block h-7 w-28 bg-zinc-100 rounded animate-pulse" /> : formatINR(stats.unpaidInvoicesValue)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 group-hover:scale-105 transition-transform">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-xs text-zinc-500 flex items-center gap-1.5 pt-2 border-t border-zinc-100">
              <span className="font-semibold text-amber-800 font-mono">{stats.unpaidInvoicesCount}</span>
              <span>unpaid customer invoices</span>
            </div>
          </Card>
        </Link>

        {/* Card 3: Pending Sales Queue */}
        <Link href="/dashboard/orders/sales" className="group block">
          <Card className="p-5 rounded-2xl border border-zinc-200/80 bg-white shadow-sm hover:border-amber-400 hover:shadow-md transition-all h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-amber-800">
                  Open Orders Queue
                </span>
                <div className="text-2xl font-extrabold font-mono text-zinc-900">
                  {loading ? <span className="inline-block h-7 w-28 bg-zinc-100 rounded animate-pulse" /> : `${stats.pendingOrdersCount} Orders`}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 group-hover:scale-105 transition-transform">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-xs text-zinc-500 flex items-center gap-1.5 pt-2 border-t border-zinc-100 font-mono">
              <span className="font-semibold text-sky-800">{formatINR(stats.pendingOrdersValue)}</span>
              <span className="font-sans text-zinc-400">awaiting delivery</span>
            </div>
          </Card>
        </Link>

        {/* Card 4: Inventory Low Stock Alerts */}
        <Link href="/dashboard/inventory/stock" className="group block">
          <Card className="p-5 rounded-2xl border border-zinc-200/80 bg-white shadow-sm hover:border-amber-400 hover:shadow-md transition-all h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-amber-800">
                  Low Stock SKU Alerts
                </span>
                <div className="text-2xl font-extrabold font-mono text-zinc-900">
                  {loading ? <span className="inline-block h-7 w-28 bg-zinc-100 rounded animate-pulse" /> : stats.lowStockCount}
                </div>
              </div>
              <div className={`p-2.5 rounded-xl border group-hover:scale-105 transition-transform ${
                stats.lowStockCount > 0 
                  ? 'bg-rose-50 text-rose-700 border-rose-200' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {stats.lowStockCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              </div>
            </div>
            <div className="mt-3 text-xs text-zinc-500 flex items-center gap-1.5 pt-2 border-t border-zinc-100">
              {stats.lowStockCount > 0 ? (
                <span className="font-semibold text-rose-800">Requires purchase reordering</span>
              ) : (
                <span className="text-emerald-800 font-medium">All stock levels nominal</span>
              )}
            </div>
          </Card>
        </Link>
      </div>

      {/* ─── Operational Command Strip ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Strip 1: Net Working Capital Balance */}
        <Card className="p-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100/80 text-purple-800">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Net Working Liquidity</div>
              <div className={`text-base font-bold font-mono ${netLiquidity >= 0 ? 'text-zinc-900' : 'text-rose-600'}`}>
                {formatINR(netLiquidity)}
              </div>
            </div>
          </div>
          <Badge className="bg-white text-zinc-700 border-zinc-200 text-[10px]">
            AR vs AP
          </Badge>
        </Card>

        {/* Strip 2: Pending Inbound Purchases */}
        <Link href="/dashboard/orders/purchases" className="group block">
          <Card className="p-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 hover:bg-white hover:border-amber-300 transition-all flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100/80 text-blue-800">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Inbound Vendor Orders</div>
                <div className="text-base font-bold font-mono text-zinc-900">
                  {stats.pendingPurchasesCount} POs ({formatINR(stats.pendingPurchasesValue)})
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
          </Card>
        </Link>

        {/* Strip 3: Public B2B Catalog Portal */}
        <Link href="/dashboard/settings" className="group block">
          <Card className="p-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 hover:bg-white hover:border-amber-300 transition-all flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100/80 text-amber-800">
                <ExternalLink className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">B2B Storefront &amp; Catalog</div>
                <div className="text-xs font-bold text-zinc-800">Online Customer Ordering Active</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
          </Card>
        </Link>
      </div>

      {/* ─── Financial Performance Chart & Recent Feed ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Monthly Revenue Chart (8 cols) */}
        <Card className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                <span>Fiscal Revenue Trajectory</span>
              </h3>
              <p className="text-xs text-zinc-500">Monthly billing and realization across 12 fiscal months.</p>
            </div>
            <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold font-mono">
              FY 2026-27
            </Badge>
          </div>

          {/* SVG Bar Chart with Hover Tooltip */}
          <div className="relative h-64 w-full flex items-end justify-between pt-8 pb-2 px-3 border border-zinc-200/80 bg-zinc-50/50 rounded-2xl p-4 shadow-inner">
            {/* Background grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between py-6 px-4 pointer-events-none opacity-15">
              <div className="border-b border-zinc-400 w-full" />
              <div className="border-b border-zinc-400 w-full" />
              <div className="border-b border-zinc-400 w-full" />
              <div className="border-b border-zinc-400 w-full" />
            </div>

            {/* Bars */}
            {(stats.monthlySales || defaultMonthlySales).map((bar) => {
              const maxVal = Math.max(...(stats.monthlySales || defaultMonthlySales).map((b) => b.val), 1);
              const heightPercent = `${Math.max((bar.val / maxVal) * 85, 4)}%`;
              return (
                <div key={bar.m} className="z-10 flex flex-col items-center space-y-2 w-[7%] h-full justify-end">
                  {bar.val > 0 ? (
                    <div
                      style={{ height: heightPercent }}
                      className="w-full rounded-t-lg bg-gradient-to-t from-amber-600 via-amber-500 to-amber-400 shadow-sm relative group transition-all duration-300 hover:scale-x-110 cursor-pointer"
                    >
                      {/* Hover Tooltip */}
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-800 text-white px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold hidden group-hover:block whitespace-nowrap shadow-xl z-30">
                        {formatINR(bar.val)}
                      </div>
                    </div>
                  ) : (
                    <div className="h-1 w-full bg-zinc-200 rounded-t" />
                  )}
                  <span className="text-[10px] font-bold text-zinc-500">{bar.m}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-100">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
              <span>Tax Invoiced Volume</span>
            </span>
            <Link href="/dashboard/reports" className="font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1">
              View Detailed Analytics <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>

        {/* Live Orders Feed (4 cols) */}
        <Card className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-6 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900 tracking-tight">Recent Orders</h3>
              <p className="text-xs text-zinc-500">Live booking activity.</p>
            </div>
            <Link href="/dashboard/orders/sales" className="text-xs font-bold text-amber-700 hover:text-amber-800">
              View all →
            </Link>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 p-3 animate-pulse">
                  <div className="space-y-2">
                    <div className="h-3 w-28 bg-zinc-200 rounded" />
                    <div className="h-2.5 w-16 bg-zinc-200 rounded" />
                  </div>
                  <div className="h-4 w-16 bg-zinc-200 rounded" />
                </div>
              ))
            ) : (stats.recentOrders || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                <FileText className="w-8 h-8 text-zinc-300" />
                <p className="text-xs font-bold text-zinc-500">No recent sales orders recorded</p>
                <Link href="/dashboard/orders/sales/new">
                  <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl">
                    + Create Sales Order
                  </Button>
                </Link>
              </div>
            ) : (
              (stats.recentOrders || []).map((order) => {
                const badge = statusPills[order.status] || statusPills.draft;
                return (
                  <Link
                    key={order.id}
                    href={`/dashboard/orders/sales`}
                    className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 hover:bg-amber-50/30 hover:border-amber-200 transition-all block group"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <p className="text-xs font-bold font-mono text-zinc-900 group-hover:text-amber-900">{order.orderNumber}</p>
                      <p className="text-[11px] font-medium text-zinc-600 truncate">{order.customerName || 'Direct Customer'}</p>
                      <p className="text-[10px] text-zinc-400">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="text-right space-y-1 flex-shrink-0">
                      <p className="text-xs font-bold font-mono text-zinc-900">{formatINR(order.totalAmount)}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
