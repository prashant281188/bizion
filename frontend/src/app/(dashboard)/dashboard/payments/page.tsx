'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, ArrowUpRight, ArrowDownLeft, Landmark, Receipt, Plus, Search, Building2, CreditCard, Printer } from 'lucide-react';
import { toast } from 'sonner';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import api from '@/lib/api';

const BankAccountModal = dynamic(() => import('@/components/payments/bank-account-modal').then(mod => mod.BankAccountModal), { ssr: false });
const RecordPaymentModal = dynamic(() => import('@/components/payments/record-payment-modal').then(mod => mod.RecordPaymentModal), { ssr: false });
const BulkChequeModal = dynamic(() => import('@/components/payments/bulk-cheque-modal').then(mod => mod.BulkChequeModal), { ssr: false });
import { Button } from '@/components/ui/button';
import { Card } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Payment, BankAccount, Contact, Invoice } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';

import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { SearchFilterBar } from '@/components/ui/search-filter-bar';
import { DataTable, type TableHeader as DataTableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';

import { DateRangePicker } from '@/components/ui/date-range-picker';

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

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<'payments' | 'accounts'>('payments');

  const queryClient = useQueryClient();

  // Filters state (Payments)
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [directionFilter, setDirectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const [sortBy, setSortBy] = useState<string>('paymentDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Detail / Form modals state
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [bulkChequeModalOpen, setBulkChequeModalOpen] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [viewPayment, setViewPayment] = useState<any | null>(null);
  const [voidConfirmPaymentId, setVoidConfirmPaymentId] = useState<string | null>(null);
  const [deleteConfirmAccountId, setDeleteConfirmAccountId] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Bank Account Ledger State
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [accountLedgerData, setAccountLedgerData] = useState<any | null>(null);

  // Bank Account Form State
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Queries
  const { data: paymentsData, isLoading: paymentsLoading, error: paymentsError } = useQuery({
    queryKey: ['payments', { page, search: debouncedSearch, direction: directionFilter, status: statusFilter, startDate, endDate, sortBy, sortOrder }],
    queryFn: async () => {
      let url = `/payments?page=${page}&limit=10&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (debouncedSearch) url += `&q=${encodeURIComponent(debouncedSearch)}`;
      if (directionFilter) url += `&direction=${directionFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      const res = await api.get(url);
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const { data: bankAccountsData, isLoading: accountsLoading, error: accountsError } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: async () => {
      const res = await api.get('/payments/bank-accounts');
      return res.data;
    },
  });

  const { data: contactsData } = useQuery({
    queryKey: ['masters-contacts-limit-100'],
    queryFn: async () => {
      const res = await api.get('/contacts?limit=100');
      return res.data;
    },
  });

  const payments = (paymentsData?.data || []) as Payment[];
  const totalPages = paymentsData?.pagination?.totalPages || 1;
  const accounts = (bankAccountsData?.data || []) as BankAccount[];
  const contacts = (contactsData?.data || []) as Contact[];

  const loading = activeTab === 'payments' ? paymentsLoading : accountsLoading;
  const error = activeTab === 'payments'
    ? (paymentsError ? (paymentsError as any).response?.data?.message || 'Failed to fetch payments' : null)
    : (accountsError ? (accountsError as any).response?.data?.message || 'Failed to fetch bank accounts' : null);

  // Load payment details side sheet
  const loadPaymentDetails = async (id: string, isEdit: boolean = false) => {
    try {
      setLoadingDetails(true);
      const res = await api.get(`/payments/${id}`);
      if (isEdit) {
        setEditingPayment(res.data.data);
        setRecordPaymentOpen(true);
      } else {
        setViewPayment(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load payment details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePaymentClick = (pay: any) => {
    if (pay.paymentMode === 'cheque') {
      loadPaymentDetails(pay.id, true);
    } else {
      loadPaymentDetails(pay.id, false);
    }
  };

  // Load bank account ledger
  const loadAccountLedger = async (id: string) => {
    try {
      setLoadingLedger(true);
      setLedgerModalOpen(true);
      const res = await api.get(`/payments/bank-accounts/${id}/ledger`);
      setAccountLedgerData(res.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load account ledger');
      setLedgerModalOpen(false);
    } finally {
      setLoadingLedger(false);
    }
  };

  // Handle Void Payment
  const promptVoidPayment = (id: string) => {
    setVoidConfirmPaymentId(id);
  };

  const executeVoidPayment = async () => {
    if (!voidConfirmPaymentId) return;

    try {
      await api.delete(`/payments/${voidConfirmPaymentId}`);
      toast.success('Payment voided successfully');
      setVoidConfirmPaymentId(null);
      setViewPayment(null);
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to void payment');
    }
  };

  // Delete Bank Account
  const promptDeleteBankAccount = (id: string) => {
    setDeleteConfirmAccountId(id);
  };

  const executeDeleteBankAccount = async () => {
    if (!deleteConfirmAccountId) return;
    try {
      await api.delete(`/payments/bank-accounts/${deleteConfirmAccountId}`);
      toast.success('Bank account deleted successfully');
      setDeleteConfirmAccountId(null);
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete bank account');
    }
  };

  const openEditBankModal = (account: BankAccount) => {
    setEditingAccount(account);
    setBankModalOpen(true);
  };

  const openNewBankModal = () => {
    setEditingAccount(null);
    setBankModalOpen(true);
  };

  const printReceipt = () => {
    const printContent = document.getElementById('printable-payment-receipt');
    if (!printContent) return;

    const winPrint = window.open('', '', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');
    if (!winPrint) return;

    winPrint.document.write(`
      <html>
        <head>
          <title>Print Payment Receipt - ${viewPayment?.paymentNumber}</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>
            body { font-family: sans-serif; color: #1e293b; background: white; padding: 40px; }
            .font-mono { font-family: monospace; }
          </style>
        </head>
        <body onload="window.print();window.close()">
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    winPrint.document.close();
    winPrint.focus();
  };

  const paymentTableHeaders: DataTableHeader[] = [
    { key: 'paymentNumber', label: 'Receipt/Pay #', sortable: true },
    { key: 'paymentDate', label: 'Date', sortable: true },
    { key: 'contactName', label: 'Customer / Vendor', sortable: true },
    { key: 'direction', label: 'Direction' },
    { key: 'paymentMode', label: 'Mode' },
    { key: 'bankAccount', label: 'Bank/Cash Account' },
    { key: 'amount', label: 'Amount', sortable: true, align: 'right' },
    { key: 'unusedAmount', label: 'Unused Amount', sortable: true, align: 'right' },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'actions', label: 'Actions', align: 'right' },
  ];

  const accountTableHeaders: DataTableHeader[] = [
    { key: 'accountName', label: 'Account Name' },
    { key: 'bankName', label: 'Bank Name' },
    { key: 'accountNumber', label: 'Account Number' },
    { key: 'ifsc', label: 'IFSC / UPI' },
    { key: 'type', label: 'Type' },
    { key: 'openingBalance', label: 'Opening Balance', align: 'right' },
    { key: 'currentBalance', label: 'Current Balance', align: 'right' },
    { key: 'isDefault', label: 'Default' },
    { key: 'actions', label: 'Actions', align: 'right' },
  ];

  const kpis = useMemo(() => {
    const inboundTotal = payments.filter(p => p.direction === 'inbound').reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const outboundTotal = payments.filter(p => p.direction === 'outbound').reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const totalCurrentBankBalance = accounts.reduce((acc, a) => acc + Number(a.currentBalance || 0), 0);
    return { inboundTotal, outboundTotal, totalCurrentBankBalance, totalAccounts: accounts.length };
  }, [payments, accounts]);

  return (
    <PageContainer className="max-w-full space-y-6">
      <PageHeader
        title="Payments & Financial Registers"
        subtitle="Record customer collection receipts, log supplier disbursements, and audit bank/cash registers."
      >
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() => setBulkChequeModalOpen(true)}
            variant="outline"
            className="border-zinc-200 hover:bg-zinc-50 text-xs font-semibold"
          >
            <Receipt className="w-3.5 h-3.5 mr-1.5" />
            Bulk Cheques Entry
          </Button>

          <Button
            type="button"
            onClick={openNewBankModal}
            variant="outline"
            className="border-zinc-200 hover:bg-zinc-50 text-xs font-semibold"
          >
            <Landmark className="w-3.5 h-3.5 mr-1.5" />
            Add Register Account
          </Button>

          <Button
            type="button"
            onClick={() => setRecordPaymentOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Record Payment / Receipt
          </Button>
        </div>
      </PageHeader>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Inbound Receipts (Collection)</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-emerald-700">{formatCurrency(kpis.inboundTotal)}</span>
            <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">Outbound Disbursements</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-red-600">{formatCurrency(kpis.outboundTotal)}</span>
            <ArrowUpRight className="w-5 h-5 text-red-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Bank & Cash Balance</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-amber-900">{formatCurrency(kpis.totalCurrentBankBalance)}</span>
            <Landmark className="w-5 h-5 text-amber-600" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Registers</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-900">{kpis.totalAccounts}</span>
            <Building2 className="w-5 h-5 text-zinc-400" />
          </div>
        </Card>
      </div>

      {/* Segmented Mode Tabs & Filters */}
      <Card className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-200/80 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'payments'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Transactions Ledger
            </button>

            <button
              onClick={() => setActiveTab('accounts')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'accounts'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Bank & Cash Registers ({kpis.totalAccounts})
            </button>
          </div>
        </div>

        {activeTab === 'payments' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Search by receipt #, party name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl w-full"
              />
            </div>

            <div className="w-[140px] shrink-0">
              <Select
                value={directionFilter}
                onChange={(e) => {
                  setDirectionFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: '', label: 'All Directions' },
                  ...DIRECTION_OPTIONS,
                ]}
                className="h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl font-medium"
              />
            </div>

            <div className="w-[140px] shrink-0">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
                className="h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl font-medium"
              />
            </div>

            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={(d) => { setStartDate(d); setPage(1); }}
              onEndDateChange={(d) => { setEndDate(d); setPage(1); }}
              onClear={() => setPage(1)}
            />
          </div>
        )}
      </Card>

      {error && (
        <div className="flex items-center space-x-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'payments' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
          <DataTable
            headers={paymentTableHeaders}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            isLoading={loading}
            isEmpty={payments.length === 0}
            emptyMessage="No transactions registered in ledger yet."
          >
            {payments.map((pay) => (
              <TableRow key={pay.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 group">
                <TableCell className="px-4 py-3.5 font-mono font-bold text-xs text-amber-900 group-hover:text-amber-600 transition-colors">
                  <Button variant="ghost"
                    onClick={() => handlePaymentClick(pay)}
                    className="text-left font-mono font-bold text-xs text-amber-900 hover:text-amber-600 p-0 h-auto"
                  >
                    {pay.paymentNumber}
                  </Button>
                </TableCell>
                <TableCell className="px-4 py-3.5 text-xs text-zinc-600 font-medium">{formatDate(pay.paymentDate)}</TableCell>
                <TableCell className="px-4 py-3.5">
                  <span className="block font-bold text-xs text-zinc-900">{(pay as any).contactName}</span>
                  {(pay as any).companyName && (
                    <span className="block text-[10px] text-zinc-500 font-medium mt-0.5">{(pay as any).companyName}</span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      pay.direction === 'inbound'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-red-50 text-red-800 border-red-200'
                    }`}
                  >
                    {pay.direction === 'inbound' ? '+ IN (Receipt)' : '- OUT (Payment)'}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-3.5 text-xs text-zinc-700 capitalize font-medium">
                  {pay.paymentMode?.replace('_', ' ') || '—'}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-xs text-zinc-600 font-medium">
                  {(pay as any).bankAccountName || '—'}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-right font-mono font-bold text-xs text-zinc-900">
                  {formatCurrency(Number(pay.amount))}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-right font-mono text-xs text-zinc-600">
                  {formatCurrency(Number((pay as any).unusedAmount || 0))}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {pay.status}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3.5 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadPaymentDetails(pay.id)}
                      className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:bg-amber-50 h-7 px-2"
                    >
                      View
                    </Button>

                    {pay.status !== 'cancelled' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => promptVoidPayment(pay.id)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                      >
                        Void
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
          {totalPages > 1 && (
            <div className="p-4 bg-white border-t border-zinc-200/80">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
          <DataTable
            headers={accountTableHeaders}
            isLoading={loading}
            isEmpty={accounts.length === 0}
            emptyMessage="No bank accounts created."
          >
            {accounts.map((acc) => (
              <TableRow key={acc.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 group">
                <TableCell className="px-4 py-3.5">
                  <Button
                    variant="ghost"
                    onClick={() => loadAccountLedger(acc.id)}
                    className="text-left font-bold text-xs text-amber-900 group-hover:text-amber-600 transition-colors p-0 h-auto"
                  >
                    {acc.accountName}
                  </Button>
                </TableCell>
                <TableCell className="px-4 py-3.5 text-xs text-zinc-700 font-medium">{acc.bankName || '—'}</TableCell>
                <TableCell className="px-4 py-3.5 font-mono text-xs text-zinc-800 font-bold">{acc.accountNumber || '—'}</TableCell>
                <TableCell className="px-4 py-3.5 font-mono text-xs text-zinc-600">
                  {acc.ifscCode && <span className="block font-bold text-zinc-800">IFSC: {acc.ifscCode}</span>}
                  {acc.upiId && <span className="block text-[11px] text-zinc-500">UPI: {acc.upiId}</span>}
                  {!acc.ifscCode && !acc.upiId && '—'}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-xs text-zinc-600 capitalize font-medium">{acc.accountType || '—'}</TableCell>
                <TableCell className="px-4 py-3.5 text-right font-mono text-xs text-zinc-600">
                  {formatCurrency(Number(acc.openingBalance))}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-right font-mono font-bold text-xs text-zinc-900">
                  {formatCurrency(Number(acc.currentBalance))}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  {acc.isDefault && (
                    <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                      PRIMARY
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditBankModal(acc)}
                      className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 h-7 px-2"
                    >
                      Edit
                    </Button>
                    {!acc.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => promptDeleteBankAccount(acc.id)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </div>
      )}

      <RecordPaymentModal 
        isOpen={recordPaymentOpen}
        onClose={() => {
          setRecordPaymentOpen(false);
          setEditingPayment(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['payments'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
          setRecordPaymentOpen(false);
          setEditingPayment(null);
        }}
        editPayment={editingPayment}
        contacts={contacts}
        accounts={accounts}
      />

      <BankAccountModal
        isOpen={bankModalOpen}
        onClose={() => {
          setBankModalOpen(false);
          setEditingAccount(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
          setBankModalOpen(false);
          setEditingAccount(null);
        }}
        editingAccount={editingAccount}
      />

      <Dialog open={!!viewPayment} onOpenChange={(open) => !open && setViewPayment(null)}>
        <DialogContent className="sm:max-w-2xl bg-white p-0 overflow-hidden">
          {viewPayment && (
            <>
            <div className="flex justify-between items-center p-4 border-b border-zinc-200 bg-zinc-50">
              <DialogTitle className="text-lg font-bold text-zinc-900">
                Payment Receipt: {viewPayment.paymentNumber}
              </DialogTitle>
              <Button onClick={printReceipt} variant="outline" size="sm" className="h-8">Print Receipt</Button>
            </div>
            <div className="p-6 max-h-[80vh] overflow-y-auto" id="printable-payment-receipt">
              <div className="space-y-6">
                
                {/* Header Info */}
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Payment Receipt</h2>
                    <p className="text-sm text-zinc-500 mt-1">Ref No: <span className="font-mono text-zinc-900">{viewPayment.paymentNumber}</span></p>
                    <p className="text-sm text-zinc-500">Date: <span className="font-mono text-zinc-900">{formatDate(viewPayment.paymentDate)}</span></p>
                  </div>
                  <div className="text-right">
                    <Badge className={
                      viewPayment.status === 'completed'
                        ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20 text-xs py-1'
                        : viewPayment.status === 'cancelled'
                        ? 'bg-red-500/10 text-red-700 border border-red-500/20 text-xs py-1'
                        : 'bg-zinc-100 text-zinc-600 border border-zinc-200 text-xs py-1'
                    }>
                      {viewPayment.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-6 bg-zinc-50 p-4 border border-zinc-200 rounded">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Received From / Paid To</span>
                    <p className="font-bold text-zinc-900">{viewPayment.contact?.name}</p>
                    {viewPayment.contact?.companyName && <p className="text-sm text-zinc-600">{viewPayment.contact.companyName}</p>}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Payment Method</span>
                    <p className="font-bold text-zinc-900 capitalize">{viewPayment.paymentMode?.replace('_', ' ')}</p>
                    {viewPayment.referenceId && <p className="text-sm text-zinc-600 font-mono mt-0.5">Ref: {viewPayment.referenceId}</p>}
                  </div>
                </div>

                {/* Amount details */}
                <div className="bg-zinc-50 p-4 border border-zinc-200 rounded flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Received / Paid</span>
                    <h5 className="font-mono text-xl font-bold text-amber-500">{formatCurrency(Number(viewPayment.amount))}</h5>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Unused/Unallocated Balance</span>
                    <h5 className="font-mono text-sm text-zinc-500">{formatCurrency(Number(viewPayment.unusedAmount))}</h5>
                  </div>
                </div>

                {/* Allocations Table */}
                {viewPayment.allocations && viewPayment.allocations.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Allocated Invoices</h5>
                    <div className="overflow-x-auto rounded border border-zinc-200">
                      <Table className="min-w-full text-left text-sm text-zinc-600">
                        <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                          <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                            <TableHead className="px-4 py-3">Invoice #</TableHead>
                            <TableHead className="px-4 py-3 text-right">Invoice total</TableHead>
                            <TableHead className="px-4 py-3 text-right">Amount Applied</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-zinc-100">
                          {viewPayment.allocations.map((a: any) => (
                            <TableRow key={a.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                              <TableCell className="px-4 py-3 font-bold text-zinc-900">{a.invoiceNumber}</TableCell>
                              <TableCell className="px-4 py-3 text-right">{formatCurrency(Number(a.totalAmount))}</TableCell>
                              <TableCell className="px-4 py-3 text-right font-bold text-zinc-900">{formatCurrency(Number(a.amountApplied))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {viewPayment.notes && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Payment comments / notes</span>
                    <p className="text-xs text-zinc-500 bg-zinc-50 p-2.5 border border-zinc-200 rounded">
                      {viewPayment.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* BANK ACCOUNT LEDGER MODAL */}
      <Dialog open={ledgerModalOpen} onOpenChange={setLedgerModalOpen}>
        <DialogContent className="w-full sm:max-w-4xl bg-zinc-50 p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader className="border-b border-zinc-200 pb-4 mb-4">
            <DialogTitle className="text-lg font-bold text-amber-500 uppercase tracking-wider text-left">
              Account Ledger: {accountLedgerData?.account?.accountName}
            </DialogTitle>
          </DialogHeader>

          {loadingLedger ? (
            <div className="flex justify-center p-8 text-amber-500">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
              <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-zinc-900">{accountLedgerData?.account?.bankName || 'Cash Book'}</h3>
                  <p className="text-xs text-zinc-500 font-mono mt-1">
                    {accountLedgerData?.account?.accountNumber ? `A/C: ${accountLedgerData.account.accountNumber}` : 'Internal Register'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Current Balance</p>
                  <p className="text-xl font-bold font-mono text-zinc-900">
                    {formatCurrency(Number(accountLedgerData?.account?.currentBalance || 0))}
                  </p>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <Table className="min-w-full text-left text-sm text-zinc-600">
                  <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500 border-b border-zinc-200">
                    <TableRow className="border-b border-zinc-100">
                      <TableHead className="px-4 py-3">Date</TableHead>
                      <TableHead className="px-4 py-3">Description</TableHead>
                      <TableHead className="px-4 py-3">Ref/Txn #</TableHead>
                      <TableHead className="px-4 py-3 text-right">Debit (+)</TableHead>
                      <TableHead className="px-4 py-3 text-right">Credit (-)</TableHead>
                      <TableHead className="px-4 py-3 text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-zinc-100">
                    <TableRow className="bg-zinc-50/30">
                      <TableCell className="px-4 py-3 text-zinc-500 italic" colSpan={5}>Opening Balance</TableCell>
                      <TableCell className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                        {formatCurrency(Number(accountLedgerData?.account?.openingBalance || 0))}
                      </TableCell>
                    </TableRow>
                    
                    {accountLedgerData?.ledger?.map((entry: any) => (
                      <TableRow key={entry.id} className="hover:bg-zinc-50 transition-colors">
                        <TableCell className="px-4 py-3 font-mono text-xs">{formatDate(entry.date)}</TableCell>
                        <TableCell className="px-4 py-3 text-zinc-900">{entry.description}</TableCell>
                        <TableCell className="px-4 py-3 font-mono text-xs text-zinc-500">{entry.transactionNumber}</TableCell>
                        <TableCell className="px-4 py-3 text-right font-mono text-green-600 font-medium">
                          {entry.entryType === 'debit' ? formatCurrency(Number(entry.amount)) : ''}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right font-mono text-red-600 font-medium">
                          {entry.entryType === 'credit' ? formatCurrency(Number(entry.amount)) : ''}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                          {formatCurrency(Number(entry.runningBalance))}
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {(!accountLedgerData?.ledger || accountLedgerData.ledger.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-zinc-500">
                          No transactions found for this account.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setLedgerModalOpen(false)}>Close Ledger</Button>
          </div>
        </DialogContent>
      </Dialog>

      {bulkChequeModalOpen && (
        <BulkChequeModal
          isOpen={bulkChequeModalOpen}
          onClose={() => setBulkChequeModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
          }}
          contacts={contacts}
          accounts={accounts}
        />
      )}

      {/* VOID PAYMENT CONFIRMATION MODAL */}
      <ConfirmDialog
        isOpen={!!voidConfirmPaymentId}
        onClose={() => setVoidConfirmPaymentId(null)}
        onConfirm={executeVoidPayment}
        title="Void Payment"
        description="Are you sure you want to void this payment? This action will revert the balances of all allocated invoices and adjust the bank account balance accordingly."
        confirmText="Confirm Void"
        variant="destructive"
      />

      {/* DELETE BANK ACCOUNT CONFIRMATION MODAL */}
      <ConfirmDialog
        isOpen={!!deleteConfirmAccountId}
        onClose={() => setDeleteConfirmAccountId(null)}
        onConfirm={executeDeleteBankAccount}
        title="Delete Bank Account"
        description="Are you sure you want to delete this bank account? This account cannot have any linked transactions."
        confirmText="Confirm Delete"
        variant="destructive"
      />
    </PageContainer>
  );
}
