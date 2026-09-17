'use client';

import { TableCell, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { API_ROUTES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { DataTable, type TableHeader as DataTableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { FileText, Plus, Search, Calendar, AlertCircle, CheckCircle2, Clock, DollarSign, ChevronRight, Edit3, Trash2 } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';

export default function InvoicesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Pagination & Filters State
  const [activeTab, setActiveTab] = useState('sales_invoice');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [datePreset, setDatePreset] = useState('all_time');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;

    const formatDateStr = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    switch (preset) {
      case 'current_month':
        setStartDate(formatDateStr(new Date(currentYear, currentMonth, 1)));
        setEndDate(formatDateStr(new Date(currentYear, currentMonth + 1, 0)));
        break;
      case 'last_month':
        setStartDate(formatDateStr(new Date(currentYear, currentMonth - 1, 1)));
        setEndDate(formatDateStr(new Date(currentYear, currentMonth, 0)));
        break;
      case 'current_fy':
        setStartDate(formatDateStr(new Date(fyStartYear, 3, 1)));
        setEndDate(formatDateStr(new Date(fyStartYear + 1, 2, 31)));
        break;
      case 'last_fy':
        setStartDate(formatDateStr(new Date(fyStartYear - 1, 3, 1)));
        setEndDate(formatDateStr(new Date(fyStartYear, 2, 31)));
        break;
      case 'all_time':
        setStartDate('');
        setEndDate('');
        break;
      case 'custom':
        break;
    }
    setPage(1);
  };

  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [cancelConfirmInvoiceId, setCancelConfirmInvoiceId] = useState<string | null>(null);

  const { user } = useAuth();

  const roleHierarchy: Record<string, number> = {
    viewer: 0,
    agent: 1,
    accountant: 2,
    manager: 3,
    admin: 4,
    owner: 5,
  };
  const userRoleLevel = user?.role ? roleHierarchy[user.role] || 0 : 0;
  const canCreate = userRoleLevel >= 1;
  const canEdit = userRoleLevel >= 1;
  const canDelete = userRoleLevel >= 3;

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const { data: invoicesData, isLoading: queryLoading, error: queryError } = useQuery({
    queryKey: ['invoices', { page, activeTab, searchQuery, statusFilter, startDate, endDate, sortBy, sortOrder }],
    queryFn: async () => {
      let url = `${API_ROUTES.INVOICES.BASE}?page=${page}&limit=15&type=${activeTab}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      const res = await api.get(url);
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const invoices = invoicesData?.data || [];
  
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv: any) => {
      const matchSearch = inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          inv.contactName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === '' || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, searchQuery, statusFilter]);

  const kpis = useMemo(() => {
    const totalVal = filteredInvoices.reduce((sum: number, inv: any) => sum + Number(inv.totalAmount || 0), 0);
    const balanceDueSum = filteredInvoices.reduce((sum: number, inv: any) => sum + Number(inv.balanceDue || 0), 0);
    const overdueCount = filteredInvoices.filter((inv: any) => inv.status === 'overdue').length;
    const paidCount = filteredInvoices.filter((inv: any) => inv.status === 'paid').length;
    return { totalVal, balanceDueSum, overdueCount, paidCount, count: filteredInvoices.length };
  }, [filteredInvoices]);

  const datePresetOptions = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    return [
      { value: 'all_time', label: 'All Time' },
      { value: 'current_month', label: `Current Month (${monthNames[currentMonth]} ${currentYear})` },
      { value: 'last_month', label: 'Last Month' },
      { value: 'current_fy', label: `Current FY (${fyStartYear}-${String(fyStartYear + 1).slice(-2)})` },
      { value: 'last_fy', label: 'Last FY' },
      { value: 'custom', label: 'Custom Date Range' },
    ];
  }, []);

  const totalPages = Math.ceil((invoicesData?.pagination?.total || 0) / (invoicesData?.pagination?.limit || 15)) || 1;

  const [cancelConfirmInvoice, setCancelConfirmInvoice] = useState<any | null>(null);

  const executeCancelInvoice = async () => {
    if (!cancelConfirmInvoice) return;
    try {
      const res = await api.delete(`${API_ROUTES.INVOICES.BASE}/${cancelConfirmInvoice.id}`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      
      const isPermanent = res.data?.data?.permanent;
      toast.success(isPermanent ? 'Draft invoice permanently deleted' : 'Invoice cancelled and marked as void');
      setCancelConfirmInvoice(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to process invoice deletion');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Paid</span>;
      case 'partially_paid':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Partial</span>;
      case 'sent':
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Approved</span>;
      case 'overdue':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-800 border border-red-200"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Overdue</span>;
      case 'draft':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200"><span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />Draft</span>;
      case 'cancelled':
      case 'void':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-800 text-white"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Cancelled</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 capitalize">{status}</span>;
    }
  };

  const tableHeaders: DataTableHeader[] = [
    { key: 'invoiceNumber', label: 'Document Number', sortable: true },
    { key: 'invoiceDate', label: 'Date', sortable: true },
    { key: 'dueDate', label: 'Due Date', sortable: true },
    { key: 'contactName', label: 'Party Contact', sortable: true },
    { key: 'totalAmount', label: 'Invoice Total', sortable: true, align: 'right' },
    { key: 'balanceDue', label: 'Balance Due', sortable: true, align: 'right' },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'actions', label: 'Actions', align: 'right' },
  ];

  const DOCUMENT_TABS = [
    { id: 'sales_invoice', label: 'Sales Invoices' },
    { id: 'purchase_invoice', label: 'Purchase Invoices' },
    { id: 'credit_note', label: 'Credit Notes' },
    { id: 'debit_note', label: 'Debit Notes' },
  ];

  return (
    <PageContainer className="max-w-full space-y-6">
      {/* Header */}
      <PageHeader 
        title="Invoicing & Billing Workspace" 
        subtitle="Manage tax-compliant GST invoices, track receivables, and audit settlement status."
      >
        {canCreate && (
          <Link href={`/dashboard/invoices/new?type=${activeTab}`}>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {activeTab === 'sales_invoice' && 'Create Sales Invoice'}
              {activeTab === 'purchase_invoice' && 'Create Purchase Invoice'}
              {activeTab === 'credit_note' && 'Create Credit Note'}
              {activeTab === 'debit_note' && 'Create Debit Note'}
            </Button>
          </Link>
        )}
      </PageHeader>

      {/* KPI Financial Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Documents</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-900">{kpis.count}</span>
            <FileText className="w-5 h-5 text-zinc-400" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Total Gross Value</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-amber-900">{formatCurrency(kpis.totalVal)}</span>
            <DollarSign className="w-5 h-5 text-amber-600" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">Outstanding Receivables</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-red-600">{formatCurrency(kpis.balanceDueSum)}</span>
            <Clock className="w-5 h-5 text-red-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Paid / Settled</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-700">{kpis.paidCount}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
        </Card>
      </div>

      {/* Segmented Document Tabs & Filters */}
      <Card className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-200/80 space-y-4">
        {/* Document Type Selector */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto bg-zinc-100 p-1 rounded-xl">
            {DOCUMENT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setPage(1); }}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search, Status Filter & Date Range Picker at the end */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <Input
              placeholder="Search by invoice # or contact..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="pl-9 h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl"
            />
          </div>

          <div className="w-[150px] shrink-0">
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'draft', label: 'Draft' },
                { value: 'approved', label: 'Approved' },
                { value: 'sent', label: 'Sent' },
                { value: 'partially_paid', label: 'Partially Paid' },
                { value: 'paid', label: 'Paid' },
                { value: 'overdue', label: 'Overdue' },
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
      </Card>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
        <DataTable
          headers={tableHeaders}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          isLoading={queryLoading}
          isEmpty={filteredInvoices.length === 0}
          emptyMessage="No documents found matching the filter criteria."
        >
          {(filteredInvoices as any[]).map((inv: any) => (
            <TableRow key={inv.id} className="hover:bg-zinc-50/80 transition-colors border-b border-zinc-100 group">
              <TableCell className="px-4 py-3.5">
                <Button
                  variant="ghost"
                  onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                  className="text-left font-mono font-bold text-xs text-amber-900 group-hover:text-amber-600 transition-colors p-0 h-auto"
                >
                  {inv.invoiceNumber}
                </Button>
              </TableCell>
              <TableCell className="px-4 py-3.5 text-xs text-zinc-600 font-medium">{formatDate(inv.invoiceDate)}</TableCell>
              <TableCell className="px-4 py-3.5 text-xs text-zinc-600 font-medium">
                {inv.dueDate ? formatDate(inv.dueDate) : <span className="text-zinc-400 italic">Immediate</span>}
              </TableCell>
              <TableCell className="px-4 py-3.5">
                <span className="block font-bold text-xs text-zinc-900">{inv.contactName}</span>
                {inv.companyName && <span className="block text-[10px] text-zinc-500 font-medium">{inv.companyName}</span>}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-right font-mono font-bold text-xs text-zinc-900">
                {formatCurrency(Number(inv.totalAmount))}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-zinc-700">
                {formatCurrency(Number(inv.balanceDue))}
              </TableCell>
              <TableCell className="px-4 py-3.5">
                {getStatusBadge(inv.status)}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-right">
                <div className="flex justify-end items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:bg-amber-50 h-7 px-2"
                  >
                    View
                  </Button>
                  {canEdit && (inv.status === 'draft' || inv.status === 'approved') && (
                    <Link href={`/dashboard/invoices/${inv.id}/edit`}>
                      <Button variant="ghost" size="sm" className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 h-7 px-2">
                        Edit
                      </Button>
                    </Link>
                  )}
                  {canDelete && inv.status !== 'cancelled' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCancelConfirmInvoice(inv)}
                      className={`text-xs font-semibold h-7 px-2 ${
                        inv.status === 'draft' 
                          ? 'text-red-600 hover:text-red-700 hover:bg-red-50' 
                          : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
                      }`}
                    >
                      {inv.status === 'draft' ? 'Delete Draft' : 'Cancel/Void'}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden flex flex-col gap-3">
        {filteredInvoices.map((inv: any) => (
          <Card key={inv.id} className="p-4 rounded-2xl shadow-sm border border-zinc-200/80 cursor-pointer space-y-2" onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}>
            <div className="flex justify-between items-start">
              <span className="font-bold font-mono text-amber-900 text-sm">{inv.invoiceNumber}</span>
              {getStatusBadge(inv.status)}
            </div>
            <div className="text-xs font-semibold text-zinc-800">{inv.contactName}</div>
            <div className="flex justify-between items-center text-xs pt-2 border-t border-zinc-100 font-mono">
              <span className="text-zinc-500 font-sans">{formatDate(inv.invoiceDate)}</span>
              <span className="font-bold text-zinc-900">{formatCurrency(Number(inv.totalAmount))}</span>
            </div>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      <ConfirmDialog
        isOpen={!!cancelConfirmInvoice}
        onClose={() => setCancelConfirmInvoice(null)}
        onConfirm={executeCancelInvoice}
        title={cancelConfirmInvoice?.status === 'draft' ? 'Delete Draft Invoice' : 'Cancel & Void Invoice'}
        description={
          cancelConfirmInvoice?.status === 'draft'
            ? `Permanently delete draft invoice "${cancelConfirmInvoice?.invoiceNumber}"? This cannot be undone.`
            : `Void invoice "${cancelConfirmInvoice?.invoiceNumber}"? This will mark it as cancelled, reverse stock movements, and retain the audit sequence.`
        }
        variant="destructive"
      />
    </PageContainer>
  );
}
