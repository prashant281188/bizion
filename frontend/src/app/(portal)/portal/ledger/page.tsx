'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BookOpen, TrendingUp, TrendingDown, Wallet, Scale,
  FileText, CreditCard, X, ArrowUpRight, ArrowDownLeft, ChevronDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DateRangePicker } from '@/components/ui/date-range-picker';

// ─── Date range helpers (India FY = Apr 1 – Mar 31) ────────────────────────
function today() { return new Date().toISOString().split('T')[0]; }

function fyStart(year: number) { return `${year}-04-01`; }
function fyEnd(year: number)   { return `${year + 1}-03-31`; }

function currentFY() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: fyStart(year), to: fyEnd(year), label: `FY ${year}-${String(year + 1).slice(2)}` };
}
function lastFY() {
  const now = new Date();
  const year = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) - 1;
  return { from: fyStart(year), to: fyEnd(year), label: `FY ${year}-${String(year + 1).slice(2)}` };
}
function thisMonth() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  return { from, to: today(), label: 'This Month' };
}
function prevMonth() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last  = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    from: first.toISOString().split('T')[0],
    to:   last.toISOString().split('T')[0],
    label: 'Previous Month',
  };
}

const PRESETS = [
  { key: 'this_month',  label: 'This Month',    get: thisMonth },
  { key: 'prev_month',  label: 'Previous Month', get: prevMonth },
  { key: 'current_fy',  label: 'Current FY',    get: currentFY },
  { key: 'last_fy',     label: 'Last FY',       get: lastFY },
  { key: 'custom',      label: 'Custom',         get: () => ({ from: '', to: '', label: 'Custom' }) },
] as const;

type PresetKey = typeof PRESETS[number]['key'];

function balanceColor(val: number) {
  if (val > 0) return 'text-rose-700';
  if (val < 0) return 'text-emerald-700';
  return 'text-zinc-600';
}
function balanceBg(val: number) {
  if (val > 0) return 'bg-rose-50 border-rose-100';
  if (val < 0) return 'bg-emerald-50 border-emerald-100';
  return 'bg-zinc-50 border-zinc-100';
}
function balanceLabel(val: number) {
  if (val > 0) return '(Due)';
  if (val < 0) return '(Advance)';
  return '';
}

