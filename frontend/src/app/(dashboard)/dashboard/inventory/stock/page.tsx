'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { DataTable, type TableHeader as DataTableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Package, AlertTriangle, Layers, Clock, Search, SlidersHorizontal, Warehouse } from 'lucide-react';

const AdjustStockModal = dynamic(() => import('./_components/adjust-stock-modal').then(mod => mod.AdjustStockModal), { ssr: false });

interface StockItem {
  inventoryId: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  productName: string;
  productSku: string;
  variantId: string | null;
  variantName: string | null;
  variantSku: string | null;
  quantityOnHand: number;
  quantityReserved: number;
  pendingOrderQuantity: number;
  boxQuantity: number;
  updatedAt: string;
}

export default function StockControlPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Pagination & Sorting States
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/inventory/warehouses');
      return res.data.data || [];
    }
  });
  const warehouses: any[] = warehousesData || [];

  const { data: stockData, isLoading: loading, refetch: refetchStock } = useQuery({
    queryKey: ['stock', { page, sortBy, sortOrder, search, selectedWarehouse }],
    queryFn: async () => {
      let url = `/inventory/stock?page=${page}&limit=15&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedWarehouse) url += `&warehouseId=${selectedWarehouse}`;
      
      const res = await api.get(url);
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const stock: StockItem[] = stockData?.data || [];
  const totalPages = stockData?.pagination?.totalPages || 1;

  const stats = useMemo(() => {
    const totalOnHand = stock.reduce((sum, item) => sum + Number(item.quantityOnHand || 0), 0);
    const totalReserved = stock.reduce((sum, item) => sum + Number(item.quantityReserved || 0), 0);
    const totalPending = stock.reduce((sum, item) => sum + Number(item.pendingOrderQuantity || 0), 0);
    const lowStockCount = stock.filter(item => item.quantityOnHand <= 5).length;
    return { totalOnHand, totalReserved, totalPending, lowStockCount, count: stock.length };
  }, [stock]);

  // Reset to page 1 when search or warehouse filter changes
  useEffect(() => {
    setPage(1);
  }, [search, selectedWarehouse]);

  const handleModalSuccess = () => {
    setShowModal(false);
    refetchStock();
  };

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
    { key: 'productName', label: 'Product & Variant', sortable: true },
    { key: 'sku', label: 'SKU' },
    { key: 'warehouseName', label: 'Warehouse Location', sortable: true },
    { key: 'quantityOnHand', label: 'On Hand Stock', sortable: true, align: 'right' },
    { key: 'quantityReserved', label: 'Reserved', sortable: true, align: 'right' },
    { key: 'pendingOrderQuantity', label: 'In Transit POs', sortable: true, align: 'right' },
    { key: 'updatedAt', label: 'Last Audited', sortable: true },
  ];

  return (
    <PageContainer className="max-w-full space-y-6">
      <PageHeader title="Stock Control Workspace" subtitle="Monitor warehouse inventory, audit reserve balances, and log stock adjustments.">
        <Button
          type="button"
          onClick={() => setShowModal(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Adjust Stock Balance
        </Button>
      </PageHeader>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Stocked Items</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-900">{stats.count}</span>
            <Package className="w-5 h-5 text-zinc-400" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Available On Hand</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-700">{stats.totalOnHand}</span>
            <Layers className="w-5 h-5 text-emerald-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Reserved Demand</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-700">{stats.totalReserved}</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Low Stock Alerts</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-red-600">{stats.lowStockCount}</span>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-200/80">
        <div className="grid gap-3 md:grid-cols-12 items-center">
          <div className="md:col-span-8 relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <Input
              type="text"
              placeholder="Search by product name, variant, or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl w-full"
            />
          </div>
          <div className="md:col-span-4">
            <Select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              options={[
                { value: '', label: 'All Warehouses' },
                ...warehouses.map((w: any) => ({ value: w.id, label: w.name }))
              ]}
              className="h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl font-medium"
            />
          </div>
        </div>
      </Card>

      {/* Desktop Stock Table */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
        <DataTable
          headers={tableHeaders}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          isLoading={loading}
          isEmpty={stock.length === 0}
          emptyMessage="No stock records found. Records appear here once stock is initialized or adjusted."
        >
          {stock.map((item: any) => (
            <TableRow 
              key={item.inventoryId} 
              onClick={() => router.push(`/dashboard/analytics/products?productId=${item.variantId ? `${item.productId}_${item.variantId}` : item.productId}`)}
              className="hover:bg-zinc-50/80 transition-colors cursor-pointer group border-b border-zinc-100"
            >
              <TableCell className="px-4 py-3.5">
                <span className="font-bold text-xs text-zinc-900 group-hover:text-amber-600 transition-colors block">
                  {item.variantName || item.productName}
                </span>
                {item.variantName && (
                  <span className="text-[10px] text-zinc-500 font-medium">{item.productName}</span>
                )}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-zinc-500 font-mono text-xs">
                {item.variantSku || item.productSku || '—'}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-xs text-zinc-700 font-medium">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-800 text-xs font-semibold">
                  <Warehouse className="w-3 h-3 text-zinc-500" />
                  {item.warehouseName}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3.5 text-right font-mono">
                <span className={`font-bold text-sm ${item.quantityOnHand <= 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                  {item.quantityOnHand}
                </span>
                <div className="text-[10px] text-zinc-400 font-normal">
                  {Math.floor(item.quantityOnHand / (item.boxQuantity || 1))} Boxes ({item.quantityOnHand % (item.boxQuantity || 1)} pcs)
                </div>
              </TableCell>
              <TableCell className="px-4 py-3.5 text-right font-mono font-semibold text-amber-700 text-xs">
                {item.quantityReserved}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-right font-mono text-xs">
                {item.pendingOrderQuantity > 0 ? (
                  <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    +{item.pendingOrderQuantity}
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-zinc-500 text-xs font-medium">
                {new Date(item.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </div>

      {/* Mobile Stock Card View */}
      <div className="md:hidden flex flex-col gap-3">
        {stock.map((item: any) => (
          <Card 
            key={item.inventoryId} 
            onClick={() => router.push(`/dashboard/analytics/products?productId=${item.variantId ? `${item.productId}_${item.variantId}` : item.productId}`)}
            className="cursor-pointer hover:border-amber-300 transition-colors shadow-sm rounded-2xl"
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-xs text-zinc-900">{item.variantName || item.productName}</div>
                  <div className="text-[10px] text-zinc-500">{item.warehouseName}</div>
                </div>
                <span className="text-[11px] font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md font-semibold">
                  {item.variantSku || item.productSku || '—'}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 py-2 bg-zinc-50 rounded-xl px-3 text-center text-xs font-mono">
                <div>
                  <span className="text-[10px] text-zinc-400 block font-sans">On Hand</span>
                  <strong className={item.quantityOnHand <= 0 ? 'text-red-600' : 'text-zinc-900'}>{item.quantityOnHand}</strong>
                </div>
                <div className="border-l border-zinc-200">
                  <span className="text-[10px] text-zinc-400 block font-sans">Reserved</span>
                  <strong className="text-amber-700">{item.quantityReserved}</strong>
                </div>
                <div className="border-l border-zinc-200">
                  <span className="text-[10px] text-zinc-400 block font-sans">Pending</span>
                  <strong className="text-blue-600">{item.pendingOrderQuantity}</strong>
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

      {showModal && (
        <AdjustStockModal 
          isOpen={showModal}
          onClose={() => setShowModal(false)} 
          onSuccess={handleModalSuccess} 
        />
      )}
    </PageContainer>
  );
}
