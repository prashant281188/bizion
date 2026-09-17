'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loader2 } from 'lucide-react';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import type { Brand } from '@/types';
import { brandFormSchema } from '@/schemas/master.schema';
import { ZodError } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type TableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';

export function BrandsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('name');
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
  const [deleteConfirmBrandId, setDeleteConfirmBrandId] = useState<string | null>(null);

  const { data: brandsData, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['masters-brands', { page, sortBy, sortOrder, search }],
    queryFn: async () => {
      let url = `/masters/brands?page=${page}&limit=10&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (search) url += `&q=${encodeURIComponent(search)}`;
      const res = await api.get(url);
      return res.data;
    },
  });

  const brands = (brandsData?.data || []) as Brand[];
  const pagination = brandsData?.pagination || { page: 1, totalPages: 1 };
  const loading = queryLoading || !!deletingId;
  const error = localError || (queryError ? (queryError as any).response?.data?.message || 'Failed to fetch brands' : null);
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const openAddModal = () => {
    setEditingBrand(null);
    setName('');
    setLogoUrl('');
    setDescription('');
    setIsActive(true);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (b: Brand) => {
    setEditingBrand(b);
    setName(b.name);
    setLogoUrl(b.logoUrl || '');
    setDescription(b.description || '');
    setIsActive(b.isActive);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setLocalError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/media/upload', formData, {
        headers: {
          'Content-Type': undefined,
        },
      });

      const { url } = response.data.data;
      setLogoUrl(url);
    } catch (err: any) {
      console.error('Upload failed', err);
      toast.error(err.response?.data?.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!logoUrl) return;
    const urlToDelete = logoUrl;
    setLogoUrl('');
    
    // Only attempt to delete from S3 if it's an uploaded file
    if (urlToDelete.startsWith('http://localhost') || urlToDelete.includes('amazonaws.com')) {
      try {
        await api.delete('/media', { params: { url: urlToDelete } });
      } catch (err) {
        console.error('Failed to delete logo from S3', err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    const payload = {
      name,
      logoUrl: logoUrl || null,
      description: description || null,
      isActive,
    };

    try {
      brandFormSchema.parse(payload);

      if (editingBrand) {
        await api.put(`/masters/brands/${editingBrand.id}`, payload);
      } else {
        await api.post('/masters/brands', payload);
      }

      toast.success(editingBrand ? 'Brand updated successfully' : 'Brand created successfully');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['masters', 'brands'] });
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

  const promptDelete = (id: string) => {
    setDeleteConfirmBrandId(id);
  };

  const executeDelete = async () => {
    if (!deleteConfirmBrandId) return;

    try {
      setDeletingId(deleteConfirmBrandId);
      setLocalError(null);
      await api.delete(`/masters/brands/${deleteConfirmBrandId}`);
      toast.success('Brand deleted successfully');
      setDeleteConfirmBrandId(null);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['masters', 'brands'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete brand');
    } finally {
      setDeletingId(null);
    }
  };

  const tableHeaders: TableHeader[] = [
    { key: 'logo', label: 'Logo', sortable: true },
    { key: 'name', label: 'Brand Name', sortable: true },
    { key: 'slug', label: 'Slug', sortable: true },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', align: 'right' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Product Brands</h2>
          <p className="text-xs text-zinc-500">Manage manufacturers and product brand portfolios.</p>
        </div>
        <Button onClick={openAddModal} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-5 rounded-xl shadow-sm">
          + Add Brand
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search brands..."
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
          isLoading={loading && brands.length === 0}
          isEmpty={brands.length === 0}
          emptyMessage="No brands found."
        >
          {brands.map((b) => (
            <tr key={b.id} className="hover:bg-zinc-50/80 transition-colors border-b border-zinc-100 text-xs">
              <td className="px-6 py-3.5">
                {b.logoUrl ? (
                  <img src={b.logoUrl} alt={b.name} className="h-8 w-8 object-contain rounded-xl bg-white border border-zinc-200 p-0.5" />
                ) : (
                  <div className="h-8 w-8 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-600">
                    {b.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
              </td>
              <td className="px-6 py-3.5 font-bold text-zinc-900">{b.name}</td>
              <td className="px-6 py-3.5 text-zinc-500 font-mono text-[11px]">{b.slug}</td>
              <td className="px-6 py-3.5">
                {b.isActive ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">Active</Badge>
                ) : (
                  <Badge className="bg-zinc-100 text-zinc-500 border border-zinc-200 text-[10px]">Inactive</Badge>
                )}
              </td>
              <td className="px-6 py-3.5 text-right space-x-2">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(b)} className="h-7 text-xs">Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => promptDelete(b.id)} disabled={loading} className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">Delete</Button>
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
              {editingBrand ? 'Edit Master Brand' : 'Add Master Brand'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Brand Name *</label>
              <Input
                placeholder="e.g. Apple, Samsung, Nike"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={formErrors.name}
                required
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div className="w-full space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                Brand Logo
              </label>
              <div className="flex items-start space-x-4">
                {logoUrl ? (
                  <div className="relative group shrink-0">
                    <div className="h-20 w-20 rounded-2xl overflow-hidden border border-zinc-200 bg-white flex items-center justify-center p-1">
                      <img src={logoUrl} alt={name || 'Brand logo'} className="max-h-full max-w-full object-contain" />
                    </div>
                    <Button variant="ghost"
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-full p-1 border border-red-200 shadow-sm transition-colors"
                      title="Remove Logo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="relative h-20 w-full rounded-2xl border-2 border-dashed border-zinc-200 hover:border-amber-500/50 flex flex-col items-center justify-center bg-zinc-50 transition-colors group overflow-hidden">
                      {uploading ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                          <span className="text-xs text-zinc-500">Uploading...</span>
                        </div>
                      ) : (
                        <>
                          <svg className="w-6 h-6 text-zinc-400 group-hover:text-amber-600 transition-colors mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          <span className="text-xs text-zinc-500 font-medium">Click to upload logo image</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFileUpload}
                            disabled={uploading}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Description
              </label>
              <Textarea
                className="w-full border-zinc-200 bg-zinc-50 focus:border-amber-500 text-xs text-zinc-800 placeholder-zinc-400 rounded-xl"
                placeholder="Describe brand portfolio..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-3 py-1">
              <input
                type="checkbox"
                id="isActiveBrand"
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="isActiveBrand" className="text-xs font-bold text-zinc-700">
                Active Brand
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-100">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)} className="text-xs">Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-6 rounded-xl shadow-sm">
                {editingBrand ? 'Update Brand' : 'Save Brand'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!deleteConfirmBrandId}
        onClose={() => setDeleteConfirmBrandId(null)}
        onConfirm={executeDelete}
        title="Delete Brand"
        description="Are you sure you want to delete this brand? Products linked to it will be unlinked."
        variant="destructive"
      />
    </div>
  );
}
