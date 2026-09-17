'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loader2 } from 'lucide-react';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { useDebounce } from '@/hooks/useDebounce';
import type { HsnCode, HsnRateHistory, TaxRate } from '@/types';
import { hsnCodeFormSchema, hsnRateChangeSchema } from '@/schemas/master.schema';
import { ZodError } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type TableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';

export function HsnCodesTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  // Reset page when search changes
  
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
  const [deleteConfirmHsn, setDeleteConfirmHsn] = useState<HsnCode | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [search]);

  const { data: hsnData, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['masters-hsn-codes', { search: debouncedSearch, page, sortBy, sortOrder }],
    queryFn: async () => {
      let url = `/masters/hsn-codes?page=${page}&limit=10&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;
      const res = await api.get(url);
      return res.data;
    },
  });

  const { data: taxRatesData, isLoading: taxRatesLoading } = useQuery({
    queryKey: ['masters-tax-rates'],
    queryFn: async () => {
      const res = await api.get('/masters/tax-rates');
      return res.data;
    },
  });

  const hsnList = (hsnData?.data || []) as HsnCode[];
  const pagination = hsnData?.pagination || { page: 1, totalPages: 1 };
  const taxRatesList = ((taxRatesData?.data || []) as TaxRate[]).filter((r: TaxRate) => r.isActive);
  const loading = queryLoading || !!deletingId;
  const error = localError || (queryError ? (queryError as any).response?.data?.message || 'Failed to fetch HSN codes' : null);

  // Add/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHsn, setEditingHsn] = useState<HsnCode | null>(null);

  // Rate Change Modal
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [rateChangingHsn, setRateChangingHsn] = useState<HsnCode | null>(null);

  // Rate History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyHsn, setHistoryHsn] = useState<HsnCode | null>(null);
  const [rateHistory, setRateHistory] = useState<HsnRateHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form State (Add/Edit)
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [hsnType, setHsnType] = useState<'goods' | 'services'>('goods');
  const [taxRateId, setTaxRateId] = useState('');

  // Rate Change Form
  const [newTaxRateId, setNewTaxRateId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [reason, setReason] = useState('');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // ─── Add/Edit Modal ────────────────────────────────────────────────────────
  const openAddModal = () => {
    setEditingHsn(null);
    setCode('');
    setDescription('');
    setHsnType('goods');
    setTaxRateId('');
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (hsn: HsnCode) => {
    setEditingHsn(hsn);
    setCode(hsn.code);
    setDescription(hsn.description);
    setHsnType(hsn.type);
    setTaxRateId(''); // Not editable via this modal
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    const payload: any = {
      code,
      description,
      type: hsnType,
    };

    // Only include taxRateId on create
    if (!editingHsn) {
      payload.taxRateId = taxRateId || null;
    }

    try {
      hsnCodeFormSchema.parse(payload);

      if (editingHsn) {
        await api.put(`/masters/hsn-codes/${editingHsn.id}`, {
          code: payload.code,
          description: payload.description,
          type: payload.type,
        });
      } else {
        await api.post('/masters/hsn-codes', payload);
      }

      toast.success(editingHsn ? 'HSN/SAC Code updated successfully' : 'HSN/SAC Code created successfully');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['masters', 'hsn-codes'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setModalOpen(false);
      setLocalError(null);
    } catch (err: any) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {};
        err.issues.forEach((e) => {
          if (e.path[0]) errors[e.path[0].toString()] = e.message;
        });
        setFormErrors(errors);
      } else {
        toast.error(err.response?.data?.message || 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Rate Change ───────────────────────────────────────────────────────────
  const openRateModal = (hsn: HsnCode) => {
    setRateChangingHsn(hsn);
    setNewTaxRateId('');
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    setReason('');
    setFormErrors({});
    setRateModalOpen(true);
  };

  const handleRateChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateChangingHsn) return;
    setFormErrors({});
    setSubmitting(true);

    const payload = { newTaxRateId, effectiveFrom, reason: reason || null };

    try {
      hsnRateChangeSchema.parse(payload);
      await api.put(`/masters/hsn-codes/${rateChangingHsn.id}/rate`, payload);
      toast.success('GST rate updated successfully');
      setRateModalOpen(false);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['masters', 'hsn-codes'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setLocalError(null);
    } catch (err: any) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {};
        err.issues.forEach((e) => {
          if (e.path[0]) errors[e.path[0].toString()] = e.message;
        });
        setFormErrors(errors);
      } else {
        toast.error(err.response?.data?.message || 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Rate History ──────────────────────────────────────────────────────────
  const openHistoryModal = async (hsn: HsnCode) => {
    setHistoryHsn(hsn);
    setHistoryLoading(true);
    setHistoryModalOpen(true);

    try {
      const res = await api.get(`/masters/hsn-codes/${hsn.id}/rate-history`);
      setRateHistory(res.data.data);
      setLocalError(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch rate history');
    } finally {
      setHistoryLoading(false);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────
  const promptDelete = (hsn: HsnCode) => {
    setDeleteConfirmHsn(hsn);
  };

  const executeDelete = async () => {
    if (!deleteConfirmHsn) return;

    try {
      setDeletingId(deleteConfirmHsn.id);
      setLocalError(null);
      await api.delete(`/masters/hsn-codes/${deleteConfirmHsn.id}`);
      toast.success('HSN/SAC code deleted successfully');
      setDeleteConfirmHsn(null);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['masters', 'hsn-codes'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete HSN code');
    } finally {
      setDeletingId(null);
    }
  };

  const tableHeaders: TableHeader[] = [
    { key: 'type', label: 'Type', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'description', label: 'Description', sortable: true },
    { key: 'gst rate', label: 'GST Rate', sortable: true, align: 'center' },
    { key: 'actions', label: 'Actions', align: 'right' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-900">HSN / SAC Tax Codes Registry</h2>
          <p className="text-xs text-zinc-500">Manage standardized HSN/SAC codes for catalog items with linked GST rates and change audit logs.</p>
        </div>
        <Button onClick={openAddModal} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-5 rounded-xl shadow-sm">
          + Add HSN/SAC Code
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search by HSN code or description..."
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
          isLoading={loading && hsnList.length === 0}
          isEmpty={hsnList.length === 0}
          emptyMessage="No HSN/SAC codes found."
        >
          {hsnList.map((hsn) => (
            <tr key={hsn.id} className="hover:bg-zinc-50/80 transition-colors border-b border-zinc-100 text-xs">
              <td className="px-6 py-3.5">
                {hsn.type === 'goods' ? (
                  <Badge className="bg-sky-50 text-sky-700 border border-sky-200 text-[10px]">HSN (Goods)</Badge>
                ) : (
                  <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px]">SAC (Services)</Badge>
                )}
              </td>
              <td className="px-6 py-3.5 font-mono font-bold text-zinc-900">{hsn.code}</td>
              <td className="px-6 py-3.5 text-zinc-700 max-w-md truncate">{hsn.description}</td>
              <td className="px-6 py-3.5 text-center">
                {hsn.gstRate ? (
                  <span className="font-mono font-bold text-amber-700">{parseFloat(hsn.gstRate)}%</span>
                ) : (
                  <span className="text-zinc-400 text-[11px]">Unset</span>
                )}
              </td>
              <td className="px-6 py-3.5 text-right space-x-1">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(hsn)} className="h-7 text-xs">Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => openRateModal(hsn)} className="h-7 text-xs text-amber-700 hover:text-amber-800">
                  Change Rate
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openHistoryModal(hsn)} className="h-7 text-xs">
                  History
                </Button>
                <Button variant="ghost" size="sm" onClick={() => promptDelete(hsn)} disabled={loading} className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">Delete</Button>
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

      {/* ─── Add/Edit Modal ─────────────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingHsn ? 'Edit HSN/SAC Code' : 'Add HSN/SAC Code'}
            </DialogTitle>
          </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="HSN/SAC Code"
                  placeholder="e.g. 84713010"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  error={formErrors.code}
                  required
                />

                <div className="w-full">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Code Type
                  </label>
                  <div className="flex space-x-2 mt-1">
                    <label className={`flex-1 flex items-center justify-center border rounded-lg h-10 px-3 cursor-pointer text-sm font-medium transition-all ${
                      hsnType === 'goods'
                        ? 'border-sky-500 bg-sky-500/10 text-sky-700'
                        : 'border-zinc-200 bg-white text-zinc-500 hover:text-zinc-700'
                    }`}>
                      <input type="radio" name="hsnType" className="sr-only" checked={hsnType === 'goods'} onChange={() => setHsnType('goods')} />
                      Goods (HSN)
                    </label>
                    <label className={`flex-1 flex items-center justify-center border rounded-lg h-10 px-3 cursor-pointer text-sm font-medium transition-all ${
                      hsnType === 'services'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                        : 'border-zinc-200 bg-white text-zinc-500 hover:text-zinc-700'
                    }`}>
                      <input type="radio" name="hsnType" className="sr-only" checked={hsnType === 'services'} onChange={() => setHsnType('services')} />
                      Services (SAC)
                    </label>
                  </div>
                </div>
              </div>

              <div className="w-full">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Description
                </label>
                <Textarea
                  className="w-full border-zinc-200 bg-white focus:border-amber-500 text-zinc-700 placeholder-zinc-400"
                  placeholder="Describe the goods or services..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
                {formErrors.description && <p className="text-xs text-red-700 mt-1">{formErrors.description}</p>}
              </div>

              {!editingHsn && (
                <Select
                  label="GST Tax Rate"
                  value={taxRateId}
                  onChange={(e) => setTaxRateId(e.target.value)}
                  error={formErrors.taxRateId}
                  required
                  options={[
                    { value: '', label: 'Select a tax rate...' },
                    ...taxRatesList.map((rate) => ({
                      value: rate.id,
                      label: `${rate.name} (${parseFloat(rate.ratePercentage)}%)`,
                    })),
                  ]}
                />
              )}

              {editingHsn && (
                <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-xs text-amber-700">
                  💡 To change the GST rate, close this modal and use the <strong>&quot;Change Rate&quot;</strong> button — this ensures rate changes are tracked with history.
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {editingHsn ? 'Update HSN Code' : 'Save HSN Code'}
                </Button>
              </div>
            </form>
        </DialogContent>
      </Dialog>

      {/* ─── Rate Change Modal ──────────────────────────────────────────────── */}
      <Dialog open={rateModalOpen && !!rateChangingHsn} onOpenChange={(open) => !open && setRateModalOpen(false)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Change GST Rate</DialogTitle>
          </DialogHeader>
          {rateChangingHsn && (
            <>
            <p className="text-sm text-zinc-500 mb-4">
              <span className="font-mono font-bold text-zinc-700">{rateChangingHsn.code}</span> — {rateChangingHsn.description.substring(0, 50)}
            </p>

            <div className="flex items-center space-x-2 mb-5">
              <span className="text-xs font-semibold text-zinc-500 uppercase">Current Rate:</span>
              {rateChangingHsn.gstRate ? (
                <Badge className="bg-amber-500/10 text-amber-700 border border-amber-500/20">
                  {parseFloat(rateChangingHsn.gstRate)}%
                </Badge>
              ) : (
                <Badge className="bg-zinc-100 text-zinc-500 border border-zinc-700">Not Set</Badge>
              )}
            </div>

            <form onSubmit={handleRateChange} className="space-y-4">
              <Select
                label="New GST Tax Rate"
                value={newTaxRateId}
                onChange={(e) => setNewTaxRateId(e.target.value)}
                error={formErrors.newTaxRateId}
                required
                options={[
                  { value: '', label: 'Select a tax rate...' },
                  ...taxRatesList.map((rate) => ({
                    value: rate.id,
                    label: `${rate.name} (${parseFloat(rate.ratePercentage)}%)`,
                  })),
                ]}
              />

              <Input
                label="Effective From Date"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                error={formErrors.effectiveFrom}
                required
              />

              <div className="w-full">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Reason / Reference (Optional)
                </label>
                <Textarea
                  className="w-full border-zinc-200 bg-white focus:border-amber-500 text-zinc-700 placeholder-zinc-400"
                  placeholder="e.g. GST Council 52nd meeting notification"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button variant="ghost" type="button" onClick={() => setRateModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>Update Rate</Button>
              </div>
            </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Rate History Modal ─────────────────────────────────────────────── */}
      <Dialog open={historyModalOpen && !!historyHsn} onOpenChange={(open) => !open && setHistoryModalOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {historyHsn && (
            <>
            <DialogHeader className="mb-4">
              <DialogTitle>Rate Change History</DialogTitle>
            </DialogHeader>
              <div>
                <p className="text-sm text-zinc-500">
                  <span className="font-mono font-bold text-zinc-700">{historyHsn.code}</span> — {historyHsn.description.substring(0, 60)}
                </p>
              </div>

            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              </div>
            ) : rateHistory.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                No rate change history found.
              </div>
            ) : (
              <div className="space-y-3">
                {rateHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-zinc-200 bg-white p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-zinc-500 text-xs font-mono">
                          {entry.previousRate !== null ? `${parseFloat(entry.previousRate)}%` : '—'}
                        </span>
                        <span className="text-zinc-500">→</span>
                        <span className="text-amber-700 font-bold text-sm">
                          {parseFloat(entry.newRate)}%
                        </span>
                      </div>
                      <Badge className="bg-zinc-100 text-zinc-500 border border-zinc-700 text-xs">
                        Effective: {new Date(entry.effectiveFrom).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Badge>
                    </div>
                    {entry.reason && (
                      <p className="text-xs text-zinc-500">{entry.reason}</p>
                    )}
                    <p className="text-xs text-zinc-500">
                      Changed on {new Date(entry.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!deleteConfirmHsn}
        onClose={() => setDeleteConfirmHsn(null)}
        onConfirm={executeDelete}
        title="Delete HSN/SAC Code"
        description={`Are you sure you want to delete HSN "${deleteConfirmHsn?.code} — ${deleteConfirmHsn?.description.substring(0, 30)}"?`}
        variant="destructive"
      />
    </div>
  );
}
