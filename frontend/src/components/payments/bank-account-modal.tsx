import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import type { BankAccount } from '@/types';
import { createBankAccountSchema } from '@/schemas/payment.schema';
import { ZodError } from 'zod';

export function BankAccountModal({
  isOpen,
  onClose,
  editingAccount,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  editingAccount: BankAccount | null;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branch, setBranch] = useState('');
  const [accountType, setAccountType] = useState('savings');
  const [upiId, setUpiId] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormErrors({});
      if (editingAccount) {
        setAccountName(editingAccount.accountName);
        setBankName(editingAccount.bankName || '');
        setAccountNumber(editingAccount.accountNumber || '');
        setIfscCode(editingAccount.ifscCode || '');
        setBranch(editingAccount.branch || '');
        setAccountType(editingAccount.accountType || 'savings');
        setUpiId(editingAccount.upiId || '');
        setOpeningBalance(editingAccount.openingBalance ? editingAccount.openingBalance.toString() : '0');
        setIsDefault(editingAccount.isDefault);
      } else {
        setAccountName('');
        setBankName('');
        setAccountNumber('');
        setIfscCode('');
        setBranch('');
        setAccountType('savings');
        setUpiId('');
        setOpeningBalance('0');
        setIsDefault(false);
      }
    }
  }, [isOpen, editingAccount]);

  const handleSaveBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    
    try {
      const payload = {
        accountName,
        bankName,
        accountNumber,
        ifscCode,
        branch,
        accountType,
        upiId,
        openingBalance: Number(openingBalance),
        isDefault
      };
      
      createBankAccountSchema.parse(payload);
      
      setSubmitting(true);
      if (editingAccount) {
        await api.put(`/payments/bank-accounts/${editingAccount.id}`, payload);
        toast.success('Register updated successfully');
      } else {
        await api.post('/payments/bank-accounts', payload);
        toast.success('Register created successfully');
      }
      
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {};
        err.issues.forEach((e: any) => {
          if (e.path[0]) errors[e.path[0] as string] = e.message;
        });
        setFormErrors(errors);
        toast.error('Please check the form for errors');
      } else {
        toast.error(err.response?.data?.message || 'Failed to save register');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const ACCOUNT_TYPE_OPTIONS = [
    { value: 'current', label: 'Current' },
    { value: 'savings', label: 'Savings' },
    { value: 'cash', label: 'Cash Register' },
    { value: 'credit', label: 'Credit / Loan' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-4">
        <DialogHeader className="border-b border-zinc-100 pb-3 space-y-1">
          <DialogTitle className="text-base font-bold text-zinc-900">
            {editingAccount ? 'Edit Bank / Cash Register' : 'New Bank or Cash Register'}
          </DialogTitle>
          <p className="text-xs text-zinc-500">Configure bank account details for settlement & printed invoices.</p>
        </DialogHeader>

        <form onSubmit={handleSaveBankAccount} className="space-y-4">
          {/* Segmented Account Type */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">Account Type *</label>
            <div className="grid grid-cols-4 gap-1.5 bg-zinc-100 p-1 rounded-xl">
              {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAccountType(opt.value)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    accountType === opt.value
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Register Account Name *"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="e.g. HDFC Main Current Account"
            required
            autoFocus
            className="h-[38px] text-xs font-medium"
          />
          {formErrors.accountName && <p className="mt-1 text-xs text-red-500">{formErrors.accountName}</p>}

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Bank Name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. HDFC Bank"
              className="h-[38px] text-xs"
            />
            <Input
              label="Account Number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. 501002931002"
              className="h-[38px] text-xs font-mono"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="IFSC Code"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
              placeholder="e.g. HDFC0001201"
              maxLength={11}
              className="h-[38px] text-xs font-mono uppercase"
            />
            <Input
              label="Branch Office"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="e.g. Fort Branch, Mumbai"
              className="h-[38px] text-xs"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="UPI Virtual Address ID"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. company@okhdfc"
              className="h-[38px] text-xs"
            />
            <Input
              label="Opening Balance (₹)"
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              min={0}
              disabled={!!editingAccount}
              className="h-[38px] text-xs font-mono"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl mt-2">
            <div>
              <p className="text-xs font-bold text-zinc-800">Set as Primary Settlement Register</p>
              <p className="text-[11px] text-zinc-500">Auto-selected on invoice payment receipts.</p>
            </div>
            <input
              type="checkbox"
              id="isDefaultAccount"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs font-semibold border-zinc-200 hover:bg-zinc-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-sm transition-all"
            >
              {submitting ? 'Saving Register...' : editingAccount ? 'Update Register' : 'Create Register'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
