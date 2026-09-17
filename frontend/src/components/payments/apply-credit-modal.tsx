'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileText, CheckCircle2, Loader2 } from 'lucide-react';

interface CreditNote {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: string;
  balanceDue: string;
  status: string;
}

interface ApplyCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoiceId: string;
  invoiceNumber: string;
  contactId: string;
  invoiceBalanceDue: number;
}

export function ApplyCreditModal({
  isOpen,
  onClose,
  onSuccess,
  invoiceId,
  invoiceNumber,
  contactId,
  invoiceBalanceDue,
}: ApplyCreditModalProps) {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState('');
  const [amountToApply, setAmountToApply] = useState('');
  const [appliedDate, setAppliedDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (isOpen && contactId) {
      setLoading(true);
      setSelectedCreditNoteId('');
      setAmountToApply('');
      api
        .get(`/credit-notes/available?contactId=${contactId}`)
        .then((res) => setCreditNotes(res.data.data || []))
        .catch(() => toast.error('Failed to load available credits'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, contactId]);

  const selectedCN = creditNotes.find((cn) => cn.id === selectedCreditNoteId);
  const maxApplicable = selectedCN
    ? Math.min(Number(selectedCN.balanceDue), invoiceBalanceDue)
    : 0;

  const handleSelectCN = (id: string) => {
    setSelectedCreditNoteId(id);
    const cn = creditNotes.find((c) => c.id === id);
    if (cn) {
      setAmountToApply(Math.min(Number(cn.balanceDue), invoiceBalanceDue).toFixed(2));
    }
  };

  const handleApply = async () => {
    if (!selectedCreditNoteId) return toast.error('Select a credit note');
    const amount = parseFloat(amountToApply);
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    if (amount > maxApplicable) return toast.error(`Maximum you can apply is ₹${maxApplicable.toFixed(2)}`);

    setSubmitting(true);
    try {
      await api.post(`/credit-notes/${selectedCreditNoteId}/apply`, {
        invoiceId,
        amountApplied: amount,
        appliedDate,
      });
      toast.success(`Credit note applied to ${invoiceNumber}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to apply credit note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-amber-600 uppercase tracking-wider">
            Apply Credit Note
          </DialogTitle>
          <p className="text-sm text-zinc-500 mt-1">
            Applying to <span className="font-semibold text-zinc-700">{invoiceNumber}</span>{' '}
            (Balance Due: <span className="font-semibold text-rose-600">{formatCurrency(invoiceBalanceDue)}</span>)
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading available credits...
          </div>
        ) : creditNotes.length === 0 ? (
          <div className="text-center py-10 text-zinc-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No credit notes with available balance for this customer.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Credit Note Selection */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Available Credit Notes
              </p>
              <div className="border border-zinc-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50">
                      <TableHead className="px-3 py-2 text-xs">Select</TableHead>
                      <TableHead className="px-3 py-2 text-xs">Credit Note</TableHead>
                      <TableHead className="px-3 py-2 text-xs">Date</TableHead>
                      <TableHead className="px-3 py-2 text-xs text-right">Available</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditNotes.map((cn) => (
                      <TableRow
                        key={cn.id}
                        className={`cursor-pointer transition-colors ${selectedCreditNoteId === cn.id ? 'bg-amber-50 border-amber-200' : 'hover:bg-zinc-50'}`}
                        onClick={() => handleSelectCN(cn.id)}
                      >
                        <TableCell className="px-3 py-2">
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                              selectedCreditNoteId === cn.id
                                ? 'border-amber-500 bg-amber-500'
                                : 'border-zinc-300'
                            }`}
                          >
                            {selectedCreditNoteId === cn.id && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <span className="font-mono text-sm font-semibold text-amber-700">
                            {cn.invoiceNumber}
                          </span>
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {cn.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-zinc-500">
                          {formatDate(cn.invoiceDate)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right font-semibold text-emerald-700">
                          {formatCurrency(Number(cn.balanceDue))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Amount + Date */}
            {selectedCreditNoteId && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">
                    Amount to Apply (max {formatCurrency(maxApplicable)})
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={maxApplicable}
                    value={amountToApply}
                    onChange={(e) => setAmountToApply(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">
                    Application Date
                  </label>
                  <Input
                    type="date"
                    value={appliedDate}
                    onChange={(e) => setAppliedDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="h-9">
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={!selectedCreditNoteId || submitting}
                className="h-9 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                )}
                Apply Credit
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
