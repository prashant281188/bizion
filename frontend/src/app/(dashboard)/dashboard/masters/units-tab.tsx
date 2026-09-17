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
import type { Unit } from '@/types';
import { unitFormSchema } from '@/schemas/master.schema';
import { ZodError } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type TableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';

export function UnitsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('code');
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
  const [deleteConfirmUnit, setDeleteConfirmUnit] = useState<Unit | null>(null);

  const { data: unitsData, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['masters-units', { page, sortBy, sortOrder, search }],
    queryFn: async () => {
      let url = `/masters/units?page=${page}&limit=10&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (search) url += `&q=${encodeURIComponent(search)}`;
      const res = await api.get(url);
      return res.data;
    },
  });

  const units = (unitsData?.data || []) as Unit[];
  const pagination = unitsData?.pagination || { page: 1, totalPages: 1 };
  const loading = queryLoading || !!deletingId;
  const error = localError || (queryError ? (queryError as any).response?.data?.message || 'Failed to fetch units of measurement' : null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [uqcCode, setUqcCode] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const openAddModal = () => {
    setEditingUnit(null);
    setCode('');
    setName('');
    setUqcCode('');
    setIsDefault(false);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (u: Unit) => {
    setEditingUnit(u);
    setCode(u.code);
    setName(u.name);
    setUqcCode(u.uqcCode || '');
    setIsDefault(u.isDefault);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    const payload = {
      code,
      name,
      uqcCode: uqcCode || null,
      isDefault,
    };

    try {
      unitFormSchema.parse(payload);

      if (editingUnit) {
        await api.put(`/masters/units/${editingUnit.id}`, payload);
      } else {
        await api.post('/masters/units', payload);
      }

      toast.success(editingUnit ? 'Unit of Measurement updated successfully' : 'Unit of Measurement created successfully');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['masters', 'units'] });
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

  const promptDelete = (u: Unit) => {
    if (u.isDefault) {
      toast.error('The default unit of measurement cannot be deleted.');
      return;
    }
    setDeleteConfirmUnit(u);
  };

  const executeDelete = async () => {
    if (!deleteConfirmUnit) return;
    try {
      setDeletingId(deleteConfirmUnit.id);
      setLocalError(null);
      await api.delete(`/masters/units/${deleteConfirmUnit.id}`);
      toast.success('Unit of measurement deleted successfully');
      setDeleteConfirmUnit(null);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['masters', 'units'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete unit of measurement');
    } finally {
      setDeletingId(null);
    }
  };

  const tableHeaders: TableHeader[] = [
    { key: 'code', label: 'Code', sortable: true },
    { key: 'name', label: 'Unit Name', sortable: true },
    { key: 'uqcCode', label: 'GST UQC Code', sortable: true },
    { key: 'isDefault', label: 'Default', sortable: true },
    { key: 'actions', label: 'Actions', align: 'right' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Units of Measurement (UOM)</h2>
          <p className="text-xs text-zinc-500">Define standard unit quantities for catalog itemizations and GST billing.</p>
        </div>
        <Button onClick={openAddModal} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-5 rounded-xl shadow-sm">
          + Add Unit
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search unit code or name..."
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
          isLoading={loading && units.length === 0}
          isEmpty={units.length === 0}
          emptyMessage="No units found."
        >
          {units.map((u) => (
            <tr key={u.id} className="hover:bg-zinc-50/80 transition-colors border-b border-zinc-100 text-xs">
              <td className="px-6 py-3.5 font-mono font-bold text-zinc-900">{u.code}</td>
              <td className="px-6 py-3.5 font-bold text-zinc-800">{u.name}</td>
              <td className="px-6 py-3.5 font-mono text-zinc-500 text-[11px]">{u.uqcCode || '-'}</td>
              <td className="px-6 py-3.5">
                {u.isDefault ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">Default</Badge>
                ) : (
                  <span className="text-zinc-400 text-[11px]">-</span>
                )}
              </td>
              <td className="px-6 py-3.5 text-right space-x-2">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(u)} className="h-7 text-xs">Edit</Button>
                {!u.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => promptDelete(u)} disabled={loading || u.isDefault} className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">Delete</Button>
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
              {editingUnit ? 'Edit Master Unit' : 'Add Master Unit'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Unit Code *</label>
              <Input
                placeholder="e.g. PCS, KGS, BOX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                error={formErrors.code}
                required
                className="h-9 text-xs font-mono uppercase bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Unit Display Name *</label>
              <Input
                placeholder="e.g. Pieces, Kilograms"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={formErrors.name}
                required
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">GST UQC Code (Standardized)</label>
              <Input
                placeholder="e.g. PCS, KGS, BOX"
                value={uqcCode}
                onChange={(e) => setUqcCode(e.target.value.toUpperCase())}
                error={formErrors.uqcCode}
                className="h-9 text-xs font-mono uppercase bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div className="flex items-center space-x-3 py-1">
              <input
                type="checkbox"
                id="isDefaultUnit"
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <label htmlFor="isDefaultUnit" className="text-xs font-bold text-zinc-700">
                Set as Default Unit for new products
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-100">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)} className="text-xs">Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-6 rounded-xl shadow-sm">
                {editingUnit ? 'Update Unit' : 'Save Unit'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!deleteConfirmUnit}
        onClose={() => setDeleteConfirmUnit(null)}
        onConfirm={executeDelete}
        title="Delete Unit"
        description={`Are you sure you want to delete the unit "${deleteConfirmUnit?.code}"?`}
        variant="destructive"
      />
    </div>
  );
}
