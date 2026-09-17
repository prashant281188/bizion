'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import type { TaxRate } from '@/types';
import { taxRateFormSchema } from '@/schemas/master.schema';
import { ZodError } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type TableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';

export function TaxRatesTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('ratePercentage');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  // Reset page when search changes
  useEffect(() => { setPage(1); }, [search]);
  const handleSort = (field: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (sortBy === field) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(field);
    setSortOrder(newOrder);
    setPage(1);
  };
  const [localError, setLocalError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmRate, setDeleteConfirmRate] = useState<TaxRate | null>(null);

  const { data: taxRatesData, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['masters-tax-rates', { page, sortBy, sortOrder, search }],
    queryFn: async () => {
      let url = `/masters/tax-rates?page=${page}&limit=10&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (search) url += `&q=${encodeURIComponent(search)}`;
      const res = await api.get(url);
      return res.data;
    },
  });

  const rates = (taxRatesData?.data || []) as TaxRate[];
  const pagination = taxRatesData?.pagination || { page: 1, totalPages: 1 };
  const loading = queryLoading || !!deletingId;
  const error = localError || (queryError ? (queryError as any).response?.data?.message || 'Failed to fetch tax rates' : null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [ratePercentage, setRatePercentage] = useState('0');
  const [cessRate, setCessRate] = useState('0');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const openAddModal = () => {
    setEditingRate(null);
    setName('');
    setRatePercentage('0');
    setCessRate('0');
    setIsDefault(false);
    setIsActive(true);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (r: TaxRate) => {
    setEditingRate(r);
    setName(r.name);
    setRatePercentage(r.ratePercentage);
    setCessRate(r.cessRate);
    setIsDefault(r.isDefault);
    setIsActive(r.isActive);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    const payload = {
      name,
      ratePercentage: parseFloat(ratePercentage) || 0,
      cessRate: parseFloat(cessRate) || 0,
      isDefault,
      isActive,
    };

    try {
      taxRateFormSchema.parse(payload);

      if (editingRate) {
        await api.put(`/masters/tax-rates/${editingRate.id}`, payload);
      } else {
        await api.post('/masters/tax-rates', payload);
      }

      toast.success(editingRate ? 'Tax Rate updated successfully' : 'Tax Rate created successfully');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['masters', 'tax-rates'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setModalOpen(false);
      setLocalError(null);
    } catch (err: any) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {};
        err.issues.forEach((e) => {
          if (e.path[0]) {
            errors[e.path[0].toString()] = e.message;
          }
        });
        setFormErrors(errors);
      } else {
        toast.error(err.response?.data?.message || 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const promptDelete = (r: TaxRate) => {
    if (r.isDefault) {
      toast.error('The default tax rate cannot be deleted.');
      return;
    }
    setDeleteConfirmRate(r);
  };

  const executeDelete = async () => {
    if (!deleteConfirmRate) return;
    try {
      setDeletingId(deleteConfirmRate.id);
      setLocalError(null);
      await api.delete(`/masters/tax-rates/${deleteConfirmRate.id}`);
      toast.success('Tax rate deleted successfully');
      setDeleteConfirmRate(null);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['masters', 'tax-rates'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete tax rate');
    } finally {
      setDeletingId(null);
    }
  };

  const tableHeaders: TableHeader[] = [
    { key: 'rate name', label: 'Rate Name', sortable: true },
    { key: 'total gst %', label: 'Total GST %', sortable: true, align: 'center' },
    { key: 'cgst %', label: 'CGST %', sortable: true, align: 'center' },
    { key: 'sgst %', label: 'SGST %', sortable: true, align: 'center' },
    { key: 'igst %', label: 'IGST %', sortable: true, align: 'center' },
    { key: 'cess %', label: 'Cess %', sortable: true, align: 'center' },
    { key: 'default', label: 'Default', sortable: true, align: 'center' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', align: 'right' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Tax Configurations (GST)</h2>
          <p className="text-xs text-zinc-500">Configure Indian GST tax slabs with automated breakouts for tax invoicing.</p>
        </div>
        <Button onClick={openAddModal} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-5 rounded-xl shadow-sm">
          + Add Tax Rate
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search tax rate name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 h-9 text-xs bg-white border-zinc-200/80 rounded-xl"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <span>{error}</span>
          <Button variant="ghost" className="ml-auto text-red-700 hover:text-red-800 font-bold" onClick={() => setLocalError(null)}>✕</Button>
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        <DataTable
          headers={tableHeaders}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          isLoading={loading && rates.length === 0}
          isEmpty={rates.length === 0}
          emptyMessage="No tax rates configured."
        >
          {rates.map((r) => (
            <tr key={r.id} className="hover:bg-zinc-50/80 transition-colors border-b border-zinc-100 text-xs">
              <td className="px-6 py-3.5 font-bold text-zinc-900">{r.name}</td>
              <td className="px-6 py-3.5 text-center font-mono font-bold text-amber-700">{r.ratePercentage}%</td>
              <td className="px-6 py-3.5 text-center font-mono text-zinc-600">{r.cgstRate}%</td>
              <td className="px-6 py-3.5 text-center font-mono text-zinc-600">{r.sgstRate}%</td>
              <td className="px-6 py-3.5 text-center font-mono text-zinc-800">{r.igstRate}%</td>
              <td className="px-6 py-3.5 text-center font-mono text-zinc-500">{parseFloat(r.cessRate) > 0 ? `${r.cessRate}%` : '-'}</td>
              <td className="px-6 py-3.5 text-center">
                {r.isDefault ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">Default</Badge>
                ) : (
                  <span className="text-zinc-400 text-[11px]">-</span>
                )}
              </td>
              <td className="px-6 py-3.5">
                {r.isActive ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">Active</Badge>
                ) : (
                  <Badge className="bg-zinc-100 text-zinc-500 border border-zinc-200 text-[10px]">Inactive</Badge>
                )}
              </td>
              <td className="px-6 py-3.5 text-right space-x-2">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(r)} className="h-7 text-xs">Edit</Button>
                {!r.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => promptDelete(r)} disabled={loading || r.isDefault} className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">Delete</Button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
        />
      </div>

      {/* Edit/Create Modal Overlay */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6 shadow-xl border border-zinc-200/80">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-900">
              {editingRate ? 'Edit Master Tax Rate' : 'Add Master Tax Rate'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Rate Name *</label>
              <Input
                placeholder="e.g. GST 18%, GST 5%"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={formErrors.name}
                required
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">GST Rate Percentage (%) *</label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="100"
                placeholder="e.g. 18, 5, 28"
                value={ratePercentage}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') { setRatePercentage(''); return; }
                  const val = parseFloat(raw);
                  if (isNaN(val)) setRatePercentage('');
                  else setRatePercentage(Math.min(100, Math.max(0, val)).toString());
                }}
                error={formErrors.ratePercentage}
                required
                className="h-9 text-xs font-mono bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Cess Rate Percentage (Optional %)</label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="100"
                placeholder="e.g. 0, 1.5"
                value={cessRate}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') { setCessRate(''); return; }
                  const val = parseFloat(raw);
                  if (isNaN(val)) setCessRate('');
                  else setCessRate(Math.min(100, Math.max(0, val)).toString());
                }}
                error={formErrors.cessRate}
                className="h-9 text-xs font-mono bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div className="flex items-center space-x-3 py-1">
              <input
                type="checkbox"
                id="isDefaultRate"
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <label htmlFor="isDefaultRate" className="text-xs font-bold text-zinc-700">
                Set as Default GST rate for products
              </label>
            </div>

            <div className="flex items-center space-x-3 py-1">
              <input
                type="checkbox"
                id="isActiveRate"
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="isActiveRate" className="text-xs font-bold text-zinc-700">
                Active Tax Rate
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-100">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)} className="text-xs">Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-6 rounded-xl shadow-sm">
                {editingRate ? 'Update Tax Rate' : 'Save Tax Rate'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!deleteConfirmRate}
        onClose={() => setDeleteConfirmRate(null)}
        onConfirm={executeDelete}
        title="Delete Tax Rate"
        description={`Are you sure you want to delete "${deleteConfirmRate?.name}"?`}
        variant="destructive"
      />
    </div>
  );
}
