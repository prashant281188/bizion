'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, AlertCircle, CheckCircle2, FileClock, Wallet } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { useRouter } from 'next/navigation';

export default function PortalInvoicesPage() {
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['portal', 'invoices'],
    queryFn: async () => {
      const res = await api.get('/portal/invoices');
      return res.data?.data || [];
    },
  });

  const { data: ledgerSummary, isLoading: ledgerLoading } = useQuery({
    queryKey: ['portal', 'ledger', 'summary'],
    queryFn: async () => {
      const res = await api.get('/portal/ledger');
      return res.data?.data?.summary || { totalInvoiced: 0, closingBalance: 0, totalCreditNotes: 0 };
    },
  });

  const isLoading = invoicesLoading || ledgerLoading;

  const router = useRouter();

  // Calculate metrics
  const totalBilled = ledgerSummary?.totalInvoiced || 0;
  const totalOutstanding = Math.abs(ledgerSummary?.closingBalance || 0);
  const isCreditBalance = (ledgerSummary?.closingBalance || 0) < 0;
  const overdueCount = invoices?.filter((i: any) => i.status === 'overdue').length || 0;
  const totalCreditAvailable = ledgerSummary?.totalCreditNotes || 0;
  const salesInvoices = invoices?.filter((i: any) => i.documentType !== 'credit_note') || [];
  const creditNotes = invoices?.filter((i: any) => i.documentType === 'credit_note') || [];

  return (
    <div className="space-y-8 pb-10">
      {/* Custom Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-50 border border-slate-200 px-8 py-10 text-zinc-900 shadow-sm">
        <div className="absolute -bottom-12 -left-12 h-64 w-64 rounded-full bg-slate-200 opacity-30 blur-3xl"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">My Invoices</h1>
            <p className="text-zinc-600 max-w-xl">
              View your billing statements, download past invoices, and track outstanding balances.
            </p>
          </div>
          <div className="hidden sm:block p-4 bg-slate-100 rounded-full border border-slate-200/50">
            <FileText className="h-10 w-10 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Billed</p>
              <h3 className="text-2xl font-bold text-zinc-900">{formatCurrency(totalBilled)}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <FileClock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">
                {isCreditBalance ? 'Advance Balance' : 'Outstanding Balance'}
              </p>
              <div className="flex items-end gap-2">
                <h3 className={`text-2xl font-bold ${isCreditBalance ? 'text-emerald-700' : 'text-zinc-900'}`}>
                  {formatCurrency(totalOutstanding)}
                </h3>
                {isCreditBalance && <span className="text-xs font-medium text-emerald-600 mb-1">(Advance)</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Overdue Invoices</p>
              <h3 className="text-2xl font-bold text-zinc-900">{overdueCount}</h3>
            </div>
          </CardContent>
        </Card>

        {/* Credits Available card — shown only if there are credit notes with balance */}
        {totalCreditAvailable > 0 && (
          <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm col-span-full md:col-span-1">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-700">Credit Notes Available</p>
                <h3 className="text-2xl font-bold text-emerald-800">{formatCurrency(totalCreditAvailable)}</h3>
                <p className="text-xs text-emerald-600 mt-0.5">Can be applied against open invoices</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main DataTable */}
      <DataTable
          isLoading={isLoading}
          isEmpty={!invoices || invoices.length === 0}
          headers={[
            { key: 'invoiceNumber', label: 'Invoice #' },
            { key: 'invoiceDate', label: 'Date' },
            { key: 'status', label: 'Status' },
            { key: 'totalAmount', label: 'Amount', align: 'right' },
          ]}
        >
          <>
            {invoices?.map((invoice: any) => (
              <TableRow 
                key={invoice.id} 
                className="hover:bg-zinc-50/50 transition-colors border-zinc-100 cursor-pointer"
                onClick={() => router.push(`/portal/invoices/${invoice.id}`)}
              >
                <TableCell className="font-semibold text-slate-700">
                  {invoice.invoiceNumber}
                  {invoice.documentType === 'credit_note' && (
                    <span className="ml-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">CN</span>
                  )}
                  {invoice.documentType === 'debit_note' && (
                    <span className="ml-2 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">DN</span>
                  )}
                </TableCell>
                <TableCell className="text-zinc-600 font-medium">{formatDate(invoice.invoiceDate)}</TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={`capitalize font-semibold border ${
                      invoice.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      invoice.status === 'overdue' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      invoice.status === 'void' ? 'bg-zinc-100 text-zinc-700 border-zinc-300' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {invoice.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-bold text-zinc-800">
                  {invoice.documentType === 'credit_note' ? (
                    <span className="text-emerald-700">−{formatCurrency(Number(invoice.totalAmount))}</span>
                  ) : (
                    formatCurrency(Number(invoice.totalAmount))
                  )}
                </TableCell>
              </TableRow>
            ))}
          </>
        </DataTable>
    </div>
  );
}
