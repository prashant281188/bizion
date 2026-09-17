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
import type { PaymentTerm } from '@/types';
import { paymentTermFormSchema } from '@/schemas/master.schema';
import { ZodError } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type TableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';

export function PaymentTermsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('dueDays');
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
  const [deleteConfirmTerm, setDeleteConfirmTerm] = useState<PaymentTerm | null>(null);

  const { data: termsData, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['masters-payment-terms', { page, sortBy, sortOrder, search }],
    queryFn: async () => {
      let url = `/masters/payment-terms?page=${page}&limit=10&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (search) url += `&q=${encodeURIComponent(search)}`;
      const res = await api.get(url);
      return res.data;
    },
  });

  const terms = (termsData?.data || []) as PaymentTerm[];
  const pagination = termsData?.pagination || { page: 1, totalPages: 1 };
  const loading = queryLoading || !!deletingId;
  const error = localError || (queryError ? (queryError as any).response?.data?.message || 'Failed to fetch payment terms' : null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<PaymentTerm | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [dueDays, setDueDays] = useState('30');
  const [isDefault, setIsDefault] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const openAddModal = () => {
    setEditingTerm(null);
    setName('');
    setDueDays('30');
    setIsDefault(false);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (t: PaymentTerm) => {
    setEditingTerm(t);
    setName(t.name);
    setDueDays(t.dueDays.toString());
    setIsDefault(t.isDefault);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    const payload = {
      name,
      dueDays: parseInt(dueDays, 10) || 0,
      isDefault,
    };

    try {
      paymentTermFormSchema.parse(payload);

      if (editingTerm) {
        await api.put(`/masters/payment-terms/${editingTerm.id}`, payload);
      } else {
        await api.post('/masters/payment-terms', payload);
      }

      toast.success(editingTerm ? 'Payment Term updated successfully' : 'Payment Term created successfully');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['masters', 'payment-terms'] });
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

  const promptDelete = (t: PaymentTerm) => {
    if (t.isDefault) {
      toast.error('The default payment term cannot be deleted.');
      return;
    }
    setDeleteConfirmTerm(t);
  };

  const executeDelete = async () => {
    if (!deleteConfirmTerm) return;
    try {
      setDeletingId(deleteConfirmTerm.id);
      setLocalError(null);
      await api.delete(`/masters/payment-terms/${deleteConfirmTerm.id}`);
      toast.success('Payment term deleted successfully');
      setDeleteConfirmTerm(null);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['masters', 'payment-terms'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete payment term');
    } finally {
      setDeletingId(null);
    }
  };

  const tableHeaders: TableHeader[] = [
    { key: 'name', label: 'Term Name', sortable: true },
    { key: 'dueDays', label: 'Days Due', sortable: true },
    { key: 'isDefault', label: 'Default', sortable: true },
    { key: 'actions', label: 'Actions', align: 'right' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Payment Terms</h2>
          <p className="text-xs text-zinc-500">Manage credit terms and payment due windows for trading parties.</p>
        </div>
        <Button onClick={openAddModal} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-5 rounded-xl shadow-sm">
          + Add Payment Term
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search term name..."
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
          isLoading={loading && terms.length === 0}
          isEmpty={terms.length === 0}
          emptyMessage="No payment terms found."
        >
          {terms.map((t) => (
            <tr key={t.id} className="hover:bg-zinc-50/80 transition-colors border-b border-zinc-100 text-xs">
              <td className="px-6 py-3.5 font-bold text-zinc-900">{t.name}</td>
              <td className="px-6 py-3.5 font-mono font-bold text-zinc-800">
                {t.dueDays === 0 ? (
                  <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px]">Due Immediately (COD)</Badge>
                ) : (
                  `${t.dueDays} Days`
                )}
              </td>
              <td className="px-6 py-3.5">
                {t.isDefault ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">Default</Badge>
                ) : (
                  <span className="text-zinc-400 text-[11px]">-</span>
                )}
              </td>
              <td className="px-6 py-3.5 text-right space-x-2">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(t)} className="h-7 text-xs">Edit</Button>
                {!t.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => promptDelete(t)} disabled={loading || t.isDefault} className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">Delete</Button>
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
              {editingTerm ? 'Edit Master Payment Term' : 'Add Master Payment Term'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Term Name *</label>
              <Input
                placeholder="e.g. Net 30, COD, Due on Receipt"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={formErrors.name}
                required
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Days Until Payment Due *</label>
              <Input
                type="number"
                placeholder="e.g. 30, 0, 60"
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                error={formErrors.dueDays}
                required
                className="h-9 text-xs font-mono bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div className="flex items-center space-x-3 py-1">
              <input
                type="checkbox"
                id="isDefaultTerm"
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <label htmlFor="isDefaultTerm" className="text-xs font-bold text-zinc-700">
                Set as Default Payment Term for new contacts
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-100">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)} className="text-xs">Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-6 rounded-xl shadow-sm">
                {editingTerm ? 'Update Payment Term' : 'Save Payment Term'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!deleteConfirmTerm}
        onClose={() => setDeleteConfirmTerm(null)}
        onConfirm={executeDelete}
        title="Delete Payment Term"
        description={`Are you sure you want to delete payment term "${deleteConfirmTerm?.name}"?`}
        variant="destructive"
      />
    </div>
  );
}
