'use client';

import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import React, { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { DataTable, type TableHeader as DataTableHeader } from '@/components/ui/data-table';
import { Warehouse as WarehouseIcon, Building2, MapPin, Plus, CheckCircle2 } from 'lucide-react';

interface Warehouse {
  id: string;
  name: string;
  code: string;
  city?: string;
  stateName?: string;
  isDefault: boolean;
  isActive: boolean;
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', city: '', stateName: '', isDefault: false });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/warehouses');
      setWarehouses(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const activeCount = warehouses.filter(w => w.isActive).length;
    const defaultWarehouse = warehouses.find(w => w.isDefault)?.name || 'Central Hub';
    return { activeCount, defaultWarehouse, total: warehouses.length };
  }, [warehouses]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory/warehouses', formData);
      toast.success('Warehouse created successfully');
      setShowModal(false);
      setFormData({ name: '', code: '', city: '', stateName: '', isDefault: false });
      fetchWarehouses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create warehouse');
    }
  };

  const tableHeaders: DataTableHeader[] = [
    { key: 'name', label: 'Warehouse Name' },
    { key: 'code', label: 'Code' },
    { key: 'location', label: 'City & Location' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <PageContainer className="max-w-full space-y-6">
      <PageHeader title="Storage Locations & Warehouses" subtitle="Manage physical fulfillment centers, regional stock hubs, and storage facilities.">
        <Button
          type="button"
          onClick={() => setShowModal(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Warehouse Facility
        </Button>
      </PageHeader>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Warehouses</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-900">{stats.total}</span>
            <WarehouseIcon className="w-5 h-5 text-zinc-400" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Primary Settlement Hub</p>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-amber-900 truncate max-w-[200px]">{stats.defaultWarehouse}</span>
            <Building2 className="w-5 h-5 text-amber-600" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Active Storage Locations</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-700">{stats.activeCount}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
        </Card>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
        <DataTable
          headers={tableHeaders}
          isLoading={loading}
          isEmpty={warehouses.length === 0}
          emptyMessage="No warehouses found. Click 'Add Warehouse Facility' to create your first storage location."
        >
          {warehouses.map((wh) => (
            <TableRow key={wh.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 group">
              <TableCell className="px-4 py-3.5">
                <span className="font-bold text-xs text-zinc-900 group-hover:text-amber-600 transition-colors inline-flex items-center gap-2">
                  <WarehouseIcon className="w-3.5 h-3.5 text-zinc-400" />
                  {wh.name}
                </span>
                {wh.isDefault && (
                  <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-full uppercase">
                    PRIMARY
                  </span>
                )}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-zinc-700 font-mono text-xs font-bold">{wh.code}</TableCell>
              <TableCell className="px-4 py-3.5 text-xs text-zinc-600 font-medium">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-zinc-400" />
                  {wh.city || ''} {wh.stateName ? `, ${wh.stateName}` : ''}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3.5">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full ${wh.isActive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-zinc-100 text-zinc-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${wh.isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                  {wh.isActive ? 'Active' : 'Inactive'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </div>

      {showModal && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-zinc-900">Add Warehouse Facility</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Warehouse Name *</label>
                <Input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Central Warehouse" className="h-9 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Facility Code *</label>
                <Input required type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="e.g. WH-01" className="h-9 text-xs font-mono uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">City</label>
                  <Input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="h-9 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">State</label>
                  <Input type="text" value={formData.stateName} onChange={e => setFormData({...formData, stateName: e.target.value})} className="h-9 text-xs" />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Checkbox id="isDefault" checked={formData.isDefault} onCheckedChange={(checked: boolean) => setFormData({...formData, isDefault: checked})} />
                <label htmlFor="isDefault" className="text-xs font-semibold text-zinc-700">Set as Primary Settlement Warehouse</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                <Button variant="outline" type="button" onClick={() => setShowModal(false)} className="text-xs">Cancel</Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl">Save Location</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </PageContainer>
  );
}
