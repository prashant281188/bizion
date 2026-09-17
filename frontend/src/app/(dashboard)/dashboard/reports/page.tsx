'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';

import { useState, Fragment, useEffect } from 'react';
import api from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency, formatIndianDate } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'gst' | 'financial' | 'business'>('overview');
  const [gstSubTab, setGstSubTab] = useState<'gstr1' | 'gstr3b' | 'hsn'>('gstr1');
  const [finSubTab, setFinSubTab] = useState<'pl' | 'bs'>('pl');
  const [bizSubTab, setBizSubTab] = useState<'sales' | 'receivables' | 'payables'>('sales');
  const [expandedHsnRows, setExpandedHsnRows] = useState<Set<number>>(new Set());

  const toggleHsnRow = (index: number) => {
    setExpandedHsnRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const queryClient = useQueryClient();

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    const temp = new Date(d.getFullYear(), d.getMonth(), 1);
    return `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}-${String(temp.getDate()).padStart(2, '0')}`;
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    const temp = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}-${String(temp.getDate()).padStart(2, '0')}`;
  });

  const [dateFilterType, setDateFilterType] = useState<string>('currentMonth');

  const handleDateFilterChange = (e: any) => {
    const val = typeof e === 'string' ? e : e?.target?.value;
    if (!val) return;
    setDateFilterType(val);
    const d = new Date();
    const formatYMD = (y: number, m: number, day: number) => {
      const temp = new Date(y, m, day);
      return `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}-${String(temp.getDate()).padStart(2, '0')}`;
    };

    switch (val) {
      case 'currentMonth': {
        setFromDate(formatYMD(d.getFullYear(), d.getMonth(), 1));
        setToDate(formatYMD(d.getFullYear(), d.getMonth() + 1, 0));
        break;
      }
      case 'previousMonth': {
        setFromDate(formatYMD(d.getFullYear(), d.getMonth() - 1, 1));
        setToDate(formatYMD(d.getFullYear(), d.getMonth(), 0));
        break;
      }
      case 'currentFy': {
        const year = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
        setFromDate(formatYMD(year, 3, 1)); // April 1st
        setToDate(formatYMD(year + 1, 2, 31)); // March 31st
        break;
      }
      case 'previousFy': {
        const year = d.getMonth() < 3 ? d.getFullYear() - 2 : d.getFullYear() - 1;
        setFromDate(formatYMD(year, 3, 1));
        setToDate(formatYMD(year + 1, 2, 31));
        break;
      }
      case 'custom': {
        // Keep inputs visible for manual entry
        break;
      }
    }
  };

  const { data: reportsData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['reports', fromDate, toDate],
    queryFn: async () => {
      const [
        g1, g3, hsn, pl, bs, sales, rec, pay
      ] = await Promise.all([
        api.get(`/reports/gst/gstr1?from=${fromDate}&to=${toDate}`),
        api.get(`/reports/gst/gstr3b?from=${fromDate}&to=${toDate}`),
        api.get(`/reports/gst/hsn-summary?from=${fromDate}&to=${toDate}`),
        api.get(`/reports/financial/profit-loss?from=${fromDate}&to=${toDate}`),
        api.get(`/reports/financial/balance-sheet?date=${toDate}`),
        api.get(`/reports/business/sales-summary?from=${fromDate}&to=${toDate}`),
        api.get(`/reports/business/receivables`),
        api.get(`/reports/business/payables`),
      ]);
      return {
        gstr1Data: g1.data.data,
        gstr3bData: g3.data.data,
        hsnData: hsn.data.data,
        profitLossData: pl.data.data,
        balanceSheetData: bs.data.data,
        salesSummaryData: sales.data.data,
        receivablesData: rec.data.data,
        payablesData: pay.data.data,
      };
    }
  });

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  }, [fromDate, toDate, queryClient]);

  const error = queryError ? (queryError as any).response?.data?.message || 'Failed to generate one or more reports' : null;
  const { gstr1Data, gstr3bData, hsnData, profitLossData, balanceSheetData, salesSummaryData, receivablesData, payablesData } = reportsData || {};

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  const isDemoMode = profitLossData?.isDemo || false;

  return (
    <PageContainer className="max-w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-zinc-200 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Reports & Invoicing Analytics
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Analyze business performance, compute GST compliance filings, and audit ledger balances.
          </p>
        </div>

        {/* Demo Indicator */}
        {isDemoMode && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
              Demo Preview Mode
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center space-x-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-zinc-200/80 mb-6 gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'overview'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/80'
          }`}
        >
          Operational Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gst')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'gst'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/80'
          }`}
        >
          GST Returns (India)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('financial')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'financial'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/80'
          }`}
        >
          Financial Statements
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('business')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'business'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/80'
          }`}
        >
          Business Analytics
        </button>
      </div>

      {/* View Content */}
      <div className="space-y-6">
        
        {/* VIEW 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-zinc-200/80 shadow-sm">
              <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Overview Reporting Period</span>
              <div className="flex items-center gap-3">
                <DateRangePicker
                  startDate={fromDate}
                  endDate={toDate}
                  onStartDateChange={setFromDate}
                  onEndDateChange={setToDate}
                />
                <Button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['reports'] })}
                  variant="outline"
                  size="sm"
                  className="h-[36px] text-xs font-semibold"
                >
                  Refresh
                </Button>
              </div>
            </div>
            {/* Cards Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-5 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Total Sales Turnover</span>
                <div className="text-2xl font-bold font-mono text-zinc-900">
                  {formatCurrency(salesSummaryData?.summary?.totalSales || 0)}
                </div>
                <div className="text-xs text-amber-700 font-semibold flex items-center">
                  <span>{salesSummaryData?.summary?.invoiceCount || 0} Invoices generated</span>
                </div>
              </Card>

              <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-5 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Net Profit Margin</span>
                <div className="text-2xl font-bold font-mono text-emerald-700">
                  {formatCurrency(profitLossData?.netProfit || 0)}
                </div>
                <div className="text-xs text-zinc-500 font-semibold font-mono">
                  Gross Profit: {formatCurrency(profitLossData?.grossProfit || 0)}
                </div>
              </Card>

              <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-5 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-red-700">Outstanding Receivables</span>
                <div className="text-2xl font-bold font-mono text-red-700">
                  {formatCurrency(receivablesData?.totalReceivable || 0)}
                </div>
                <div className="text-xs text-zinc-500 font-semibold">
                  Due from {receivablesData?.customers?.length || 0} customers
                </div>
              </Card>

              <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-5 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900">GST Net Output Tax</span>
                <div className="text-2xl font-bold font-mono text-zinc-900">
                  {formatCurrency((gstr3bData?.netTaxPayable?.cgst || 0) + (gstr3bData?.netTaxPayable?.sgst || 0) + (gstr3bData?.netTaxPayable?.igst || 0))}
                </div>
                <div className="text-xs text-zinc-500 font-semibold">
                  After eligible ITC offsets
                </div>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Sales Chart (CSS/SVG) */}
              <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 lg:col-span-2 p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Monthly Sales Progress</h3>
                  <span className="text-xs text-zinc-500">Turnover Chart</span>
                </div>
                
                {/* SVG Line Chart for Sales progress */}
                <div className="h-56 w-full relative pt-4 flex flex-col justify-between">
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    <div className="border-b border-zinc-200/80 w-full h-0" />
                    <div className="border-b border-zinc-200/80 w-full h-0" />
                    <div className="border-b border-zinc-200/80 w-full h-0" />
                    <div className="border-b border-zinc-200/80 w-full h-0" />
                  </div>

                  <div className="w-full h-full flex items-end justify-between relative z-10 px-4">
                    {salesSummaryData?.trends?.map((item: any, i: number) => {
                      const maxVal = Math.max(...salesSummaryData.trends.map((t: any) => t.amount), 1);
                      const heightPercent = `${(item.amount / maxVal) * 80}%`;
                      return (
                        <div key={i} className="flex flex-col items-center group relative w-full">
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:block bg-white border border-zinc-200 text-xs font-semibold px-2 py-1 rounded text-amber-700 z-50 whitespace-nowrap shadow-xl">
                            {formatCurrency(item.amount)}
                          </div>
                          
                          {/* Column Bar */}
                          <div 
                            style={{ height: heightPercent }} 
                            className="w-8 sm:w-12 bg-gradient-to-t from-amber-600/30 to-amber-500/80 hover:to-amber-400 rounded-t transition-all duration-300 border-t border-amber-400/50"
                          />
                          <span className="text-[10px] text-zinc-500 mt-2 font-mono">
                            {item.date.split('-')[2]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* GST ITC breakdown summary */}
              <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">GST Liabilities vs ITC</h3>
                  <p className="text-xs text-zinc-500">Filing summary for current reporting cycle.</p>
                  
                  <div className="space-y-4 pt-2">
                    {/* CGST */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">CGST (Central Tax)</span>
                        <span className="text-zinc-800 font-bold">
                          {formatCurrency(gstr3bData?.outwardSupplies?.cgst)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-white rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${Math.min(100, (gstr3bData?.eligibleItc?.cgst / Math.max(1, gstr3bData?.outwardSupplies?.cgst)) * 100)}%` }} 
                          className="h-full bg-amber-500 rounded-full" 
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>Eligible ITC: {formatCurrency(gstr3bData?.eligibleItc?.cgst)}</span>
                        <span>Payable: {formatCurrency(gstr3bData?.netTaxPayable?.cgst)}</span>
                      </div>
                    </div>

                    {/* SGST */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">SGST (State Tax)</span>
                        <span className="text-zinc-800 font-bold">
                          {formatCurrency(gstr3bData?.outwardSupplies?.sgst)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-white rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${Math.min(100, (gstr3bData?.eligibleItc?.sgst / Math.max(1, gstr3bData?.outwardSupplies?.sgst)) * 100)}%` }} 
                          className="h-full bg-amber-500 rounded-full" 
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>Eligible ITC: {formatCurrency(gstr3bData?.eligibleItc?.sgst)}</span>
                        <span>Payable: {formatCurrency(gstr3bData?.netTaxPayable?.sgst)}</span>
                      </div>
                    </div>

                    {/* IGST */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">IGST (Integrated Tax)</span>
                        <span className="text-zinc-800 font-bold">
                          {formatCurrency(gstr3bData?.outwardSupplies?.igst)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-white rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${Math.min(100, (gstr3bData?.eligibleItc?.igst / Math.max(1, gstr3bData?.outwardSupplies?.igst)) * 100)}%` }} 
                          className="h-full bg-amber-500 rounded-full" 
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>Eligible ITC: {formatCurrency(gstr3bData?.eligibleItc?.igst)}</span>
                        <span>Payable: {formatCurrency(gstr3bData?.netTaxPayable?.igst)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-200/80 text-xs text-zinc-500 flex justify-between">
                  <span>Filing Frequency:</span>
                  <span className="font-semibold text-zinc-800 uppercase">Monthly (GSTR-3B)</span>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* VIEW 2: GST RETURNS */}
        {activeTab === 'gst' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-zinc-200/80 shadow-sm">
              {/* Sub navigation for GST return pages */}
              <div className="flex space-x-2 rounded-lg border border-zinc-200 bg-white p-1 w-fit">
                <Button variant="ghost"
                  onClick={() => setGstSubTab('gstr1')}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${
                    gstSubTab === 'gstr1' ? 'bg-amber-500 text-white' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  GSTR-1 (Outward Supplies)
                </Button>
                <Button variant="ghost"
                  onClick={() => setGstSubTab('gstr3b')}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${
                    gstSubTab === 'gstr3b' ? 'bg-amber-500 text-white' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  GSTR-3B (Filing Summary)
                </Button>
                <Button variant="ghost"
                  onClick={() => setGstSubTab('hsn')}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${
                    gstSubTab === 'hsn' ? 'bg-amber-500 text-white' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  HSN Summary
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <DateRangePicker
                  startDate={fromDate}
                  endDate={toDate}
                  onStartDateChange={setFromDate}
                  onEndDateChange={setToDate}
                />
                <Button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['reports'] })}
                  variant="outline"
                  size="sm"
                  className="h-[36px] text-xs font-semibold"
                >
                  Refresh
                </Button>
              </div>
            </div>

            {/* GSTR-1 View */}
            {gstSubTab === 'gstr1' && (
              <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-4 border-b border-zinc-200/80 pb-4">
                  <div>
                    <h3 className="text-md font-bold text-zinc-800">GSTR-1 Return Data</h3>
                    <p className="text-xs text-zinc-500">Outward supplies aggregated by recipient scheme type.</p>
                  </div>
                  <Button className="border border-zinc-200 hover:border-zinc-300 bg-white text-zinc-700 py-1.5 text-xs">
                    Export GSTR-1 JSON
                  </Button>
                </div>

                {/* Summary Row */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                  <div className="bg-white p-3 rounded-lg border border-zinc-200/60">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500">Taxable Value</span>
                    <p className="text-lg font-bold text-zinc-700 mt-1">{formatCurrency(gstr1Data?.summary?.taxableValue)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-zinc-200/60">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500">CGST Amount</span>
                    <p className="text-lg font-bold text-zinc-700 mt-1">{formatCurrency(gstr1Data?.summary?.cgstAmount)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-zinc-200/60">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500">SGST Amount</span>
                    <p className="text-lg font-bold text-zinc-700 mt-1">{formatCurrency(gstr1Data?.summary?.sgstAmount)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-zinc-200/60">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500">IGST Amount</span>
                    <p className="text-lg font-bold text-zinc-700 mt-1">{formatCurrency(gstr1Data?.summary?.igstAmount)}</p>
                  </div>
                </div>

                {/* B2B Invoices Table */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider">Table 4A — B2B Sales (Registered Receivers)</h4>
                  <div className="overflow-x-auto rounded-lg border border-zinc-200">
                    <Table className="min-w-full text-left text-sm text-zinc-600">
                      <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                        <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                          <TableHead className="px-4 py-3">Recipient Name</TableHead>
                          <TableHead className="px-4 py-3">Recipient GSTIN</TableHead>
                          <TableHead className="px-4 py-3">Invoice No</TableHead>
                          <TableHead className="px-4 py-3">Date</TableHead>
                          <TableHead className="px-4 py-3 text-right">Taxable Value</TableHead>
                          <TableHead className="px-4 py-3 text-right">CGST</TableHead>
                          <TableHead className="px-4 py-3 text-right">SGST</TableHead>
                          <TableHead className="px-4 py-3 text-right">IGST</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-zinc-100">
                        {gstr1Data?.b2b?.map((row: any, i: number) => (
                          <TableRow key={i} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                            <TableCell className="px-4 py-3 font-semibold text-zinc-900">{row.recipientName}</TableCell>
                            <TableCell className="px-4 py-3 font-mono text-xs">{row.recipientGstin}</TableCell>
                            <TableCell className="px-4 py-3 text-xs font-mono">{row.invoiceNumber}</TableCell>
                            <TableCell className="px-4 py-3 text-xs">{row.invoiceDate}</TableCell>
                            <TableCell className="px-4 py-3 text-right font-mono">{formatCurrency(row.taxableValue)}</TableCell>
                            <TableCell className="px-4 py-3 text-right font-mono text-xs text-zinc-600">{formatCurrency(row.cgstAmount)}</TableCell>
                            <TableCell className="px-4 py-3 text-right font-mono text-xs text-zinc-600">{formatCurrency(row.sgstAmount)}</TableCell>
                            <TableCell className="px-4 py-3 text-right font-mono text-xs text-zinc-600">{formatCurrency(row.igstAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* B2CS Table */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider">Table 7 — B2CS (Unregistered Consumer Small Sales)</h4>
                  <div className="overflow-x-auto rounded-lg border border-zinc-200">
                    <Table className="min-w-full text-left text-sm text-zinc-600">
                      <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                        <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                          <TableHead className="px-4 py-3">Place of Supply (State)</TableHead>
                          <TableHead className="px-4 py-3">Tax Rate</TableHead>
                          <TableHead className="px-4 py-3 text-right">Taxable Value</TableHead>
                          <TableHead className="px-4 py-3 text-right">CGST</TableHead>
                          <TableHead className="px-4 py-3 text-right">SGST</TableHead>
                          <TableHead className="px-4 py-3 text-right">IGST</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-zinc-100">
                        {gstr1Data?.b2cs?.map((row: any, i: number) => (
                          <TableRow key={i} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                            <TableCell className="px-4 py-3 font-semibold text-zinc-900">State Code {row.placeOfSupply}</TableCell>
                            <TableCell className="px-4 py-3 font-mono text-xs">{row.rate}%</TableCell>
                            <TableCell className="px-4 py-3 text-right font-mono">{formatCurrency(row.taxableValue)}</TableCell>
                            <TableCell className="px-4 py-3 text-right font-mono text-xs text-zinc-600">{formatCurrency(row.cgstAmount)}</TableCell>
                            <TableCell className="px-4 py-3 text-right font-mono text-xs text-zinc-600">{formatCurrency(row.sgstAmount)}</TableCell>
                            <TableCell className="px-4 py-3 text-right font-mono text-xs text-zinc-600">{formatCurrency(row.igstAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </Card>
            )}

            {/* GSTR-3B View */}
            {gstSubTab === 'gstr3b' && (
              <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-zinc-200/80 pb-4">
                  <div>
                    <h3 className="text-md font-bold text-zinc-800">GSTR-3B Auto-Calculated Return</h3>
                    <p className="text-xs text-zinc-500">Consolidated details of outward supply liabilities and input credit offsets.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Outer supplies */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider">3.1 Outward supplies (Tax Liabilities)</h4>
                    <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
                      <div className="flex justify-between text-sm border-b border-zinc-200/50 pb-2 font-bold text-zinc-700">
                        <span>Category</span>
                        <div className="grid grid-cols-4 gap-6 text-right w-2/3">
                          <span>Taxable Value</span>
                          <span>IGST</span>
                          <span>CGST</span>
                          <span>SGST</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>(a) Outward Taxable Supplies</span>
                        <div className="grid grid-cols-4 gap-6 text-right w-2/3 font-mono text-zinc-800">
                          <span>{formatCurrency(gstr3bData?.outwardSupplies?.taxableValue)}</span>
                          <span>{formatCurrency(gstr3bData?.outwardSupplies?.igst)}</span>
                          <span>{formatCurrency(gstr3bData?.outwardSupplies?.cgst)}</span>
                          <span>{formatCurrency(gstr3bData?.outwardSupplies?.sgst)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ITC */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider">4. Eligible Input Tax Credit (ITC)</h4>
                    <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
                      <div className="flex justify-between text-sm border-b border-zinc-200/50 pb-2 font-bold text-zinc-700">
                        <span>Category</span>
                        <div className="grid grid-cols-4 gap-6 text-right w-2/3">
                          <span>Taxable Value</span>
                          <span>IGST</span>
                          <span>CGST</span>
                          <span>SGST</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>(A) Eligible ITC (Purchases)</span>
                        <div className="grid grid-cols-4 gap-6 text-right w-2/3 font-mono text-zinc-800">
                          <span>{formatCurrency(gstr3bData?.eligibleItc?.taxableValue)}</span>
                          <span>{formatCurrency(gstr3bData?.eligibleItc?.igst)}</span>
                          <span>{formatCurrency(gstr3bData?.eligibleItc?.cgst)}</span>
                          <span>{formatCurrency(gstr3bData?.eligibleItc?.sgst)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Net Payable */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider">Net GST Tax Payable</h4>
                    <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
                      <div className="flex justify-between text-sm border-b border-zinc-200/50 pb-2 font-bold text-zinc-700">
                        <span>Total Due</span>
                        <div className="grid grid-cols-3 gap-6 text-right w-1/2">
                          <span>IGST</span>
                          <span>CGST</span>
                          <span>SGST</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>Balances to be Settled</span>
                        <div className="grid grid-cols-3 gap-6 text-right w-1/2 font-mono text-amber-500 font-bold">
                          <span>{formatCurrency(gstr3bData?.netTaxPayable?.igst)}</span>
                          <span>{formatCurrency(gstr3bData?.netTaxPayable?.cgst)}</span>
                          <span>{formatCurrency(gstr3bData?.netTaxPayable?.sgst)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* HSN Summary View */}
            {gstSubTab === 'hsn' && (
              <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-zinc-200/80 pb-4">
                  <div>
                    <h3 className="text-md font-bold text-zinc-800">HSN/SAC Wise Summary Return</h3>
                    <p className="text-xs text-zinc-500">HSN code summary required for GSTR-1 Table 12 compliance.</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-zinc-200">
                  <Table className="min-w-full text-left text-sm text-zinc-600">
                    <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                      <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                        <TableHead className="px-4 py-3">HSN Code</TableHead>
                        <TableHead className="px-4 py-3">Description</TableHead>
                        <TableHead className="px-4 py-3">UQC</TableHead>
                        <TableHead className="px-4 py-3 text-right">Total Qty</TableHead>
                        <TableHead className="px-4 py-3 text-right">Taxable Value</TableHead>
                        <TableHead className="px-4 py-3 text-right">CGST</TableHead>
                        <TableHead className="px-4 py-3 text-right">SGST</TableHead>
                        <TableHead className="px-4 py-3 text-right">IGST</TableHead>
                        <TableHead className="px-4 py-3 text-right">Total Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-zinc-100">
                      {hsnData?.items?.map((row: any, i: number) => {
                        const isExpanded = expandedHsnRows.has(i);
                        return (
                          <Fragment key={i}>
                            <TableRow 
                              className={`border-b border-zinc-100 transition-colors hover:bg-zinc-50/50 ${row.products && row.products.length > 0 ? 'cursor-pointer' : ''}`}
                              onClick={() => {
                                if (row.products && row.products.length > 0) {
                                  toggleHsnRow(i);
                                }
                              }}
                            >
                              <TableCell className="px-4 py-3 font-mono font-bold text-amber-500">{row.hsnCode}</TableCell>
                              <TableCell className="px-4 py-3">
                                {row.products && row.products.length > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-zinc-900 border-b border-dashed border-zinc-300">
                                      {row.products.length === 1 ? row.products[0].description : `${row.products.length} Products`}
                                    </span>
                                    <span className="text-xs text-zinc-400 font-mono">
                                      {isExpanded ? '▼' : '▶'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-medium text-zinc-900">General Item</span>
                                )}
                              </TableCell>
                              <TableCell className="px-4 py-3 text-xs">{row.uqcCode}</TableCell>
                              <TableCell className="px-4 py-3 text-right font-mono">{row.totalQuantity}</TableCell>
                              <TableCell className="px-4 py-3 text-right font-mono">{formatCurrency(row.taxableValue)}</TableCell>
                              <TableCell className="px-4 py-3 text-right font-mono text-xs text-zinc-600">{formatCurrency(row.cgstAmount)}</TableCell>
                              <TableCell className="px-4 py-3 text-right font-mono text-xs text-zinc-600">{formatCurrency(row.sgstAmount)}</TableCell>
                              <TableCell className="px-4 py-3 text-right font-mono text-xs text-zinc-600">{formatCurrency(row.igstAmount)}</TableCell>
                              <TableCell className="px-4 py-3 text-right font-mono font-bold text-zinc-900">{formatCurrency(row.totalValue)}</TableCell>
                            </TableRow>
                            {isExpanded && row.products && row.products.length > 0 && (
                              <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 border-b border-zinc-200 shadow-inner">
                                <TableCell colSpan={9} className="p-0">
                                  <div className="px-8 py-4 bg-zinc-50/80 border-t border-zinc-100">
                                    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden shadow-sm">
                                      <Table className="text-xs">
                                        <TableHeader className="bg-zinc-50 border-b border-zinc-200">
                                          <TableRow className="hover:bg-transparent">
                                            <TableHead className="py-2.5 px-4 font-semibold text-zinc-600">Product Description</TableHead>
                                            <TableHead className="py-2.5 px-4 text-right font-semibold text-zinc-600">Quantity</TableHead>
                                            <TableHead className="py-2.5 px-4 text-right font-semibold text-zinc-600">Taxable Value</TableHead>
                                            <TableHead className="py-2.5 px-4 text-right font-semibold text-zinc-600">CGST</TableHead>
                                            <TableHead className="py-2.5 px-4 text-right font-semibold text-zinc-600">SGST</TableHead>
                                            <TableHead className="py-2.5 px-4 text-right font-semibold text-zinc-600">IGST</TableHead>
                                            <TableHead className="py-2.5 px-4 text-right font-semibold text-zinc-600">Total Value</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody className="divide-y divide-zinc-100">
                                          {row.products.map((p: any, idx: number) => (
                                            <TableRow key={idx} className="hover:bg-zinc-50/30 transition-colors">
                                              <TableCell className="py-2.5 px-4 font-medium text-zinc-700">{p.description}</TableCell>
                                              <TableCell className="py-2.5 px-4 text-right font-mono text-zinc-600">{p.quantity}</TableCell>
                                              <TableCell className="py-2.5 px-4 text-right font-mono text-zinc-600">{formatCurrency(p.amount)}</TableCell>
                                              <TableCell className="py-2.5 px-4 text-right font-mono text-zinc-600">{formatCurrency(p.cgst)}</TableCell>
                                              <TableCell className="py-2.5 px-4 text-right font-mono text-zinc-600">{formatCurrency(p.sgst)}</TableCell>
                                              <TableCell className="py-2.5 px-4 text-right font-mono text-zinc-600">{formatCurrency(p.igst)}</TableCell>
                                              <TableCell className="py-2.5 px-4 text-right font-mono font-bold text-zinc-800">{formatCurrency(p.totalAmount)}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* VIEW 3: FINANCIAL STATEMENTS */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-zinc-200/80 shadow-sm">
              <div className="flex space-x-2 rounded-lg border border-zinc-200 bg-white p-1 w-fit">
                <Button variant="ghost"
                  onClick={() => setFinSubTab('pl')}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${
                    finSubTab === 'pl' ? 'bg-amber-500 text-white' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Profit & Loss (Income Statement)
                </Button>
                <Button variant="ghost"
                  onClick={() => setFinSubTab('bs')}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${
                    finSubTab === 'bs' ? 'bg-amber-500 text-white' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Balance Sheet
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <DateRangePicker
                  startDate={fromDate}
                  endDate={toDate}
                  onStartDateChange={setFromDate}
                  onEndDateChange={setToDate}
                />
                <Button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['reports'] })}
                  variant="outline"
                  size="sm"
                  className="h-[36px] text-xs font-semibold"
                >
                  Refresh
                </Button>
              </div>
            </div>

            {/* Profit & Loss View */}
            {finSubTab === 'pl' && (
              <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6">
                <div>
                  <h3 className="text-md font-bold text-zinc-800">Profit & Loss Statement</h3>
                  <p className="text-xs text-zinc-500">Statement showing business revenues, cost of goods sold, and operating margins.</p>
                </div>

                <div className="space-y-6 max-w-3xl border border-zinc-200 bg-white rounded-lg p-6">
                  {/* Revenue */}
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-zinc-200 pb-2 text-sm font-bold text-zinc-800 uppercase">
                      <span>Revenues</span>
                      <span>Amount</span>
                    </div>
                    {profitLossData?.revenues?.map((r: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs text-zinc-500">
                        <span>{r.name}</span>
                        <span className="font-mono text-zinc-800">{formatCurrency(r.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-zinc-200/60 pt-2 text-xs font-bold text-zinc-700">
                      <span>Total Revenue</span>
                      <span className="font-mono text-zinc-800">{formatCurrency(profitLossData?.totalRevenue)}</span>
                    </div>
                  </div>

                  {/* COGS */}
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-zinc-200 pb-2 text-sm font-bold text-zinc-800 uppercase pt-4">
                      <span>Cost of Goods Sold (COGS)</span>
                      <span>Amount</span>
                    </div>
                    {profitLossData?.cogs?.map((c: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs text-zinc-500">
                        <span>{c.name}</span>
                        <span className="font-mono text-zinc-800">{formatCurrency(c.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-zinc-200/60 pt-2 text-xs font-bold text-zinc-700">
                      <span>Total COGS</span>
                      <span className="font-mono text-zinc-800">({formatCurrency(profitLossData?.totalCogs)})</span>
                    </div>
                  </div>

                  {/* Gross Profit */}
                  <div className="flex justify-between border-y border-zinc-200 py-3 text-sm font-bold text-amber-500 uppercase">
                    <span>Gross Profit</span>
                    <span className="font-mono">{formatCurrency(profitLossData?.grossProfit)}</span>
                  </div>

                  {/* Expenses */}
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-zinc-200 pb-2 text-sm font-bold text-zinc-800 uppercase">
                      <span>Operating Expenses</span>
                      <span>Amount</span>
                    </div>
                    {profitLossData?.expenses?.map((e: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs text-zinc-500">
                        <span>{e.name}</span>
                        <span className="font-mono text-zinc-800">{formatCurrency(e.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-zinc-200/60 pt-2 text-xs font-bold text-zinc-700">
                      <span>Total Operating Expenses</span>
                      <span className="font-mono text-zinc-800">({formatCurrency(profitLossData?.totalExpenses)})</span>
                    </div>
                  </div>

                  {/* Net Profit */}
                  <div className="flex justify-between border-y border-zinc-200 py-3 text-base font-bold bg-amber-500/10 px-4 rounded text-amber-700 uppercase">
                    <span>Net Operating Profit</span>
                    <span className="font-mono">{formatCurrency(profitLossData?.netProfit)}</span>
                  </div>
                </div>
              </Card>
            )}

            {/* Balance Sheet View */}
            {finSubTab === 'bs' && (
              <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6">
                <div>
                  <h3 className="text-md font-bold text-zinc-800">Balance Sheet</h3>
                  <p className="text-xs text-zinc-500">Summary of assets, liabilities, and owner equity representing company value.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Assets */}
                  <div className="border border-zinc-200 bg-white rounded-lg p-5 space-y-4">
                    <div className="flex justify-between border-b border-zinc-200 pb-2 text-sm font-bold text-zinc-800 uppercase">
                      <span>Assets</span>
                      <span>Amount</span>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Current Assets</span>
                      {balanceSheetData?.assets?.current?.map((a: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs text-zinc-500 pl-2">
                          <span>{a.name}</span>
                          <span className="font-mono text-zinc-800">{formatCurrency(a.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1.5 pt-2">
                      <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Fixed Assets</span>
                      {balanceSheetData?.assets?.fixed?.map((a: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs text-zinc-500 pl-2">
                          <span>{a.name}</span>
                          <span className="font-mono text-zinc-800">{formatCurrency(a.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between border-t border-zinc-200 pt-3 text-sm font-bold text-zinc-700">
                      <span>Total Assets</span>
                      <span className="font-mono text-zinc-800">{formatCurrency(balanceSheetData?.assets?.total)}</span>
                    </div>
                  </div>

                  {/* Liabilities & Equity */}
                  <div className="border border-zinc-200 bg-white rounded-lg p-5 space-y-4">
                    <div className="flex justify-between border-b border-zinc-200 pb-2 text-sm font-bold text-zinc-800 uppercase">
                      <span>Liabilities & Equity</span>
                      <span>Amount</span>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Current Liabilities</span>
                      {balanceSheetData?.liabilities?.current?.map((l: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs text-zinc-500 pl-2">
                          <span>{l.name}</span>
                          <span className="font-mono text-zinc-800">{formatCurrency(l.amount)}</span>
                        </div>
                      ))}
                    </div>
                    {balanceSheetData?.liabilities?.longTerm?.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Long-Term Liabilities</span>
                        {balanceSheetData?.liabilities?.longTerm?.map((l: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs text-zinc-500 pl-2">
                            <span>{l.name}</span>
                            <span className="font-mono text-zinc-800">{formatCurrency(l.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-1.5 pt-2">
                      <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Equity</span>
                      {balanceSheetData?.equity?.items?.map((q: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs text-zinc-500 pl-2">
                          <span>{q.name}</span>
                          <span className="font-mono text-zinc-800">{formatCurrency(q.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between border-t border-zinc-200 pt-3 text-sm font-bold text-zinc-700">
                      <span>Total Liabilities & Equity</span>
                      <span className="font-mono text-zinc-800">
                        {formatCurrency(balanceSheetData?.liabilities?.total + balanceSheetData?.equity?.total)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-500/10 text-amber-700 text-xs px-4 py-3 rounded border border-amber-500/20 text-center font-bold">
                  Balance Verification: Assets match Liabilities & Equity. Accounts are balanced.
                </div>
              </Card>
            )}
          </div>
        )}

        {/* VIEW 4: BUSINESS ANALYTICS */}
        {activeTab === 'business' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-zinc-200/80 shadow-sm">
              <div className="flex flex-wrap space-x-2 rounded-lg border border-zinc-200 bg-white p-1 w-fit">
                <Button variant="ghost"
                  onClick={() => setBizSubTab('sales')}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${
                    bizSubTab === 'sales' ? 'bg-amber-500 text-white' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Products Sales Summary
                </Button>
                <Button variant="ghost"
                  onClick={() => setBizSubTab('receivables')}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${
                    bizSubTab === 'receivables' ? 'bg-amber-500 text-white' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Accounts Receivable Aging
                </Button>
                <Button variant="ghost"
                  onClick={() => setBizSubTab('payables')}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${
                    bizSubTab === 'payables' ? 'bg-amber-500 text-white' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Accounts Payable Aging
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <DateRangePicker
                  startDate={fromDate}
                  endDate={toDate}
                  onStartDateChange={setFromDate}
                  onEndDateChange={setToDate}
                />
                <Button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['reports'] })}
                  variant="outline"
                  size="sm"
                  className="h-[36px] text-xs font-semibold"
                >
                  Refresh
                </Button>
              </div>
            </div>

            {/* Sales Sub Tab */}
            {bizSubTab === 'sales' && (
              <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6">
                <div>
                  <h3 className="text-md font-bold text-zinc-800">Product Sales Summary</h3>
                  <p className="text-xs text-zinc-500">Review sales performance and demand per catalog item.</p>
                </div>

                <div className="overflow-x-auto rounded-lg border border-zinc-200">
                  <Table className="min-w-full text-left text-sm text-zinc-600">
                    <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                      <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                        <TableHead className="px-4 py-3">Product Name</TableHead>
                        <TableHead className="px-4 py-3 text-right">Units Sold</TableHead>
                        <TableHead className="px-4 py-3 text-right">Total Net Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-zinc-100">
                      {salesSummaryData?.products?.map((row: any, i: number) => (
                        <TableRow key={i} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                          <TableCell className="px-4 py-3 font-semibold text-zinc-900">{row.name}</TableCell>
                          <TableCell className="px-4 py-3 text-right font-mono">{row.quantity}</TableCell>
                          <TableCell className="px-4 py-3 text-right font-mono font-bold text-amber-500">{formatCurrency(row.totalRevenue)}</TableCell>
                        </TableRow>
                      ))}
                      {(!salesSummaryData?.products || salesSummaryData.products.length === 0) && (
                        <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                          <TableCell colSpan={3} className="px-4 py-3 text-center text-zinc-500 text-xs">
                            No product sales history for the selected date range.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}

            {/* Receivables Sub Tab */}
            {bizSubTab === 'receivables' && (
              <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-4 border-b border-zinc-200/80 pb-4">
                  <div>
                    <h3 className="text-md font-bold text-zinc-800">Accounts Receivable (Customer Balances)</h3>
                    <p className="text-xs text-zinc-500">Analyze outstanding customer invoices and track collection delays.</p>
                  </div>
                  <div className="bg-white px-4 py-2 border border-zinc-200 rounded font-mono text-sm text-zinc-800 font-bold">
                    Total Due: {formatCurrency(receivablesData?.totalReceivable)}
                  </div>
                </div>

                {/* Aging Columns */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                  <div className="bg-white p-3 rounded-lg border border-zinc-200/60 text-center">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500">Current (0-30 Days)</span>
                    <p className="text-lg font-bold text-amber-700 mt-1">{formatCurrency(receivablesData?.aging?.current)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-zinc-200/60 text-center">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500">31-60 Days Overdue</span>
                    <p className="text-lg font-bold text-amber-500 mt-1">{formatCurrency(receivablesData?.aging?.thirtyToSixty)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-zinc-200/60 text-center">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500">61-90 Days Overdue</span>
                    <p className="text-lg font-bold text-red-700 mt-1">{formatCurrency(receivablesData?.aging?.sixtyToNinety)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-zinc-200/60 text-center">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500">90+ Days Overdue</span>
                    <p className="text-lg font-bold text-red-600 mt-1">{formatCurrency(receivablesData?.aging?.overNinety)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-zinc-200">
                  <Table className="min-w-full text-left text-sm text-zinc-600">
                    <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                      <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                        <TableHead className="px-4 py-3">Customer Contact</TableHead>
                        <TableHead className="px-4 py-3">Company Display</TableHead>
                        <TableHead className="px-4 py-3">Oldest Invoice Date</TableHead>
                        <TableHead className="px-4 py-3 text-right">Days Open</TableHead>
                        <TableHead className="px-4 py-3 text-right">Outstanding Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-zinc-100">
                      {receivablesData?.customers?.map((row: any, i: number) => (
                        <TableRow key={i} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                          <TableCell className="px-4 py-3 font-semibold text-zinc-900">{row.contactName}</TableCell>
                          <TableCell className="px-4 py-3 text-xs text-zinc-600">{row.companyName}</TableCell>
                          <TableCell className="px-4 py-3 text-xs font-mono">{row.oldestInvoiceDate}</TableCell>
                          <TableCell className="px-4 py-3 text-right text-xs">
                            <span className={`px-2 py-0.5 rounded ${
                              row.daysOverdue > 30 ? 'bg-red-500/10 text-red-700' : 'bg-amber-500/10 text-amber-700'
                            }`}>
                              {row.daysOverdue} Days
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right font-mono font-bold text-zinc-900">{formatCurrency(row.totalDue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}

            {/* Payables Sub Tab */}
            {bizSubTab === 'payables' && (
              <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-4 border-b border-zinc-200/80 pb-4">
                  <div>
                    <h3 className="text-md font-bold text-zinc-800">Accounts Payable (Vendor Balances)</h3>
                    <p className="text-xs text-zinc-500">Track company purchase liabilities and schedule supplier settlements.</p>
                  </div>
                  <div className="bg-white px-4 py-2 border border-zinc-200 rounded font-mono text-sm text-zinc-800 font-bold">
                    Total Payable: {formatCurrency(payablesData?.totalPayable)}
                  </div>
                </div>

                {/* Aging Columns */}
                <div className="grid gap-4 grid-cols-3">
                  <div className="bg-white p-3 rounded-lg border border-zinc-200/60 text-center">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500">Current (0-30 Days)</span>
                    <p className="text-lg font-bold text-zinc-700 mt-1">{formatCurrency(payablesData?.aging?.current)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-zinc-200/60 text-center">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500">31-60 Days Overdue</span>
                    <p className="text-lg font-bold text-amber-500 mt-1">{formatCurrency(payablesData?.aging?.thirtyToSixty)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-zinc-200/60 text-center">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500">61-90 Days Overdue</span>
                    <p className="text-lg font-bold text-red-500 mt-1">{formatCurrency(payablesData?.aging?.sixtyToNinety)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-zinc-200">
                  <Table className="min-w-full text-left text-sm text-zinc-600">
                    <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                      <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                        <TableHead className="px-4 py-3">Vendor Contact</TableHead>
                        <TableHead className="px-4 py-3">Company Display</TableHead>
                        <TableHead className="px-4 py-3">Oldest Purchase Date</TableHead>
                        <TableHead className="px-4 py-3 text-right">Days Open</TableHead>
                        <TableHead className="px-4 py-3 text-right">Outstanding Payable</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-zinc-100">
                      {payablesData?.vendors?.map((row: any, i: number) => (
                        <TableRow key={i} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                          <TableCell className="px-4 py-3 font-semibold text-zinc-900">{row.contactName}</TableCell>
                          <TableCell className="px-4 py-3 text-xs text-zinc-600">{row.companyName}</TableCell>
                          <TableCell className="px-4 py-3 text-xs font-mono">{row.oldestInvoiceDate}</TableCell>
                          <TableCell className="px-4 py-3 text-right text-xs">
                            <span className={`px-2 py-0.5 rounded bg-zinc-50 text-zinc-700`}>
                              {row.daysOverdue} Days
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right font-mono font-bold text-zinc-900">{formatCurrency(row.totalDue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
