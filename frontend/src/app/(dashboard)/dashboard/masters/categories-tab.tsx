'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import type { Category } from '@/types';
import { categoryFormSchema } from '@/schemas/master.schema';
import { ZodError } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type TableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';

export function CategoriesTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('sortOrder');
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
  const [deleteConfirmCategoryId, setDeleteConfirmCategoryId] = useState<string | null>(null);

  const { data: categoriesData, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['masters-categories', { page, sortBy, sortOrder, search }],
    queryFn: async () => {
      let url = `/masters/categories?page=${page}&limit=10&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (search) url += `&q=${encodeURIComponent(search)}`;
      const res = await api.get(url);
      return res.data;
    },
  });

  const categories = (categoriesData?.data || []) as Category[];
  const pagination = categoriesData?.pagination || { page: 1, totalPages: 1 };
  const loading = queryLoading || !!deletingId;
  const error = localError || (queryError ? (queryError as any).response?.data?.message || 'Failed to fetch categories' : null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [description, setDescription] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const openAddModal = () => {
    setEditingCategory(null);
    setName('');
    setParentId('');
    setDescription('');
    setFormSortOrder('0');
    setIsActive(true);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setParentId(cat.parentId || '');
    setDescription(cat.description || '');
    setFormSortOrder(cat.sortOrder.toString());
    setIsActive(cat.isActive);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    const payload = {
      name,
      parentId: parentId || null,
      description: description || null,
      sortOrder: parseInt(formSortOrder, 10) || 0,
      isActive,
    };

    try {
      // Validate with schema
      categoryFormSchema.parse(payload);

      if (editingCategory) {
        await api.put(`/masters/categories/${editingCategory.id}`, payload);
      } else {
        await api.post('/masters/categories', payload);
      }

      toast.success(editingCategory ? 'Category updated successfully' : 'Category created successfully');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['masters', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['masters-categories-all'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
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
    setDeleteConfirmCategoryId(id);
  };

  const executeDelete = async () => {
    if (!deleteConfirmCategoryId) return;
    try {
      setDeletingId(deleteConfirmCategoryId);
      setLocalError(null);
      await api.delete(`/masters/categories/${deleteConfirmCategoryId}`);
      toast.success('Category deleted successfully');
      setDeleteConfirmCategoryId(null);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['masters', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['masters-categories-all'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: any) {
      setLocalError(err.response?.data?.message || 'Failed to delete category');
    } finally {
      setDeletingId(null);
    }
  };

  const { data: allCategoriesData } = useQuery({
    queryKey: ['masters-categories-all'],
    queryFn: async () => {
      const res = await api.get('/masters/categories?limit=1000');
      return res.data.data;
    },
  });

  const allCategories = (allCategoriesData || []) as Category[];

  // Get parent category name
  const getParentName = (parentUuid?: string | null) => {
    if (!parentUuid) return '-';
    const parent = allCategories.find((c) => c.id === parentUuid) || categories.find((c) => c.id === parentUuid);
    return parent ? parent.name : '-';
  };

  const availableParents = allCategories.filter(
    (c) => !editingCategory || (c.id !== editingCategory.id && c.parentId !== editingCategory.id)
  );

  const tableHeaders: TableHeader[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'slug', label: 'Slug', sortable: true },
    { key: 'parentId', label: 'Parent Category', sortable: true },
    { key: 'sortOrder', label: 'Sort Order', sortable: true, align: 'center' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', align: 'right' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Product Categories</h2>
          <p className="text-xs text-zinc-500">Manage hierarchical category taxonomy for catalog items.</p>
        </div>
        <Button onClick={openAddModal} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-5 rounded-xl shadow-sm">
          + Add Category
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search categories..."
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
          isLoading={loading && categories.length === 0}
          isEmpty={categories.length === 0}
          emptyMessage="No categories found."
        >
          {categories.map((cat) => (
            <tr key={cat.id} className="hover:bg-zinc-50/80 transition-colors border-b border-zinc-100 text-xs">
              <td className="px-6 py-3.5 font-bold text-zinc-900">{cat.name}</td>
              <td className="px-6 py-3.5 text-zinc-500 font-mono text-[11px]">{cat.slug}</td>
              <td className="px-6 py-3.5 text-zinc-600">{getParentName(cat.parentId)}</td>
              <td className="px-6 py-3.5 text-center font-mono font-bold">{cat.sortOrder}</td>
              <td className="px-6 py-3.5">
                {cat.isActive ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">Active</Badge>
                ) : (
                  <Badge className="bg-zinc-100 text-zinc-500 border border-zinc-200 text-[10px]">Inactive</Badge>
                )}
              </td>
              <td className="px-6 py-3.5 text-right space-x-2">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(cat)} className="h-7 text-xs">Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => promptDelete(cat.id)} disabled={loading} className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">Delete</Button>
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
              {editingCategory ? 'Edit Master Category' : 'Add Master Category'}
            </DialogTitle>
          </DialogHeader>
            
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Category Name *</label>
              <Input
                placeholder="e.g. Electronics, Services"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={formErrors.name}
                required
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Parent Category</label>
              <Select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                error={formErrors.parentId}
                options={[
                  { value: '', label: 'None (Top Level Category)' },
                  ...availableParents.map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                ]}
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Description
              </label>
              <Textarea
                className="w-full border-zinc-200 bg-zinc-50 focus:border-amber-500 text-xs text-zinc-800 placeholder-zinc-400 rounded-xl"
                placeholder="Describe category..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Sort Display Order</label>
              <Input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
                error={formErrors.sortOrder}
                className="h-9 text-xs font-mono bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div className="flex items-center space-x-3 py-1">
              <input
                type="checkbox"
                id="isActiveCat"
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="isActiveCat" className="text-xs font-bold text-zinc-700">
                Active Category
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-100">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)} className="text-xs">Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-6 rounded-xl shadow-sm">
                {editingCategory ? 'Update Category' : 'Save Category'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!deleteConfirmCategoryId}
        onClose={() => setDeleteConfirmCategoryId(null)}
        onConfirm={executeDelete}
        title="Delete Category"
        description="Are you sure you want to delete this category? Sub-categories will be unlinked."
        variant="destructive"
      />
    </div>
  );
}
