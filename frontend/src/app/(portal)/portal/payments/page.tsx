'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard, ArrowDownCircle, CheckCircle2, DollarSign } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { useRouter } from 'next/navigation';

export default function PortalPaymentsPage() {
  const router = useRouter();
  const { data: payments, isLoading } = useQuery({
    queryKey: ['portal', 'payments'],
    queryFn: async () => {
      const res = await api.get('/portal/payments');
      return res.data?.data || [];
    },
  });

  // Calculate metrics
  const totalPaid = payments?.filter((p: any) => p.status === 'success' || p.status === 'completed').reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0;
  const totalPayments = payments?.length || 0;
  
  const recentPayments = payments?.filter((p: any) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(p.paymentDate) >= thirtyDaysAgo;
  }).length || 0;

  return (
    <div className="space-y-8 pb-10">
      {/* Custom Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-emerald-50/80 border border-emerald-100/50 px-8 py-10 text-zinc-900 shadow-sm">
        <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-white/30 to-transparent"></div>
        <div className="absolute -bottom-12 -left-12 h-64 w-64 rounded-full bg-emerald-200 opacity-20 blur-3xl"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">My Payments</h1>
            <p className="text-zinc-600 max-w-xl">
              Track your payment history, view receipts, and confirm recent transactions.
            </p>
          </div>
          <div className="hidden sm:block p-4 bg-emerald-100/50 rounded-full">
            <CreditCard className="h-10 w-10 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Paid</p>
              <h3 className="text-2xl font-bold text-zinc-900">{formatCurrency(totalPaid)}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <ArrowDownCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Transactions</p>
              <h3 className="text-2xl font-bold text-zinc-900">{totalPayments}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Recent (30 Days)</p>
              <h3 className="text-2xl font-bold text-zinc-900">{recentPayments}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main DataTable */}
      <DataTable
        isLoading={isLoading}
        isEmpty={!payments || payments.length === 0}
        headers={[
          { key: 'paymentNumber', label: 'Receipt #' },
          { key: 'paymentDate', label: 'Date' },
          { key: 'method', label: 'Method' },
          { key: 'status', label: 'Status' },
          { key: 'amount', label: 'Amount', align: 'right' },
        ]}
      >
        <>
          {payments?.map((payment: any) => (
            <TableRow 
              key={payment.id}
              className="cursor-pointer hover:bg-zinc-50/50 transition-colors"
              onClick={() => router.push(`/portal/payments/${payment.id}`)}
            >
              <TableCell className="font-semibold text-indigo-600">
                {payment.paymentNumber}
              </TableCell>
              <TableCell className="text-zinc-600">
                {formatDate(payment.paymentDate)}
              </TableCell>
              <TableCell>
                <span className="capitalize text-zinc-700 bg-zinc-100 px-2 py-1 rounded-md text-xs font-medium">
                  {payment.paymentMethod?.replace('_', ' ')}
                </span>
              </TableCell>
              <TableCell>
                <Badge 
                  variant="outline" 
                  className={`capitalize font-semibold border ${
                    payment.status === 'success' || payment.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    payment.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {payment.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-bold text-zinc-800">
                {formatCurrency(Number(payment.amount))}
              </TableCell>
            </TableRow>
          ))}
        </>
      </DataTable>
    </div>
  );
}
