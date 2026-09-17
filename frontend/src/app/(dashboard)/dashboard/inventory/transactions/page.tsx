'use client';

import { TableCell, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import React, { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { DataTable, type TableHeader as DataTableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { History, TrendingUp, TrendingDown, Warehouse } from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  quantityChange: number;
  quantityAfter: number;
  notes: string;
  createdAt: string;
  warehouseName: string;
  productName: string;
  variantName: string | null;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Sorting States
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchTransactions = async (
    pPage = page,
    pSortBy = sortBy,
    pSortOrder = sortOrder
  ) => {
    try {
      setLoading(true);
      const res = await api.get(`/inventory/transactions?page=${pPage}&limit=15&sortBy=${pSortBy}&sortOrder=${pSortOrder}`);
      setTransactions(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) {
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(page, sortBy, sortOrder);
  }, [page, sortBy, sortOrder]);

  const stats = useMemo(() => {
    const positiveAdditions = transactions.filter(t => t.quantityChange > 0).reduce((sum, t) => sum + t.quantityChange, 0);
    const negativeDeductions = transactions.filter(t => t.quantityChange < 0).reduce((sum, t) => sum + Math.abs(t.quantityChange), 0);
    return { positiveAdditions, negativeDeductions, count: transactions.length };
  }, [transactions]);

  const handleSort = (field: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (sortBy === field) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    setSortBy(field);
    setSortOrder(newOrder);
    setPage(1);
  };

  const tableHeaders: DataTableHeader[] = [
    { key: 'createdAt', label: 'Date & Time', sortable: true },
    { key: 'productName', label: 'Product & Variant', sortable: true },
    { key: 'warehouseName', label: 'Warehouse Hub', sortable: true },
    { key: 'quantityChange', label: 'Quantity Adjustment', sortable: true, align: 'right' },
    { key: 'quantityAfter', label: 'Balance After', sortable: true, align: 'right' },
    { key: 'notes', label: 'Audit / Movement Notes' },
  ];

  return (
    <PageContainer className="max-w-full space-y-6">
      <PageHeader title="Stock Audit & Movement Ledger" subtitle="Immutable audit log of all warehouse receipts, inventory adjustments, and stock transfers." />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Audited Transactions</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-900">{stats.count}</span>
            <History className="w-5 h-5 text-zinc-400" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Stock Additions (+)</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-700">+{stats.positiveAdditions}</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Stock Deductions (-)</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-red-600">-{stats.negativeDeductions}</span>
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
        </Card>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
        <DataTable
          headers={tableHeaders}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          isLoading={loading}
          isEmpty={transactions.length === 0}
          emptyMessage="No transactions found. Stock adjustments will appear here."
        >
          {transactions.map((tx) => (
            <TableRow key={tx.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80">
              <TableCell className="px-4 py-3.5 text-xs text-zinc-600 font-medium whitespace-nowrap">
                {new Date(tx.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </TableCell>
              <TableCell className="px-4 py-3.5">
                <span className="font-bold text-xs text-zinc-900 block">{tx.productName}</span>
                {tx.variantName && <span className="text-[10px] text-zinc-500 font-medium">{tx.variantName}</span>}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-xs text-zinc-700 font-medium">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-800 text-xs font-semibold">
                  <Warehouse className="w-3 h-3 text-zinc-500" />
                  {tx.warehouseName}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3.5 text-right font-mono">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                  tx.quantityChange > 0
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {tx.quantityChange > 0 ? `+${tx.quantityChange}` : tx.quantityChange}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3.5 text-right text-zinc-900 font-mono font-bold text-xs">
                {tx.quantityAfter}
              </TableCell>
              <TableCell className="px-4 py-3.5 text-zinc-500 text-xs max-w-xs truncate" title={tx.notes}>
                {tx.notes || '—'}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </PageContainer>
  );
}
