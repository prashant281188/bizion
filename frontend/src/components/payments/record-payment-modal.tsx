import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { createPaymentSchema } from '@/schemas/payment.schema';
import { ZodError } from 'zod';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'imps', label: 'IMPS' },
  { value: 'demand_draft', label: 'Demand Draft' },
  { value: 'online', label: 'Online Payment' },
  { value: 'other', label: 'Other' },
];

const DIRECTION_OPTIONS = [
  { value: 'inbound', label: 'Inbound (Receipt)' },
  { value: 'outbound', label: 'Outbound (Payment)' },
];

export function RecordPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  contacts,
  accounts,
  initialContactId,
  initialInvoiceId,
  initialAmount,
  editPayment,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contacts: any[];
  accounts: any[];
  initialContactId?: string;
  initialInvoiceId?: string;
  initialAmount?: number;
  editPayment?: any;
}) {
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('inbound');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [contactId, setContactId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('bank_transfer');
  const [bankAccountId, setBankAccountId] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [status, setStatus] = useState('completed');
  const [notes, setNotes] = useState('');
  const [allocations, setAllocations] = useState<any[]>([]);
  const [clientInvoices, setClientInvoices] = useState<any[]>([]);
  const [financialYears, setFinancialYears] = useState<any[]>([]);
  const [paymentPrefix, setPaymentPrefix] = useState('');
  const [paymentSequence, setPaymentSequence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (editPayment) {
        setDirection(editPayment.direction);
        setPaymentDate(editPayment.paymentDate ? new Date(editPayment.paymentDate).toISOString().split('T')[0] : '');
        setContactId(editPayment.contactId || '');
        setAmount(editPayment.amount ? editPayment.amount.toString() : '');
        setPaymentMode(editPayment.paymentMode || 'cheque');
        setBankAccountId(editPayment.bankAccountId || '');
        setTransactionRef(editPayment.transactionRef || '');
        setChequeDate(editPayment.chequeDate ? new Date(editPayment.chequeDate).toISOString().split('T')[0] : '');
        setStatus(editPayment.status || 'pending');
        setNotes(editPayment.notes || '');
        setAllocations([]);
        setClientInvoices([]);
      } else {
        setDirection('inbound');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setContactId(initialContactId || '');
        setAmount(initialAmount ? initialAmount.toString() : '');
        setPaymentMode('bank_transfer');
        setBankAccountId('');
        setTransactionRef('');
        setChequeDate('');
        setStatus('completed');
        setNotes('');
        setAllocations([]);
        setClientInvoices([]);
      }
      setFormErrors({});

      if (!editPayment) {
        // Fetch organization settings to get financial years
        api.get('/organizations/me').then((res) => {
          const orgData = res.data.data;
          const fys = orgData.settings?.financialYears || [];
          setFinancialYears(fys);
          
          if (fys.length > 0) {
            // Find active FY
            const activeFy = fys.find((f: any) => f.isActive !== false) || fys[0];
            
            // If direction is not explicitly passed, we assume inbound. If the parent passes initialDirection, we'd use it, but currently it defaults to inbound.
            const currentDir = 'inbound'; 
            
            let defaultPrefix = activeFy.prefixes?.[currentDir];
            if (!defaultPrefix) {
               defaultPrefix = currentDir === 'inbound' ? `REC/${activeFy.label}/` : `PAY/${activeFy.label}/`;
            }
            
            setPaymentPrefix(defaultPrefix);
            
            api.get(`/payments/next-number?direction=inbound&prefix=${encodeURIComponent(defaultPrefix)}`)
              .then((nextRes) => {
                const fullNum = nextRes.data.data.paymentNumber || '';
                if (fullNum.startsWith(defaultPrefix)) {
                  setPaymentSequence(fullNum.substring(defaultPrefix.length));
                }
              }).catch(console.error);
          } else {
             // Fallback default
             api.get('/payments/next-number?direction=inbound')
              .then((nextRes) => {
                const fullNum = nextRes.data.data.paymentNumber || '';
                setPaymentPrefix('');
                setPaymentSequence(fullNum);
              }).catch(console.error);
          }
        }).catch(console.error);
      }
    }
  }, [isOpen, initialContactId, initialAmount, editPayment]);

  const fetchOutstandingInvoices = async (cid: string, dir: 'inbound' | 'outbound') => {
    try {
      // For inbound (receipt from customer): show sales_invoice and debit_note only.
      // Credit notes are NOT included here — they are applied separately via "Apply Credit Note".
      const docTypes = dir === 'inbound' ? 'sales_invoice,debit_note' : 'purchase_invoice';
      const res = await api.get(`/invoices?contactId=${cid}&status=approved,sent,partially_paid,overdue&type=${docTypes}&limit=50&sortBy=invoiceDate&sortOrder=asc`);
      const invs = res.data.data || [];
      const existingAllocs = editPayment?.allocations || [];

      // Combine fetched invoices with existing allocations
      // If an invoice is fully paid by this payment, it might not be in `invs` (because status is 'paid').
      // We need to make sure all invoices from existingAllocs are included in the list.
      const outstandingMap = new Map(invs.map((i: any) => [i.id, i]));
      
      existingAllocs.forEach((ea: any) => {
        if (!outstandingMap.has(ea.invoiceId)) {
          // Add it! 
          // balanceDue before payment was amountApplied + current balanceDue
          outstandingMap.set(ea.invoiceId, {
            id: ea.invoiceId,
            invoiceNumber: ea.invoiceNumber,
            balanceDue: Number(ea.amountApplied), // current balance is 0 since it didn't come in outstanding
          });
        } else {
          // Add the previously applied amount back to the balance due to show the "original" balance due before this payment
          const inv = outstandingMap.get(ea.invoiceId) as any;
          if (inv) inv.balanceDue = Number(inv.balanceDue) + Number(ea.amountApplied);
        }
      });

      const combinedInvs = Array.from(outstandingMap.values());
      setClientInvoices(combinedInvs);
      
      setAllocations(
        combinedInvs.map((i: any) => {
          const isInitial = initialInvoiceId === i.id;
          const existing = existingAllocs.find((ea: any) => ea.invoiceId === i.id);
          return {
            invoiceId: i.id,
            invoiceNumber: i.invoiceNumber,
            balanceDue: Number(i.balanceDue),
            amountApplied: existing ? Number(existing.amountApplied) : (isInitial ? (initialAmount || Number(i.balanceDue)) : 0),
          };
        })
      );
    } catch (err) {
      console.error('Failed to fetch outstanding invoices', err);
    }
  };

  useEffect(() => {
    if (contactId) {
      fetchOutstandingInvoices(contactId, direction);
    } else {
      setClientInvoices([]);
      setAllocations([]);
    }
  }, [contactId, direction]);

  const handleAutoAllocate = () => {
    const totalAmount = parseFloat(amount) || 0;
    if (totalAmount <= 0) return;

    let remaining = totalAmount;
    const updated = allocations.map((alloc) => {
      if (remaining <= 0) {
        return { ...alloc, amountApplied: 0 };
      }
      const applied = Math.min(remaining, alloc.balanceDue);
      remaining -= applied;
      return { ...alloc, amountApplied: applied };
    });

    setAllocations(updated);
  };

  const handleAllocationChange = (index: number, val: string) => {
    const value = parseFloat(val) || 0;
    setAllocations((prev) => {
      const copy = [...prev];
      copy[index].amountApplied = Math.min(value, copy[index].balanceDue);
      
      // Automatically update the global amount received/paid to match the sum of all allocations
      const newTotal = copy.reduce((sum, item) => sum + (Number(item.amountApplied) || 0), 0);
      setAmount(newTotal > 0 ? newTotal.toString() : '');
      
      return copy;
    });
  };

  const handleToggleInvoice = (index: number, checked: boolean) => {
    setAllocations((prev) => {
      const copy = [...prev];
      copy[index].amountApplied = checked ? copy[index].balanceDue : 0;
      
      // Automatically update the global amount received/paid to match the sum of all allocations
      const newTotal = copy.reduce((sum, item) => sum + (Number(item.amountApplied) || 0), 0);
      setAmount(newTotal > 0 ? newTotal.toString() : '');
      
      return copy;
    });
  };

  const allocatedSum = allocations.reduce((sum, item) => sum + (Number(item.amountApplied) || 0), 0);
  const unallocatedAmount = Math.max(0, (parseFloat(amount) || 0) - allocatedSum);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    const payload = {
      paymentDate,
      paymentNumber: paymentPrefix + paymentSequence,
      direction,
      contactId,
      amount: parseFloat(amount) || 0,
      paymentMode,
      status,
      chequeDate: paymentMode === 'cheque' && chequeDate ? chequeDate : null,
      bankAccountId: bankAccountId || null,
      transactionRef: transactionRef || null,
      notes: notes || null,
      allocations: allocations
        .filter((a) => Number(a.amountApplied) > 0)
        .map((a) => ({
          invoiceId: a.invoiceId,
          amountApplied: Number(a.amountApplied),
        })),
    };

    try {
      if (editPayment) {
        const updatePayload = {
          status,
          chequeDate: paymentMode === 'cheque' && chequeDate ? chequeDate : null,
          paymentDate,
          allocations: payload.allocations
        };
        await api.patch(`/payments/${editPayment.id}/status`, updatePayload);
        toast.success('Payment updated successfully');
      } else {
        createPaymentSchema.parse(payload);
        await api.post('/payments', payload);
        toast.success('Payment recorded successfully');
      }
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
        toast.error(err.response?.data?.message || 'Failed to record payment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-zinc-900">
            {editPayment ? 'Edit Cheque Details' : 'Record Payment'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleRecordPayment} className="space-y-4">
          {/* Segmented Direction Selector */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">Transaction Direction *</label>
            <div className="grid grid-cols-2 gap-2 bg-zinc-100 p-1 rounded-xl">
              {DIRECTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={!!editPayment}
                  onClick={() => {
                    const newDir = opt.value as 'inbound' | 'outbound';
                    setDirection(newDir);
                    if (!editPayment && financialYears.length > 0) {
                      const activeFy = financialYears.find(fy => fy.isActive !== false) || financialYears[0];
                      const newPrefix = activeFy.prefixes?.[newDir] || (newDir === 'inbound' ? `REC/${activeFy.label}/` : `PAY/${activeFy.label}/`);
                      setPaymentPrefix(newPrefix);
                      api.get(`/payments/next-number?direction=${newDir}&prefix=${encodeURIComponent(newPrefix)}`)
                        .then((res) => {
                          const fullNum = res.data.data.paymentNumber || '';
                          if (fullNum.startsWith(newPrefix)) {
                            setPaymentSequence(fullNum.substring(newPrefix.length));
                          }
                        }).catch(console.error);
                    }
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    direction === opt.value
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Payment Date *"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="h-[38px] text-xs"
            />
            {financialYears.filter(fy => fy.isActive !== false).length > 0 && (
              <Select
                label="Financial Year"
                value={financialYears.find(fy => fy.prefixes?.[direction] === paymentPrefix || (`REC/${fy.label}/` === paymentPrefix) || (`PAY/${fy.label}/` === paymentPrefix))?.label || ''}
                onChange={(e: any) => {
                  const selectedLabel = e.target.value;
                  const selectedFy = financialYears.find(fy => fy.label === selectedLabel);
                  if (selectedFy) {
                    const newPrefix = selectedFy.prefixes?.[direction] || (direction === 'inbound' ? `REC/${selectedFy.label}/` : `PAY/${selectedFy.label}/`);
                    setPaymentPrefix(newPrefix);
                    api.get(`/payments/next-number?direction=${direction}&prefix=${encodeURIComponent(newPrefix)}`)
                      .then((res) => {
                        const fullNum = res.data.data.paymentNumber || '';
                        if (fullNum.startsWith(newPrefix)) {
                          setPaymentSequence(fullNum.substring(newPrefix.length));
                        }
                      }).catch(console.error);
                  }
                }}
                options={financialYears.filter(fy => fy.isActive !== false).map(fy => ({
                  label: fy.label,
                  value: fy.label
                }))}
                disabled={!!editPayment}
              />
            )}
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500">Payment Number *</label>
              <div className="flex">
                <input
                  type="text"
                  value={paymentPrefix}
                  onChange={(e) => setPaymentPrefix(e.target.value)}
                  className="w-1/2 flex-1 rounded-l-md border border-r-0 border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  placeholder="PREFIX/"
                  disabled={!!editPayment}
                />
                <input
                  type="text"
                  value={paymentSequence}
                  onChange={(e) => setPaymentSequence(e.target.value)}
                  className="w-1/2 flex-1 rounded-r-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  placeholder="1"
                  required
                  disabled={!!editPayment}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="w-full">
              <SearchableSelect
                label={direction === 'inbound' ? 'Select Customer *' : 'Select Vendor *'}
                placeholder={direction === 'inbound' ? 'Search customer by name or phone...' : 'Search vendor by name or phone...'}
                value={contactId}
                onChange={(val) => setContactId(val)}
                required
                error={formErrors.contactId}
                disabled={!!editPayment}
                options={contacts
                  .filter((c) => direction === 'inbound' ? c.type !== 'vendor' : c.type !== 'customer')
                  .map((c) => {
                    const isDeactivated = c.isActive === false;
                    return {
                      value: c.id,
                      label: `${c.displayName || c.companyName || 'Unnamed Contact'}${isDeactivated ? ' [DEACTIVATED]' : ''}`,
                      sublabel: [
                        isDeactivated ? '⚠️ DEACTIVATED' : null,
                        c.companyName,
                        c.phone,
                        c.email
                      ].filter(Boolean).join(' • '),
                      rightElement: isDeactivated ? (
                        <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200 uppercase">
                          Deactivated
                        </span>
                      ) : undefined,
                    };
                  })
                }
              />
              {(() => {
                const activeContact = contacts.find(c => c.id === contactId);
                if (!activeContact) return null;
                const isDeactivated = activeContact.isActive === false;
                return (
                  <div className={`p-2 rounded-lg text-xs space-y-0.5 mt-1.5 border ${
                    isDeactivated
                      ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                      : 'bg-zinc-50 border-zinc-200/80 text-zinc-700'
                  }`}>
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5 truncate">
                        {activeContact.displayName}
                        {isDeactivated && (
                          <span className="text-[9px] bg-rose-600 text-white font-extrabold px-1.5 py-0.2 rounded shadow-xs uppercase">
                            Deactivated
                          </span>
                        )}
                      </span>
                      {activeContact.gstin && (
                        <span className="text-[10px] text-zinc-500 font-mono">
                          GST: {activeContact.gstin}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <Select
              label="Deposit to / Pay from Account"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              options={[
                { value: '', label: 'No Register Link (Cash Book Only)' },
                ...accounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountName} (${formatCurrency(Number(acc.currentBalance))})`
                }))
              ]}
              disabled={!!editPayment}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Input
              label="Amount Received/Paid *"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0.01}
              required
              disabled={!!editPayment}
            />
            
            <Select
              label="Payment Mode *"
              value={paymentMode}
              onChange={(e) => {
                setPaymentMode(e.target.value);
                if (e.target.value === 'cheque') {
                  setStatus('pending');
                } else {
                  setStatus('completed');
                }
              }}
              options={PAYMENT_MODES}
              disabled={!!editPayment}
            />

            <Input
              label="Reference / Cheque #"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="e.g. TXN9271928"
            />
          </div>

          {paymentMode === 'cheque' && (
            <div className="grid gap-4 md:grid-cols-2 bg-amber-50/50 p-4 rounded border border-amber-100">
              <Input
                label="PDC / Cheque Date"
                type="date"
                value={chequeDate}
                onChange={(e) => setChequeDate(e.target.value)}
              />
              <Select
                label="Initial Status *"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={[
                  { value: 'pending', label: 'Pending (PDC / Uncleared)' },
                  { value: 'presented', label: 'Presented to Bank' },
                  { value: 'completed', label: 'Cleared (Paid)' },
                ]}
              />
            </div>
          )}

          <Input
            label="Internal comments"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Log internal comments here..."
          />

          {clientInvoices.length > 0 && !editPayment && (
            <div className="border-t border-zinc-200 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                  Allocate to outstanding documents
                </span>
                <Button variant="ghost"
                  type="button"
                  onClick={handleAutoAllocate}
                  className="text-xs font-semibold text-zinc-700 border border-zinc-200 bg-white py-1 px-3 hover:border-zinc-300 hover:text-zinc-800 rounded transition"
                >
                  Auto Allocate
                </Button>
              </div>

              <div className="overflow-x-auto rounded border border-zinc-200 bg-white max-h-56 overflow-y-auto">
                <Table className="min-w-full text-left text-sm text-zinc-600">
                  <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                    <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                      <TableHead className="px-4 py-3 w-10"></TableHead>
                      <TableHead className="px-4 py-3">Invoice #</TableHead>
                      <TableHead className="px-4 py-3 text-right">Balance Due</TableHead>
                      <TableHead className="px-4 py-3 text-right w-36">Apply Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-zinc-100">
                    {allocations.map((alloc, idx) => (
                      <TableRow key={alloc.invoiceId} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                        <TableCell className="px-4 py-3">
                          <Checkbox
                            checked={alloc.amountApplied > 0 && alloc.amountApplied === alloc.balanceDue}
                            onCheckedChange={(checked) => handleToggleInvoice(idx, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="px-4 py-3 font-bold font-mono">{alloc.invoiceNumber}</TableCell>
                        <TableCell className="px-4 py-3 text-right font-mono">{formatCurrency(alloc.balanceDue)}</TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={alloc.amountApplied || ''}
                            onChange={(e) => handleAllocationChange(idx, e.target.value)}
                            className="text-right"
                            placeholder="0.00"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center bg-white p-3 rounded border border-zinc-200 text-xs font-semibold">
                <span className="text-zinc-500">Total Allocated: {formatCurrency(allocatedSum)}</span>
                <span className={unallocatedAmount > 0 ? 'text-amber-500' : 'text-zinc-500'}>
                  Remaining Unallocated: {formatCurrency(unallocatedAmount)}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-6 border-t border-zinc-200">
            <Button
              type="button"
              onClick={onClose}
              className="bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100/50 hover:text-zinc-800 px-6 py-2.5 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-white hover:from-amber-400 hover:to-amber-500 px-8 py-2.5 text-xs"
            >
              {submitting ? (editPayment ? 'Updating...' : 'Recording...') : (editPayment ? 'Save Changes' : 'Record Payment')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
