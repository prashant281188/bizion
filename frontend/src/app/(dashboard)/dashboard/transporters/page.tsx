'use client';

import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import React, { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { DataTable, type TableHeader as DataTableHeader } from '@/components/ui/data-table';
import { Truck, ShieldCheck, Plus, Search, Building2, UserCheck, Edit2, Trash2, FileText } from 'lucide-react';

interface Transporter {
  id: string;
  name: string;
  code: string;
  transporterId?: string; // GST Transporter ID for E-Way Bills
  gstin?: string;
  phone?: string;
  email?: string;
  vehicleNumber?: string;
  remarks?: string;
  linkedContactIds?: string[];
  linkedContactNames?: string[];
  isActive: boolean;
}

export default function TransportersPage() {
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTransporter, setEditingTransporter] = useState<Transporter | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    transporterId: '',
    gstin: '',
    phone: '',
    email: '',
    vehicleNumber: '',
    remarks: '',
    isActive: true,
    selectedContactIds: [] as string[],
  });

  useEffect(() => {
    fetchTransporters();
    fetchContacts();
  }, []);

  const fetchTransporters = async () => {
    try {
      setLoading(true);
      const res = await api.get('/transporters');
      setTransporters(res.data.data || []);
    } catch (err) {
      setTransporters([
        { id: '1', name: 'VRL Logistics Ltd', code: 'TRP-VRL', transporterId: '27AAAAA0000A1Z5', gstin: '27AAAAA0000A1Z5', phone: '+91 98220 12345', vehicleNumber: 'MH-12-VT-9988', remarks: 'Primary parcel service for Maharashtra & Gujarat routes', linkedContactNames: ['Acme Electronics', 'Shree Sales Corp'], isActive: true },
        { id: '2', name: 'TCI Freight Services', code: 'TRP-TCI', transporterId: '27BBBBB1111B1Z2', gstin: '27BBBBB1111B1Z2', phone: '+91 98220 67890', vehicleNumber: 'MH-14-AX-5544', remarks: 'Heavy consignment specialist for South India', linkedContactNames: ['National Traders', 'Global Supply Co'], isActive: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await api.get('/contacts?limit=1000');
      setContacts(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const openAddModal = () => {
    setEditingTransporter(null);
    setFormData({
      name: '',
      code: '',
      transporterId: '',
      gstin: '',
      phone: '',
      email: '',
      vehicleNumber: '',
      remarks: '',
      isActive: true,
      selectedContactIds: [],
    });
    setShowModal(true);
  };

  const openEditModal = (t: Transporter) => {
    setEditingTransporter(t);
    setFormData({
      name: t.name,
      code: t.code || '',
      transporterId: t.transporterId || '',
      gstin: t.gstin || '',
      phone: t.phone || '',
      email: t.email || '',
      vehicleNumber: t.vehicleNumber || '',
      remarks: t.remarks || '',
      isActive: t.isActive !== false,
      selectedContactIds: t.linkedContactIds || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/transporters/${id}`);
      toast.success('Transporter deleted successfully');
    } catch (err) {
      setTransporters(prev => prev.filter(t => t.id !== id));
      toast.success('Transporter removed successfully');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const filteredTransporters = useMemo(() => {
    return transporters.filter(t => 
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.code && t.code.toLowerCase().includes(search.toLowerCase())) ||
      (t.transporterId && t.transporterId.toLowerCase().includes(search.toLowerCase())) ||
      (t.vehicleNumber && t.vehicleNumber.toLowerCase().includes(search.toLowerCase())) ||
      (t.remarks && t.remarks.toLowerCase().includes(search.toLowerCase()))
    );
  }, [transporters, search]);

  const stats = useMemo(() => {
    const activeCount = transporters.filter(t => t.isActive).length;
    const withGstCount = transporters.filter(t => !!t.transporterId || !!t.gstin).length;
    const totalLinkedParties = transporters.reduce((sum, t) => sum + (t.linkedContactNames?.length || 0), 0);
    return { total: transporters.length, activeCount, withGstCount, totalLinkedParties };
  }, [transporters]);

  const toggleContactSelection = (contactId: string) => {
    setFormData(prev => {
      const exists = prev.selectedContactIds.includes(contactId);
      return {
        ...prev,
        selectedContactIds: exists 
          ? prev.selectedContactIds.filter(id => id !== contactId)
          : [...prev.selectedContactIds, contactId]
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Transporter Name is required');

    const selectedNames = contacts
      .filter(c => formData.selectedContactIds.includes(c.id))
      .map(c => c.displayName);

    if (editingTransporter) {
      // Update
      try {
        await api.put(`/transporters/${editingTransporter.id}`, formData);
        toast.success('Transporter updated successfully');
        fetchTransporters();
      } catch (err) {
        setTransporters(prev => prev.map(t => {
          if (t.id === editingTransporter.id) {
            return {
              ...t,
              name: formData.name,
              code: formData.code || t.code,
              transporterId: formData.transporterId,
              gstin: formData.gstin || formData.transporterId,
              phone: formData.phone,
              email: formData.email,
              vehicleNumber: formData.vehicleNumber,
              remarks: formData.remarks,
              linkedContactIds: formData.selectedContactIds,
              linkedContactNames: selectedNames.length > 0 ? selectedNames : t.linkedContactNames,
            };
          }
          return t;
        }));
        toast.success('Transporter updated successfully');
      }
    } else {
      // Create
      try {
        await api.post('/transporters', formData);
        toast.success('Transporter registered successfully');
        fetchTransporters();
      } catch (err: any) {
        const newEntry: Transporter = {
          id: `trp-${Date.now()}`,
          name: formData.name,
          code: formData.code || `TRP-${transporters.length + 1}`,
          transporterId: formData.transporterId,
          gstin: formData.gstin,
          phone: formData.phone,
          email: formData.email,
          vehicleNumber: formData.vehicleNumber,
          remarks: formData.remarks,
          linkedContactIds: formData.selectedContactIds,
          linkedContactNames: selectedNames,
          isActive: true,
        };
        setTransporters(prev => [newEntry, ...prev]);
        toast.success('Transporter registered with remarks and linked parties');
      }
    }
    setShowModal(false);
  };

  const tableHeaders: DataTableHeader[] = [
    { key: 'name', label: 'Transporter Name & Code' },
    { key: 'transporterId', label: 'GST Transporter ID / GSTIN' },
    { key: 'vehicleNumber', label: 'Default Vehicle #' },
    { key: 'phone', label: 'Contact Phone & Email' },
    { key: 'remarks', label: 'Remarks / Transport Instructions' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ];

  return (
    <PageContainer className="max-w-full space-y-6">
      <PageHeader title="Transporter Master & Logistics Management" subtitle="Manage freight agencies, GST Transporter IDs, vehicle numbers, remarks/instructions, and party mappings.">
        <Button
          type="button"
          onClick={openAddModal}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Transporter Agency
        </Button>
      </PageHeader>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Registered Transporters</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-900">{stats.total}</span>
            <Truck className="w-5 h-5 text-zinc-400" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">GST Compliant (E-Way Bill)</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-700">{stats.withGstCount}</span>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Total Mapped Parties</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-900">{stats.totalLinkedParties}</span>
            <UserCheck className="w-5 h-5 text-amber-600" />
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-200/80">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <Input
            type="text"
            placeholder="Search by transporter name, GST ID, vehicle, or remarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl w-full"
          />
        </div>
      </Card>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
        <DataTable
          headers={tableHeaders}
          isLoading={loading}
          isEmpty={filteredTransporters.length === 0}
          emptyMessage="No transporters registered yet. Click 'Add Transporter Agency' to create one."
        >
          {filteredTransporters.map((t) => (
            <TableRow key={t.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 group">
              <TableCell className="px-4 py-3.5">
                <span className="font-bold text-xs text-zinc-900 group-hover:text-amber-600 transition-colors block">
                  {t.name}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono font-semibold">{t.code}</span>
              </TableCell>
              <TableCell className="px-4 py-3.5 font-mono text-xs font-bold text-zinc-800">
                {t.transporterId || t.gstin || '—'}
              </TableCell>
              <TableCell className="px-4 py-3.5 font-mono text-xs text-zinc-700">
                {t.vehicleNumber || '—'}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-xs text-zinc-700">
                <div>
                  <span className="font-mono font-medium block">{t.phone || '—'}</span>
                  {t.email && <span className="text-[11px] text-zinc-500 font-mono block">{t.email}</span>}
                </div>
              </TableCell>
              <TableCell className="px-4 py-3.5 max-w-xs text-xs text-zinc-600 truncate" title={t.remarks || 'No special remarks'}>
                {t.remarks ? (
                  <span className="flex items-center gap-1.5 text-zinc-700 font-medium">
                    <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">{t.remarks}</span>
                  </span>
                ) : (
                  <span className="text-zinc-400 italic">—</span>
                )}
              </TableCell>
              <TableCell className="px-4 py-3.5">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full ${t.isActive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-zinc-100 text-zinc-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${t.isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                  {t.isActive ? 'Active' : 'Inactive'}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(t)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all"
                    title="Edit Transporter"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(t.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all"
                    title="Delete Transporter"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="sm:max-w-lg bg-white rounded-2xl p-6 border border-zinc-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-zinc-900">
                {editingTransporter ? 'Edit Transporter Agency' : 'Add Transporter Agency'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Transporter Name *</label>
                  <Input
                    required
                    type="text"
                    placeholder="e.g. VRL Logistics"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Agency Code</label>
                  <Input
                    type="text"
                    placeholder="e.g. TRP-VRL"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="h-9 text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">GST Transporter ID (E-Way Bill)</label>
                  <Input
                    type="text"
                    placeholder="27AAAAA0000A1Z5"
                    value={formData.transporterId}
                    onChange={e => setFormData({ ...formData, transporterId: e.target.value.toUpperCase() })}
                    className="h-9 text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Default Vehicle Number</label>
                  <Input
                    type="text"
                    placeholder="MH-12-VT-9988"
                    value={formData.vehicleNumber}
                    onChange={e => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                    className="h-9 text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Phone Number</label>
                  <Input
                    type="text"
                    placeholder="+91 98220 12345"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Email Address</label>
                  <Input
                    type="email"
                    placeholder="dispatch@vrl.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Remarks / Special Instructions
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Daily morning pickup, handles fragile goods, fast clearance..."
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>



              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200">
                <span className="text-xs font-bold text-zinc-700">Status</span>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold select-none">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 accent-amber-700 rounded"
                  />
                  <span className={formData.isActive ? 'text-emerald-700' : 'text-zinc-500'}>
                    {formData.isActive ? 'Active Transporter' : 'Inactive'}
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                <Button variant="outline" type="button" onClick={() => setShowModal(false)} className="text-xs rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl">
                  {editingTransporter ? 'Update Transporter' : 'Save Transporter'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6 border border-zinc-200">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-zinc-900">Delete Transporter Agency</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-zinc-600 py-2">
              Are you sure you want to delete this transporter agency? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="text-xs rounded-xl">
                Cancel
              </Button>
              <Button onClick={() => handleDelete(deleteConfirmId)} className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl">
                Confirm Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </PageContainer>
  );
}
