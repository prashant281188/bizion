'use client';

import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { DataTable, type TableHeader as DataTableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Truck, PackageCheck, Clock, CheckCircle2, Plus, ArrowRight, Eye } from 'lucide-react';

const STATUS_BADGE: Record<string, { bg: string; dot: string; label: string }> = {
  draft: { bg: 'bg-zinc-100 text-zinc-700 border-zinc-200', dot: 'bg-zinc-400', label: 'Draft Note' },
  approved: { bg: 'bg-blue-50 text-blue-800 border-blue-200', dot: 'bg-blue-500', label: 'Approved' },
  shipped: { bg: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500', label: 'In Transit' },
  delivered: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', label: 'Delivered' },
  cancelled: { bg: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500', label: 'Cancelled' },
};

type Dispatch = {
  id: string;
  dispatchNumber: string;
  status: 'draft' | 'approved' | 'shipped' | 'delivered' | 'cancelled';
  orderId: string;
  orderNumber: string;
  customerName?: string;
  transporterName?: string;
  createdAt: string;
};

export default function DispatchesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['dispatches', page, activeTab, sortBy, sortOrder],
    queryFn: async () => {
      const params: any = { page, limit: 15, sortBy, sortOrder };
      if (activeTab !== 'all') params.status = activeTab;
      const res = await api.get('/dispatches', { params });
      return res.data;
    }
  });

  const dispatches: Dispatch[] = data?.data || [];
  const totalPages = data?.pagination?.totalPages || 1;

  const stats = useMemo(() => {
    const totalCount = data?.pagination?.total || dispatches.length;
    const pendingCount = dispatches.filter(d => d.status === 'draft' || d.status === 'approved').length;
    const shippedCount = dispatches.filter(d => d.status === 'shipped').length;
    const deliveredCount = dispatches.filter(d => d.status === 'delivered').length;
    return { totalCount, pendingCount, shippedCount, deliveredCount };
  }, [dispatches, data]);

  const handleSort = (field: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (sortBy === field) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(field);
    setSortOrder(newOrder);
    setPage(1);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      setUpdatingId(id);
      await api.patch('/dispatches/' + id + '/status', { status });
      toast.success('Dispatch status updated');
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update dispatch status');
    } finally {
      setUpdatingId(null);
    }
  };

  const getActionButton = (dispatch: Dispatch) => {
    if (dispatch.status === 'draft') {
      return (
        <Button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(dispatch.id, 'approved'); }}
          disabled={updatingId === dispatch.id}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-sm transition-all disabled:opacity-50"
        >
          {updatingId === dispatch.id ? 'Updating…' : 'Approve Dispatch'}
        </Button>
      );
    }
    if (dispatch.status === 'approved') {
      return (
        <Button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(dispatch.id, 'shipped'); }}
          disabled={updatingId === dispatch.id}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-sm transition-all disabled:opacity-50"
        >
          {updatingId === dispatch.id ? 'Updating…' : 'Mark Shipped'}
        </Button>
      );
    }
    if (dispatch.status === 'shipped') {
      return (
        <Button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(dispatch.id, 'delivered'); }}
          disabled={updatingId === dispatch.id}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-sm transition-all disabled:opacity-50"
        >
          {updatingId === dispatch.id ? 'Updating…' : 'Mark Delivered'}
        </Button>
      );
    }
    return null;
  };

  const tableHeaders: DataTableHeader[] = [
    { key: 'dispatchNumber', label: 'Dispatch Advice #', sortable: true },
    { key: 'orderNumber', label: 'Linked Order #', sortable: true },
    { key: 'status', label: 'Fulfillment Status', sortable: true },
    { key: 'createdAt', label: 'Dispatch Date', sortable: true },
    { key: 'actions', label: 'Fulfillment Workflow', align: 'right' },
  ];

  const STATUS_TABS = [
    { id: 'all', label: 'All Dispatches' },
    { id: 'draft', label: 'Draft Notes' },
    { id: 'approved', label: 'Approved' },
    { id: 'shipped', label: 'In Transit' },
    { id: 'delivered', label: 'Delivered' },
  ];

  return (
    <PageContainer className="max-w-full space-y-6">
      <PageHeader title="Order Dispatch & Shipping Workspace" subtitle="Track warehouse fulfillment notes, transportation manifests, and delivery receipts.">
        <Button 
          onClick={() => router.push('/dashboard/dispatches/new')}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Dispatch Note
        </Button>
      </PageHeader>

      {/* Fulfillment KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Dispatches</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-900">{stats.totalCount}</span>
            <PackageCheck className="w-5 h-5 text-zinc-400" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Pending & Approved</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-blue-700">{stats.pendingCount}</span>
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">In Transit / Shipped</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-700">{stats.shippedCount}</span>
            <Truck className="w-5 h-5 text-amber-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Delivered Orders</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-700">{stats.deliveredCount}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
        </Card>
      </div>

      {/* Segmented Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-zinc-200/80">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
        <DataTable
          headers={tableHeaders}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          isLoading={loading}
          isEmpty={dispatches.length === 0}
          emptyMessage="No dispatches found matching active filter status."
        >
          {dispatches.map((dispatch: any) => {
            const badge = STATUS_BADGE[dispatch.status] || STATUS_BADGE.draft;
            return (
              <TableRow 
                key={dispatch.id} 
                className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 cursor-pointer group"
                onClick={() => router.push(`/dashboard/dispatches/${dispatch.id}`)}
              >
                <TableCell className="px-4 py-3.5">
                  <span className="font-bold text-xs font-mono text-amber-700 group-hover:text-amber-800 transition-colors block">
                    {dispatch.dispatchNumber}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3.5 font-mono text-xs font-semibold text-zinc-700">
                  {dispatch.orderNumber}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full border ${badge.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                    {badge.label}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3.5 text-zinc-600 text-xs font-medium">
                  {new Date(dispatch.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-right flex items-center justify-end gap-2">
                  {getActionButton(dispatch)}
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-zinc-100" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/dispatches/${dispatch.id}`); }}>
                    <Eye className="w-3.5 h-3.5 text-zinc-500" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </DataTable>
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
