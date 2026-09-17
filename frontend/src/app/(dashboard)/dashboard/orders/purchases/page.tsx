'use client';

import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { DataTable, type TableHeader as DataTableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Search, Plus, CheckCircle2, Clock, Truck, ChevronRight } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';

export default function PurchaseOrdersPage() {
  const router = useRouter();

  // Pagination & Sorting States
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('orderDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: queryData, isLoading: loading } = useQuery({
    queryKey: ['purchaseOrders', page, sortBy, sortOrder, statusFilter, debouncedSearchQuery, startDate, endDate],
    queryFn: async () => {
      let url = `/orders?type=purchase&page=${page}&limit=15&sortBy=${sortBy}&sortOrder=${sortOrder}`;
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
    const confirmedCount = orders.filter((o: any) => o.status === 'confirmed' || o.status === 'received').length;
    return { totalVal, draftCount, confirmedCount };
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

  const tableHeaders: DataTableHeader[] = [
    { key: 'orderNumber', label: 'PO #', sortable: true },
    { key: 'orderDate', label: 'Date', sortable: true },
    { key: 'contactName', label: 'Supplier / Vendor', sortable: true },
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
      case 'received':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Received</span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Cancelled</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 capitalize">{status}</span>;
    }
  };

  const STATUS_TABS = [
    { value: '', label: 'All Purchase Orders' },
    { value: 'draft', label: 'Draft' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'received', label: 'Received' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <PageContainer className="max-w-full space-y-6">
      <PageHeader title="Purchase Orders Workspace" subtitle="Manage vendor procurement, track purchase receipts, and audit stock intake.">
        <Link
          href="/dashboard/orders/purchases/new"
          className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-2 shrink-0 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Create Purchase Order
        </Link>
      </PageHeader>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Purchase Orders</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-900">{totalCount}</span>
            <ShoppingBag className="w-5 h-5 text-zinc-400" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Draft POs</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-700">{stats.draftCount}</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Confirmed / Active</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-blue-700">{stats.confirmedCount}</span>
            <Truck className="w-5 h-5 text-blue-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Procurement Sum</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-emerald-700">₹{stats.totalVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
        </Card>
      </div>

      {/* Search, Status Select & Date Filter */}
      <Card className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-200/80">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <Input
              type="text"
              placeholder="Search PO #, supplier..."
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
        </div>
      </Card>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
        <DataTable
          headers={tableHeaders}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          isLoading={loading}
          isEmpty={orders.length === 0}
          emptyMessage="No purchase orders found matching filters."
        >
          {orders.map((order: any) => (
            <TableRow
              key={order.id}
              onClick={() => router.push(`/dashboard/orders/purchases/${order.id}`)}
              className="hover:bg-zinc-50/80 transition-colors cursor-pointer group border-b border-zinc-100"
            >
              <TableCell className="px-4 py-3.5">
                <span className="font-mono font-bold text-xs text-amber-900 group-hover:text-amber-600 transition-colors">
                  {order.orderNumber}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3.5 text-xs text-zinc-600 font-medium">
                {new Date(order.orderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </TableCell>
              <TableCell className="px-4 py-3.5">
                <span className="font-bold text-xs text-zinc-900 block">{order.contactName || 'Unknown Supplier'}</span>
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
                    router.push(`/dashboard/orders/purchases/${order.id}`);
                  }}
                  className="p-1.5 text-zinc-400 group-hover:text-amber-600 group-hover:bg-amber-50 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                >
                  View <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-3">
        {orders.map((order: any) => (
          <Card 
            key={order.id} 
            onClick={() => router.push(`/dashboard/orders/purchases/${order.id}`)}
            className="cursor-pointer hover:border-amber-300 transition-colors shadow-sm rounded-2xl"
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
                  {order.contactName || 'Unknown Supplier'}
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
