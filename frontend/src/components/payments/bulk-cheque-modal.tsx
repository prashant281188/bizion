import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';

const DIRECTION_OPTIONS = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'presented', label: 'Presented' },
  { value: 'completed', label: 'Cleared' },
];

export function BulkChequeModal({
  isOpen,
  onClose,
  onSuccess,
  contacts,
  accounts,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contacts: any[];
  accounts: any[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const createEmptyRow = () => ({
    id: Date.now() + Math.random().toString(),
    direction: 'inbound',
    contactId: '',
    bankAccountId: '',
    amount: '',
    chequeDate: new Date().toISOString().split('T')[0],
    transactionRef: '',
    status: 'pending',
  });

  useEffect(() => {
    if (isOpen) {
      setRows([createEmptyRow()]);
    }
  }, [isOpen]);

  const addRow = () => {
    const newRow = createEmptyRow();
    setRows((prev) => [...prev, newRow]);
    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
      }
      const input = document.getElementById(`party-contact-${newRow.id}`);
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRowChange = (id: string, field: string, value: any) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic Validation
    const validRows = rows.filter((r) => r.contactId && parseFloat(r.amount) > 0);
    
    if (validRows.length === 0) {
      toast.error('Please enter at least one valid cheque with a contact and an amount greater than 0.');
      return;
    }

    setSubmitting(true);

    const payload = {
      payments: validRows.map((r) => ({
        paymentDate: new Date().toISOString().split('T')[0], // The date of recording
        direction: r.direction,
        contactId: r.contactId,
        amount: parseFloat(r.amount),
        paymentMode: 'cheque',
        status: r.status,
        chequeDate: r.chequeDate || null,
        bankAccountId: r.bankAccountId || null,
        transactionRef: r.transactionRef || null,
        notes: 'Bulk Cheque Entry',
        allocations: [], // Explicitly no allocations for bulk
      })),
    };

    try {
      await api.post('/payments/bulk', payload);
      toast.success(`Successfully recorded ${validRows.length} cheques.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record bulk cheques');
    } finally {
      setSubmitting(false);
    }
  };

  const totalChequeSum = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const validCount = rows.filter((r) => r.contactId && parseFloat(r.amount) > 0).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-6xl w-[92vw] bg-white rounded-2xl p-6 max-h-[90vh] flex flex-col shadow-2xl space-y-4 overflow-hidden">
        <DialogHeader className="border-b border-zinc-100 pb-3 pr-10 flex flex-row items-center justify-between space-y-0 shrink-0">
          <div>
            <DialogTitle className="text-base font-bold text-zinc-900">
              Bulk Cheque Entry Workspace
            </DialogTitle>
            <p className="text-xs text-zinc-500">Record multiple incoming or outgoing cheques in a single batch.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-900 flex items-center gap-2">
              <span>Valid Cheques: <strong className="font-mono">{validCount}</strong></span>
              <span className="text-amber-300">|</span>
              <span>Total Amount: <strong className="font-mono text-amber-700">{formatCurrency(totalChequeSum)}</strong></span>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleBulkSubmit} className="flex-1 min-h-0 flex flex-col space-y-4">
          <div ref={tableContainerRef} className="flex-1 min-h-0 max-h-[52vh] overflow-y-auto border border-zinc-200/80 rounded-xl scroll-smooth">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="bg-zinc-50/95 text-[11px] font-bold uppercase tracking-wider text-zinc-500 sticky top-0 z-20 border-b border-zinc-200 shadow-xs">
                <tr>
                  <th className="px-3 py-2.5 w-32 bg-zinc-50">Direction</th>
                  <th className="px-3 py-2.5 min-w-[240px] bg-zinc-50">Party Contact *</th>
                  <th className="px-3 py-2.5 min-w-[160px] bg-zinc-50">Bank Register</th>
                  <th className="px-3 py-2.5 w-36 bg-zinc-50">Amount (₹) *</th>
                  <th className="px-3 py-2.5 w-36 bg-zinc-50">Cheque Date</th>
                  <th className="px-3 py-2.5 w-36 bg-zinc-50">Cheque / Ref #</th>
                  <th className="px-3 py-2.5 w-32 bg-zinc-50">Status</th>
                  <th className="px-3 py-2.5 w-12 text-center bg-zinc-50"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {rows.map((row, index) => (
                  <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-3 py-2">
                      <Select
                        value={row.direction}
                        onChange={(e) => handleRowChange(row.id, 'direction', e.target.value)}
                        options={DIRECTION_OPTIONS}
                        className="h-8 text-xs bg-zinc-50/50"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <SearchableSelect
                        id={`party-contact-${row.id}`}
                        placeholder="Search contact..."
                        value={row.contactId}
                        onChange={(val) => handleRowChange(row.id, 'contactId', val)}
                        options={contacts
                          .filter((c) => row.direction === 'inbound' ? c.type !== 'vendor' : c.type !== 'customer')
                          .map((c) => {
                            const isDeactivated = c.isActive === false;
                            return {
                              value: c.id,
                              label: `${c.displayName || c.companyName || 'Unnamed Contact'}${isDeactivated ? ' [DEACTIVATED]' : ''}`,
                              sublabel: [
                                isDeactivated ? '⚠️ DEACTIVATED' : null,
                                c.companyName,
                                c.phone
                              ].filter(Boolean).join(' • '),
                              rightElement: isDeactivated ? (
                                <span className="text-[9px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.2 rounded border border-rose-200 uppercase">
                                  Deactivated
                                </span>
                              ) : undefined,
                            };
                          })
                        }
                        className="text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={row.bankAccountId}
                        onChange={(e) => handleRowChange(row.id, 'bankAccountId', e.target.value)}
                        options={[
                          { value: '', label: 'Default Register' },
                          ...accounts.map((acc) => ({
                            value: acc.id,
                            label: `${acc.accountName} (${formatCurrency(Number(acc.currentBalance))})`
                          }))
                        ]}
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={row.amount}
                        onChange={(e) => handleRowChange(row.id, 'amount', e.target.value)}
                        className="h-8 text-xs font-mono text-right"
                        placeholder="0.00"
                        required
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="date"
                        value={row.chequeDate}
                        onChange={(e) => handleRowChange(row.id, 'chequeDate', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={row.transactionRef}
                        onChange={(e) => handleRowChange(row.id, 'transactionRef', e.target.value)}
                        className="h-8 text-xs font-mono uppercase"
                        placeholder="CHQ-00123"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && index === rows.length - 1) {
                            e.preventDefault();
                            addRow();
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={row.status}
                        onChange={(e) => handleRowChange(row.id, 'status', e.target.value)}
                        options={STATUS_OPTIONS}
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-1 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={addRow}
              className="text-xs font-bold text-amber-700 border-amber-200/80 bg-amber-50 hover:bg-amber-100 rounded-xl h-8 px-4"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Another Cheque Row
            </Button>

            <p className="text-[11px] text-zinc-500 font-medium">
              Note: Bulk cheques are recorded as advance entries. You can allocate them from Payment Details.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 shrink-0">
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
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2 rounded-xl shadow-sm transition-all"
            >
              {submitting ? 'Recording Cheques...' : `Save ${validCount} Cheque${validCount === 1 ? '' : 's'}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
