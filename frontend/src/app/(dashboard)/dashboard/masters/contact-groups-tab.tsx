'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import type { ContactGroup } from '@/types';
import { contactGroupFormSchema } from '@/schemas/master.schema';
import { ZodError } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type TableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';

export function ContactGroupsTab() {
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
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<ContactGroup | null>(null);

  const { data: groupsData, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['masters-contact-groups', { page, sortBy, sortOrder, search }],
    queryFn: async () => {
      let url = `/masters/contact-groups?page=${page}&limit=10&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (search) url += `&q=${encodeURIComponent(search)}`;
      const res = await api.get(url);
      return res.data;
    },
  });

  const groups = (groupsData?.data || []) as ContactGroup[];
  const pagination = groupsData?.pagination || { page: 1, totalPages: 1 };
  const loading = queryLoading || !!deletingId;
  const error = localError || (queryError ? (queryError as any).response?.data?.message || 'Failed to fetch contact groups' : null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const openAddModal = () => {
    setEditingGroup(null);
    setName('');
    setDescription('');
    setIsActive(true);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (g: ContactGroup) => {
    setEditingGroup(g);
    setName(g.name);
    setDescription(g.description || '');
    setIsActive(g.isActive);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    const payload = {
      name,
      description: description || null,
      isActive,
    };

    try {
      contactGroupFormSchema.parse(payload);

      if (editingGroup) {
        await api.put(`/masters/contact-groups/${editingGroup.id}`, payload);
      } else {
        await api.post('/masters/contact-groups', payload);
      }

      toast.success(editingGroup ? 'Contact Group updated successfully' : 'Contact Group created successfully');
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['masters'], refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: ['contactGroupsSidebar'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['masters-contact-groups'] });
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

  const promptDelete = (g: ContactGroup) => {
    setDeleteConfirmGroup(g);
  };

  const executeDelete = async () => {
    if (!deleteConfirmGroup) return;

    try {
      setDeletingId(deleteConfirmGroup.id);
      setLocalError(null);
      await api.delete(`/masters/contact-groups/${deleteConfirmGroup.id}`);
      toast.success('Contact group deleted successfully');
      setDeleteConfirmGroup(null);
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['masters'], refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: ['contactGroupsSidebar'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['masters-contact-groups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete contact group');
    } finally {
      setDeletingId(null);
    }
  };

  const tableHeaders: TableHeader[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'description', label: 'Description', sortable: true },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', align: 'right' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Contact Groups</h2>
          <p className="text-xs text-zinc-500">Segment customers and vendors into trading groups (e.g., Wholesalers, Key Accounts).</p>
        </div>
        <Button onClick={openAddModal} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-5 rounded-xl shadow-sm">
          + Add Contact Group
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search group name..."
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
          isLoading={loading && groups.length === 0}
          isEmpty={groups.length === 0}
          emptyMessage="No contact groups found."
        >
          {groups.map((g) => (
            <tr key={g.id} className="hover:bg-zinc-50/80 transition-colors border-b border-zinc-100 text-xs">
              <td className="px-6 py-3.5 font-bold text-zinc-900">{g.name}</td>
              <td className="px-6 py-3.5 text-zinc-600">{g.description || '-'}</td>
              <td className="px-6 py-3.5">
                {g.isActive ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">Active</Badge>
                ) : (
                  <Badge className="bg-zinc-100 text-zinc-500 border border-zinc-200 text-[10px]">Inactive</Badge>
                )}
              </td>
              <td className="px-6 py-3.5 text-right space-x-2">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(g)} className="h-7 text-xs">Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => promptDelete(g)} disabled={loading} className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">Delete</Button>
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
              {editingGroup ? 'Edit Master Contact Group' : 'Add Master Contact Group'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Group Name *</label>
              <Input
                placeholder="e.g. Wholesalers, Retailers, Key Accounts"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={formErrors.name}
                required
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Description
              </label>
              <Textarea
                placeholder="Describe group segment or criteria..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border-zinc-200 bg-zinc-50 text-xs text-zinc-800 placeholder-zinc-400 focus:border-amber-500 min-h-[90px] rounded-xl"
              />
              {formErrors.description && <p className="mt-1 text-xs text-red-500">{formErrors.description}</p>}
            </div>

            <div className="flex items-center space-x-3 py-1">
              <input
                type="checkbox"
                id="isActive"
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="isActive" className="text-xs font-bold text-zinc-700">
                Active Contact Group
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-100">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)} className="text-xs">Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-6 rounded-xl shadow-sm">
                {editingGroup ? 'Update Group' : 'Save Group'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!deleteConfirmGroup}
        onClose={() => setDeleteConfirmGroup(null)}
        onConfirm={executeDelete}
        title="Delete Contact Group"
        description={`Are you sure you want to delete the contact group "${deleteConfirmGroup?.name}"? Contacts in this group will be updated to have no group.`}
        variant="destructive"
      />
    </div>
  );
}
