'use client';

import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { DataTable, type TableHeader as DataTableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, Search, Plus, ArrowUpRight, CheckCircle2, Clock, Truck, XCircle, ChevronRight, FileText, Download, CheckSquare, Square, RefreshCw, Layers } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { toast } from 'sonner';

export default function SalesOrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Pagination & Sorting States
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('orderDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Bulk actions state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: queryData, isLoading: loading, refetch } = useQuery({
    queryKey: ['salesOrders', page, sortBy, sortOrder, statusFilter, debouncedSearchQuery, startDate, endDate],
    queryFn: async () => {
      let url = `/orders?type=sales&page=${page}&limit=15&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (debouncedSearchQuery) url += `&search=${encodeURIComponent(debouncedSearchQuery)}`;
      const res = await api.get(url);
      return res.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const orders = queryData?.data || [];
  const totalPages = queryData?.pagination?.totalPages || 1;
  const totalCount = queryData?.pagination?.total || orders.length;

  const stats = useMemo(() => {
    const totalVal = orders.reduce((acc: number, o: any) => acc + Number(o.totalAmount || 0), 0);
    const draftCount = orders.filter((o: any) => o.status === 'draft').length;
    const confirmedCount = orders.filter((o: any) => o.status === 'confirmed' || o.status === 'shipped').length;
    const deliveredCount = orders.filter((o: any) => o.status === 'delivered').length;
    return { totalVal, draftCount, confirmedCount, deliveredCount };
  }, [orders]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === orders.length && orders.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(orders.map((o: any) => o.id)));
    }
  };

  // Bulk Status Mutation
  const bulkStatusMutation = useMutation({
    mutationFn: async (targetStatus: string) => {
      const res = await api.post('/orders/bulk/status', {
        orderIds: Array.from(selectedOrderIds),
        status: targetStatus,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || 'Orders updated successfully');
      setSelectedOrderIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update orders');
    },
  });

  // Export Pending Orders Party-Wise CSV with full Item details
  const [isExportingPending, setIsExportingPending] = useState(false);

  const exportPendingOrdersPartyWiseCSV = async () => {
    try {
      setIsExportingPending(true);
      const res = await api.get('/orders/pending-report?type=sales');
      const partyData = res.data?.data || [];

      if (partyData.length === 0) {
        toast.info('No pending sales orders found');
        return;
      }

      // Build structured party-wise CSV with header rows per customer and detailed item lines
      const rows: string[][] = [];

      // CSV Master Header
      rows.push([
        'Party / Customer Name',
        'Contact Phone',
        'Contact Email',
        'GSTIN',
        'Order Number',
        'Order Date',
        'Order Status',
        'Product / Item Name',
        'Variant / SKU',
        'Ordered Qty (Pcs)',
        'Dispatched Qty (Pcs)',
        'Pending Balance Qty (Pcs)',
        'Unit Rate (INR)',
        'Pending Balance Value (INR)',
        'Total Order Line (INR)',
        'Order Notes'
      ]);

      partyData.forEach((party: any) => {
        party.orders.forEach((order: any) => {
          const statusText = order.status === 'partially_dispatched' ? 'PARTIAL DISPATCH' : order.status.toUpperCase();
          if (order.items && order.items.length > 0) {
            order.items.forEach((item: any) => {
              const baseQty = Number(item.baseQuantity || item.orderQuantity || 0);
              const dispQty = Number(item.dispatchedQuantity || 0);
              const balQty = item.balanceQuantity !== undefined ? Number(item.balanceQuantity) : Math.max(0, baseQty - dispQty);
              const unitPrice = Number(item.unitPrice || 0);
              const balVal = item.balanceAmount !== undefined ? Number(item.balanceAmount) : balQty * unitPrice;
              const totalLine = Number(item.totalPrice || baseQty * unitPrice);

              rows.push([
                `"${(party.partyName || 'Unknown').replace(/"/g, '""')}"`,
                `"${party.partyPhone || ''}"`,
                `"${party.partyEmail || ''}"`,
                `"${party.partyGstin || ''}"`,
                `"${order.orderNumber}"`,
                `"${new Date(order.orderDate).toLocaleDateString('en-IN')}"`,
                `"${statusText}"`,
                `"${(item.productName || '').replace(/"/g, '""')}"`,
                `"${(item.variantName ? `${item.variantName} (${item.variantSku || ''})` : (item.productSku || '')).replace(/"/g, '""')}"`,
                `"${baseQty}"`,
                `"${dispQty}"`,
                `"${balQty}"`,
                `"${unitPrice.toFixed(2)}"`,
                `"${balVal.toFixed(2)}"`,
                `"${totalLine.toFixed(2)}"`,
                `"${(order.notes || '').replace(/"/g, '""')}"`
              ]);
            });
          } else {
            // Order with no items
            rows.push([
              `"${(party.partyName || 'Unknown').replace(/"/g, '""')}"`,
              `"${party.partyPhone || ''}"`,
              `"${party.partyEmail || ''}"`,
              `"${party.partyGstin || ''}"`,
              `"${order.orderNumber}"`,
              `"${new Date(order.orderDate).toLocaleDateString('en-IN')}"`,
              `"${statusText}"`,
              '"-"',
              '"-"',
              '"0"',
              '"0"',
              '"0"',
              '"0.00"',
              '"0.00"',
              `"${Number(order.totalAmount || 0).toFixed(2)}"`,
              `"${(order.notes || '').replace(/"/g, '""')}"`
            ]);
          }
        });
      });

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Pending_Orders_Party_Wise_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported pending orders for ${partyData.length} parties`);
    } catch (err: any) {
      console.error('Failed to export pending orders:', err);
      toast.error('Failed to download pending orders report');
    } finally {
      setIsExportingPending(false);
    }
  };

  // Export CSV Handler for currently loaded list
  const exportOrdersCSV = () => {
    if (orders.length === 0) {
      toast.error('No orders available to export');
      return;
    }

    const headers = ['Order Number', 'Date', 'Customer', 'Items Count', 'Total Amount (INR)', 'Status', 'Notes'];
    const rows = orders.map((o: any) => [
      `"${o.orderNumber}"`,
      `"${new Date(o.orderDate).toLocaleDateString('en-IN')}"`,
      `"${(o.contactName || 'Walk-in Customer').replace(/"/g, '""')}"`,
      `"${o.items?.length || 0}"`,
      `"${o.totalAmount}"`,
      `"${o.status}"`,
      `"${(o.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e: string[]) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sales_Orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Orders exported to CSV');
  };



  const tableHeaders: DataTableHeader[] = [
    { key: 'select', label: '', sortable: false },
    { key: 'orderNumber', label: 'Order #', sortable: true },
    { key: 'orderDate', label: 'Date', sortable: true },
    { key: 'contactName', label: 'Customer', sortable: true },
    { key: 'totalAmount', label: 'Total Amount', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'actions', label: 'Action', sortable: false },
  ];

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'draft':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Draft</span>;
      case 'confirmed':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Confirmed</span>;
      case 'partially_dispatched':
      case 'partial_dispatch':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300"><span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />Partial Dispatch</span>;
      case 'processing':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" />Processing</span>;
      case 'shipped':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />Shipped</span>;
      case 'delivered':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Delivered</span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Cancelled</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 capitalize">{status}</span>;
    }
  };

  return (
    <PageContainer className="max-w-full space-y-6">
      <PageHeader title="Sales Orders Workspace" subtitle="Track customer orders, manage bulk status workflows, monitor fulfillment, and export summaries.">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isExportingPending}
            onClick={exportPendingOrdersPartyWiseCSV}
            className="h-9 px-3.5 rounded-xl text-xs font-bold border-amber-300 bg-amber-50/50 text-amber-900 hover:bg-amber-100 hover:border-amber-400 transition-all shadow-xs shrink-0 whitespace-nowrap"
          >
            <Layers className={`w-3.5 h-3.5 mr-1.5 text-amber-700 ${isExportingPending ? 'animate-spin' : ''}`} />
            {isExportingPending ? 'Generating Report...' : 'Download Pending (Party-wise)'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportOrdersCSV}
            className="h-9 px-3 rounded-xl text-xs font-bold border-zinc-200 text-zinc-700 hover:bg-zinc-50 shrink-0 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-zinc-500" /> Export All CSV
          </Button>

          <Link
            href="/dashboard/orders/sales/new"
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center justify-center gap-1.5 h-9 shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Create Sales Order
          </Link>
        </div>
      </PageHeader>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white rounded-2xl shadow-xs border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Orders</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-900">{totalCount}</span>
            <ShoppingCart className="w-5 h-5 text-zinc-400" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-xs border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Draft Orders</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-700">{stats.draftCount}</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-xs border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Active / Confirmed</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-blue-700">{stats.confirmedCount}</span>
            <Truck className="w-5 h-5 text-blue-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-xs border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Batch Order Sum</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-emerald-700">₹{stats.totalVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
        </Card>
      </div>

      {/* Bulk Action Banner (Appears when items are selected) */}
      {selectedOrderIds.size > 0 && (
        <Card className="border-amber-300 bg-amber-50/80 shadow-xs rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-6 px-2.5 rounded-lg bg-amber-700 text-white font-mono font-bold text-xs flex items-center">
              {selectedOrderIds.size} Selected
            </span>
            <span className="text-xs font-bold text-zinc-800">Bulk Actions:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={bulkStatusMutation.isPending}
              onClick={() => bulkStatusMutation.mutate('confirmed')}
              className="h-7 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Confirm All
            </Button>
            <Button
              size="sm"
              disabled={bulkStatusMutation.isPending}
              onClick={() => bulkStatusMutation.mutate('shipped')}
              className="h-7 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
            >
              Mark Shipped
            </Button>
            <Button
              size="sm"
              disabled={bulkStatusMutation.isPending}
              onClick={() => bulkStatusMutation.mutate('delivered')}
              className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
            >
              Mark Delivered
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkStatusMutation.isPending}
              onClick={() => bulkStatusMutation.mutate('cancelled')}
              className="h-7 text-xs font-bold border-red-300 text-red-700 hover:bg-red-50 rounded-lg"
            >
              Cancel Orders
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedOrderIds(new Set())}
              className="h-7 text-xs text-zinc-500 hover:text-zinc-800"
            >
              Deselect
            </Button>
          </div>
        </Card>
      )}

      {/* Search, Status Select & Date Filter */}
      <Card className="bg-white rounded-2xl p-4 shadow-xs border border-zinc-200/80">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <Input
              type="text"
              placeholder="Search order #, customer..."
              className="pl-9 h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Status Select */}
          <div className="w-[140px] shrink-0">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'draft', label: 'Draft' },
                { value: 'confirmed', label: 'Confirmed' },
                { value: 'partially_dispatched', label: 'Partial Dispatch' },
                { value: 'processing', label: 'Processing' },
                { value: 'shipped', label: 'Shipped' },
                { value: 'delivered', label: 'Delivered' },
                { value: 'cancelled', label: 'Cancelled' },
                { value: 'refused', label: 'Refused' },
              ]}
              className="h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl font-medium"
            />
          </div>

          {/* Date Filter at the end */}
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={(d) => { setStartDate(d); setPage(1); }}
            onEndDateChange={(d) => { setEndDate(d); setPage(1); }}
            onClear={() => setPage(1)}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-9 px-3 text-xs rounded-xl text-zinc-600 hover:text-zinc-900 border-zinc-200"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </Card>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl shadow-xs border border-zinc-200/80 overflow-hidden">
        <DataTable
          headers={tableHeaders}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          isLoading={loading}
          isEmpty={orders.length === 0}
          emptyMessage="No sales orders found matching filters."
        >
          {orders.map((order: any) => {
            const isSelected = selectedOrderIds.has(order.id);

            return (
              <TableRow
                key={order.id}
                onClick={() => router.push(`/dashboard/orders/sales/${order.id}`)}
                className={`transition-colors cursor-pointer group border-b border-zinc-100 ${
                  isSelected ? 'bg-amber-50/60 hover:bg-amber-50/80' : 'hover:bg-zinc-50/80'
                }`}
              >
                <TableCell className="w-10 px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => toggleSelectOrder(order.id)} className="text-zinc-600 hover:text-zinc-900">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-300" />
                    )}
                  </button>
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <span className="font-mono font-bold text-xs text-amber-900 group-hover:text-amber-600 transition-colors">
                    {order.orderNumber}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3.5 text-xs text-zinc-600 font-medium">
                  {new Date(order.orderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <span className="font-bold text-xs text-zinc-900 block">{order.contactName || 'Walk-in Customer'}</span>
                </TableCell>
                <TableCell className="px-4 py-3.5 font-mono font-bold text-xs text-zinc-900">
                  ₹{Number(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  {getStatusBadge(order.status)}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/orders/sales/${order.id}`);
                    }}
                    className="p-1.5 text-zinc-400 group-hover:text-amber-600 group-hover:bg-amber-50 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                  >
                    View <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </DataTable>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-3">
        {orders.map((order: any) => (
          <Card 
            key={order.id} 
            onClick={() => router.push(`/dashboard/orders/sales/${order.id}`)}
            className="cursor-pointer hover:border-amber-300 transition-colors shadow-xs rounded-2xl"
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono font-bold text-sm text-amber-900">{order.orderNumber}</span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{new Date(order.orderDate).toLocaleDateString()}</p>
                </div>
                {getStatusBadge(order.status)}
              </div>
              <div className="flex justify-between items-end pt-2 border-t border-zinc-100">
                <div className="text-xs font-semibold text-zinc-700 truncate pr-2 max-w-[60%]">
                  {order.contactName || 'Walk-in Customer'}
                </div>
                <div className="font-mono font-bold text-sm text-zinc-900">
                  ₹{Number(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </PageContainer>
  );
}
