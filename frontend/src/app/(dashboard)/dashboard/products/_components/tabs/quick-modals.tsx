'use client';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Category } from '@/types';

export interface QuickCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  name: string;
  setName: (v: string) => void;
  parentId: string;
  setParentId: (v: string) => void;
  categories: Category[];
  description: string;
  setDescription: (v: string) => void;
  saving: boolean;
}

export function QuickCategoryModal({
  isOpen, onClose, error, onSubmit,
  name, setName, parentId, setParentId, categories,
  description, setDescription, saving
}: QuickCategoryModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6 shadow-xl border border-zinc-200/80">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-zinc-900">
            Add Master Category
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Category Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Electronics, Hardware, Apparel"
              required
              className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Parent Category</label>
            <Select
              value={parentId}
              onChange={(e: any) => setParentId(e.target.value)}
              options={[
                { label: 'No Parent (Root Category)', value: '' },
                ...categories.map(c => ({ label: c.name, value: c.id }))
              ]}
              className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Description
            </label>
            <textarea
              placeholder="Describe this category hierarchy..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:border-amber-500 focus:bg-white focus:outline-none transition min-h-[70px]"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-6 rounded-xl shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Category'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


export interface QuickBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  saving: boolean;
}

export function QuickBrandModal({
  isOpen, onClose, error, onSubmit,
  name, setName, description, setDescription, saving
}: QuickBrandModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6 shadow-xl border border-zinc-200/80">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-zinc-900">
            Add Master Brand
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Brand Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apple, Samsung, Nike"
              required
              className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Description
            </label>
            <textarea
              placeholder="Describe brand portfolio..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:border-amber-500 focus:bg-white focus:outline-none transition min-h-[70px]"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-6 rounded-xl shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Brand'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface QuickSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  displayName: string;
  setDisplayName: (v: string) => void;
  companyName: string;
  setCompanyName: (v: string) => void;
  contactPerson: string;
  setContactPerson: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  gstin: string;
  setGstin: (v: string) => void;
  saving: boolean;
}

export function QuickSupplierModal({
  isOpen, onClose, error, onSubmit,
  displayName, setDisplayName,
  companyName, setCompanyName,
  contactPerson, setContactPerson,
  phone, setPhone,
  email, setEmail,
  gstin, setGstin,
  saving
}: QuickSupplierModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white rounded-2xl p-6 shadow-xl border border-zinc-200/80">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-zinc-900">
            Add Master Preferred Supplier (Vendor)
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Supplier Display Name *</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Apex Hardware Supplies"
              required
              className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Company Name</label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Apex Hardware Pvt Ltd"
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Contact Person</label>
              <Input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Phone</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98220 12345"
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendor@apex.com"
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">GSTIN</label>
              <Input
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="27AAAAA0000A1Z5"
                className="h-9 text-xs font-mono uppercase bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-6 rounded-xl shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Supplier'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