export default function PortalLedgerPage() {
  const router = useRouter();

  const initial = thisMonth();
  const [preset, setPreset]   = useState<PresetKey>('this_month');
  const [from,   setFrom]     = useState(initial.from);
  const [to,     setTo]       = useState(initial.to);
  const [applied, setApplied] = useState({ from: initial.from, to: initial.to });

  const selectPreset = (key: PresetKey) => {
    setPreset(key);
    if (key !== 'custom') {
      const p = PRESETS.find(p => p.key === key)!.get();
      setFrom(p.from); setTo(p.to);
      setApplied({ from: p.from, to: p.to });
    }
  };

  const applyCustom = () => setApplied({ from, to });
  const clearCustom = () => { setFrom(''); setTo(''); setApplied({ from: '', to: '' }); };

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'ledger', applied.from, applied.to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (applied.from) params.set('from', applied.from);
      if (applied.to)   params.set('to',   applied.to);
      const res = await api.get(`/portal/ledger?${params.toString()}`);
      return res.data?.data;
    },
  });

  const entries  = data?.entries  || [];
  const summary  = data?.summary  || { openingBalance: 0, totalInvoiced: 0, totalPaid: 0, closingBalance: 0 };

  return (
    <div className="space-y-8 pb-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-violet-50/80 border border-violet-100/50 px-8 py-10 shadow-sm">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-zinc-900">Account Ledger</h1>
            <p className="text-zinc-600 max-w-xl">
              Complete statement of all invoices and payments with running balance.
            </p>
          </div>
          <div className="hidden sm:block p-4 bg-violet-100/50 rounded-full">
            <BookOpen className="h-10 w-10 text-violet-600" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-zinc-200/60 shadow-sm">
        <CardContent className="p-5">
          <DateRangePicker
            startDate={from}
            endDate={to}
            onStartDateChange={setFrom}
            onEndDateChange={setTo}
            onClear={() => { setFrom(''); setTo(''); setApplied({ from: '', to: '' }); }}
          />
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-zinc-200/60 shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2.5 bg-zinc-100 text-zinc-600 rounded-xl shrink-0">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Opening Balance</p>
              <p className={`text-xl font-bold mt-0.5 ${balanceColor(summary.openingBalance)}`}>
                {formatCurrency(Math.abs(summary.openingBalance))}
                {summary.openingBalance !== 0 && <span className="text-xs font-normal ml-1">{balanceLabel(summary.openingBalance)}</span>}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/60 shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Invoiced</p>
              <p className="text-xl font-bold mt-0.5 text-rose-700">{formatCurrency(summary.totalInvoiced)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/60 shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Paid</p>
              <p className="text-xl font-bold mt-0.5 text-emerald-700">{formatCurrency(summary.totalPaid)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-zinc-200/60 shadow-sm border-l-4 ${summary.closingBalance > 0 ? 'border-l-rose-400' : summary.closingBalance < 0 ? 'border-l-emerald-400' : 'border-l-zinc-300'}`}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${summary.closingBalance > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Closing Balance</p>
              <p className={`text-xl font-bold mt-0.5 ${balanceColor(summary.closingBalance)}`}>
                {formatCurrency(Math.abs(summary.closingBalance))}
                <span className="text-xs font-normal ml-1">{balanceLabel(summary.closingBalance)}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ledger Table */}
      <Card className="border-zinc-200/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-6 py-4">
          <CardTitle className="text-base font-semibold text-zinc-800 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-violet-600" />
            Statement of Account
            {applied.from && (
              <span className="ml-2 text-xs font-normal text-zinc-500">
                {applied.from && formatDate(applied.from)} – {applied.to && formatDate(applied.to)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="px-6 py-3 text-left">Date</th>
                    <th className="px-6 py-3 text-left">Reference</th>
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-right">Debit (Invoice)</th>
                    <th className="px-6 py-3 text-right">Credit (Payment)</th>
                    <th className="px-6 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {/* Opening Balance row at top */}
                  <tr className={`${balanceBg(summary.openingBalance)} border border-dashed`}>
                    <td className="px-6 py-3" colSpan={5}>
                      <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Opening Balance</span>
                      {applied.from && <span className="text-xs text-zinc-400 ml-2">(before {formatDate(applied.from)})</span>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className={`font-bold text-base ${balanceColor(summary.openingBalance)}`}>
                        {formatCurrency(Math.abs(summary.openingBalance))}
                        {summary.openingBalance !== 0 && <span className="text-xs font-normal ml-1">{balanceLabel(summary.openingBalance)}</span>}
                      </span>
                    </td>
                  </tr>

                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-zinc-400">
                        <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">No transactions in this period</p>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry: any) => (
                      <tr
                        key={entry.id}
                        className={`hover:bg-zinc-50/80 transition-colors ${['sales_invoice', 'credit_note', 'debit_note'].includes(entry.type) ? 'cursor-pointer' : ''} group`}
                        onClick={() => ['sales_invoice', 'credit_note', 'debit_note'].includes(entry.type) && router.push(`/portal/invoices/${entry.id}`)}
                      >
                        <td className="px-6 py-4 font-medium text-zinc-700 whitespace-nowrap">
                          {formatDate(entry.date)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {['sales_invoice', 'debit_note'].includes(entry.type)
                              ? <FileText className="h-4 w-4 text-violet-500 shrink-0" />
                              : entry.type === 'credit_note'
                              ? <FileText className="h-4 w-4 text-rose-500 shrink-0" />
                              : <CreditCard className="h-4 w-4 text-emerald-500 shrink-0" />
                            }
                            <span className={`font-semibold ${['sales_invoice', 'debit_note', 'credit_note'].includes(entry.type) ? 'text-violet-700 group-hover:underline' : 'text-emerald-700'}`}>
                              {entry.reference}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {entry.type === 'sales_invoice' ? (
                            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 font-semibold gap-1 text-xs">
                              <ArrowUpRight className="h-3 w-3" /> Invoice
                            </Badge>
                          ) : entry.type === 'credit_note' ? (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-semibold gap-1 text-xs">
                              <ArrowDownLeft className="h-3 w-3" /> Credit Note
                            </Badge>
                          ) : entry.type === 'debit_note' ? (
                            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 font-semibold gap-1 text-xs">
                              <ArrowUpRight className="h-3 w-3" /> Debit Note
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold gap-1 text-xs">
                              <ArrowDownLeft className="h-3 w-3" /> Payment
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {entry.debit > 0
                            ? <span className="text-rose-700 font-semibold">{formatCurrency(entry.debit)}</span>
                            : <span className="text-zinc-300">—</span>
                          }
                        </td>
                        <td className="px-6 py-4 text-right">
                          {entry.credit > 0
                            ? <span className="text-emerald-700 font-semibold">{formatCurrency(entry.credit)}</span>
                            : <span className="text-zinc-300">—</span>
                          }
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-bold ${balanceColor(entry.runningBalance)}`}>
                            {formatCurrency(Math.abs(entry.runningBalance))}
                            {entry.runningBalance !== 0 && <span className="text-[10px] font-normal ml-1">{balanceLabel(entry.runningBalance)}</span>}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Closing Balance row at bottom */}
                  <tr className={`${balanceBg(summary.closingBalance)} border border-dashed`}>
                    <td className="px-6 py-3" colSpan={5}>
                      <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Closing Balance</span>
                      {applied.to && <span className="text-xs text-zinc-400 ml-2">(as of {formatDate(applied.to)})</span>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className={`font-bold text-base ${balanceColor(summary.closingBalance)}`}>
                        {formatCurrency(Math.abs(summary.closingBalance))}
                        {summary.closingBalance !== 0 && <span className="text-xs font-normal ml-1">{balanceLabel(summary.closingBalance)}</span>}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
