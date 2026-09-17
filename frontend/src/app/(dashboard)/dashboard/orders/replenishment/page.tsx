'use client';

import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { DataTable, type TableHeader as DataTableHeader } from '@/components/ui/data-table';
import React, { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { RefreshCw, Package, ShoppingBag, ArrowRight, Truck, CheckCircle2, AlertTriangle, Layers, Building2 } from 'lucide-react';

export default function ReplenishmentPage() {
  const [items, setItems] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const [sortBy, setSortBy] = useState<string>('deficitLoose');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const stats = useMemo(() => {
    const totalDeficitUnits = items.reduce((acc, i) => acc + (Number(i.deficitLoose) || 0), 0);
    const totalBoxes = items.reduce((acc, i) => acc + (Number(i.suggestedBoxes) || 0), 0);
    const assignedSuppliers = new Set(items.map(i => i.preferredSupplierId).filter(Boolean)).size;
    return { totalDeficitUnits, totalBoxes, assignedSuppliers, count: items.length };
  }, [items]);

  const sortedItems = useMemo(() => {
    if (!sortBy) return items;
    return [...items].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    });
  }, [items, sortBy, sortOrder]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortBy === key && sortOrder === 'asc') {
      direction = 'desc';
    }
    setSortBy(key);
    setSortOrder(direction);
  };

  const fetchReplenishment = async () => {
    try {
      setLoading(true);
      const [replenishRes, contactsRes] = await Promise.all([
        api.get('/orders/replenishment'),
        api.get('/contacts?limit=1000')
      ]);
      setItems(replenishRes.data.data || []);
      const allContacts = contactsRes.data.data || [];
      setVendors(allContacts.filter((c: any) => c.type === 'vendor' || c.type === 'both'));
    } catch (err) {
      toast.error('Failed to calculate replenishment data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReplenishment();
  }, []);

  const handleDraftPOs = async () => {
    if (items.length === 0) return;
    
    let loadingToast: string | number | undefined;
    try {
      setDrafting(true);
      loadingToast = toast.loading('Generating draft purchase order(s)...');
      const res = await api.post('/orders/replenishment/draft', { items });
      if (loadingToast) toast.dismiss(loadingToast);
      toast.success(res.data.message);
      
      if (Array.isArray(res.data.data) && res.data.data.length > 0) {
        if (res.data.data.length === 1) {
          window.location.href = `/dashboard/orders/purchases/${res.data.data[0].id}`;
        } else {
          window.location.href = `/dashboard/orders/purchases`;
        }
      } else {
        fetchReplenishment();
      }
    } catch (err: any) {
      if (loadingToast) toast.dismiss(loadingToast);
      toast.error(err.response?.data?.message || 'Failed to auto-draft purchase orders');
    } finally {
      if (loadingToast) toast.dismiss(loadingToast);
      setDrafting(false);
    }
  };

  const tableHeaders: DataTableHeader[] = [
    { key: 'productName', label: 'Product & Variant', sortable: true },
    { key: 'sku', label: 'SKU', sortable: true },
    { key: 'pendingSales', label: 'Sales Demand', sortable: true, align: 'right' },
    { key: 'availableStock', label: 'In Stock', sortable: true, align: 'right' },
    { key: 'pendingPurchases', label: 'In Transit POs', sortable: true, align: 'right' },
    { key: 'deficitLoose', label: 'Deficit Qty', sortable: true, align: 'right' },
    { key: 'suggestedBoxes', label: 'Suggested Order', sortable: true, align: 'right' },
    { key: 'preferredSupplierId', label: 'Target Supplier Vendor' },
  ];

  return (
    <PageContainer className="max-w-full space-y-6">
      <PageHeader 
        title="Auto-Replenishment Engine" 
        subtitle="Calculates real-time inventory deficits by subtracting pending sales demand from current warehouse stock."
      >
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={fetchReplenishment}
            disabled={loading}
            className="border-zinc-200 hover:bg-zinc-50 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>

          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
            onClick={handleDraftPOs}
            disabled={items.length === 0 || drafting}
          >
            <ShoppingBag className="w-4 h-4 text-white" />
            {drafting ? 'Generating POs...' : `Auto-Draft Purchase Orders (${stats.count})`}
          </Button>
        </div>
      </PageHeader>

      {/* Engine Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">SKU Stock Deficits</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-red-600">{stats.count}</span>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Deficit Units</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-900">{stats.totalDeficitUnits}</span>
            <Package className="w-5 h-5 text-zinc-400" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Suggested Order Boxes</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-700">{stats.totalBoxes}</span>
            <Layers className="w-5 h-5 text-amber-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Assigned Vendors</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-blue-700">{stats.assignedSuppliers}</span>
            <Building2 className="w-5 h-5 text-blue-500" />
          </div>
        </Card>
      </div>

      {/* Main Table Workspace */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
        <DataTable
          headers={tableHeaders}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          isLoading={loading}
          isEmpty={items.length === 0}
          emptyMessage="No stock deficits found! Your current warehouse inventory is sufficient to fulfill all active sales orders."
        >
          {sortedItems.map((item, idx) => (
            <TableRow key={idx} className="hover:bg-zinc-50/80 transition-colors border-b border-zinc-100">
              <TableCell className="px-4 py-3.5">
                <span className="font-bold text-xs text-zinc-900 block">
                  {item.variantName || item.productName}
                </span>
                {item.variantName && (
                  <span className="text-[10px] text-zinc-500 font-medium">{item.productName}</span>
                )}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-zinc-500 font-mono text-xs">
                {item.sku || '—'}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-right font-mono font-bold text-zinc-900">
                {item.pendingSales}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-right font-mono text-zinc-600">
                {item.availableStock}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-right font-mono text-xs">
                {item.pendingPurchases > 0 ? (
                  <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    +{item.pendingPurchases}
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-right font-mono font-extrabold text-red-600">
                -{item.deficitLoose}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-900 border border-amber-500/20 font-mono">
                  {item.suggestedBoxes} Boxes <span className="text-[10px] text-zinc-400 font-normal">({item.boxQuantity}/b)</span>
                </span>
              </TableCell>
              <TableCell className="px-4 py-3.5">
                <div className="w-52">
                  <Select
                    value={item.preferredSupplierId || ''}
                    onChange={(e) => {
                      const newItems = [...items];
                      const idxInState = newItems.findIndex(i => i.productId === item.productId && i.variantId === item.variantId);
                      if (idxInState !== -1) {
                        newItems[idxInState].preferredSupplierId = e.target.value;
                        setItems(newItems);
                      }
                    }}
                    options={[
                      { value: '', label: 'Select Preferred Vendor...' },
                      ...vendors.map(v => ({ value: v.id, label: v.displayName }))
                    ]}
                    className="h-8 text-xs bg-white border-zinc-200 rounded-xl font-medium"
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </div>

      {/* Mobile Deficit Card List */}
      <div className="md:hidden flex flex-col gap-3">
        {items.map((item, idx) => (
          <Card key={idx} className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-bold text-xs text-zinc-900">{item.variantName || item.productName}</span>
                {item.sku && <p className="text-[10px] font-mono text-zinc-400">SKU: {item.sku}</p>}
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-900 border border-amber-500/20 font-mono">
                {item.suggestedBoxes} Boxes
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-2 bg-zinc-50 rounded-xl px-3 text-center text-xs font-mono">
              <div>
                <span className="text-[10px] text-zinc-400 block font-sans">Demand</span>
                <strong className="text-zinc-800">{item.pendingSales}</strong>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block font-sans">Stock</span>
                <strong className="text-zinc-600">{item.availableStock}</strong>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block font-sans">Deficit</span>
                <strong className="text-red-600">-{item.deficitLoose}</strong>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100">
              <label className="text-[10px] font-semibold uppercase text-zinc-500 block mb-1">Preferred Supplier</label>
              <Select
                value={item.preferredSupplierId || ''}
                onChange={(e) => {
                  const newItems = [...items];
                  const idxInState = newItems.findIndex(i => i.productId === item.productId && i.variantId === item.variantId);
                  if (idxInState !== -1) {
                    newItems[idxInState].preferredSupplierId = e.target.value;
                    setItems(newItems);
                  }
                }}
                options={[
                  { value: '', label: 'Select Preferred Vendor...' },
                  ...vendors.map(v => ({ value: v.id, label: v.displayName }))
                ]}
                className="h-8 text-xs bg-white border-zinc-200"
              />
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
