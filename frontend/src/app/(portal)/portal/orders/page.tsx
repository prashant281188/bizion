'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingCart, Package, TrendingUp, Clock } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { useRouter } from 'next/navigation';

export default function PortalOrdersPage() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['portal', 'orders'],
    queryFn: async () => {
      const res = await api.get('/portal/orders');
      return res.data?.data || [];
    },
  });

  const router = useRouter();

  // Calculate metrics
  const totalOrders = orders?.length || 0;
  const totalSpent = orders?.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0) || 0;
  const pendingOrders = orders?.filter((o: any) => o.status === 'pending' || o.status === 'processing').length || 0;

  return (
    <div className="space-y-8 pb-10">
      {/* Custom Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-amber-50/80 border border-amber-100/50 px-8 py-10 text-zinc-900 shadow-sm">
        <div className="absolute -top-12 -right-12 h-64 w-64 rounded-full bg-amber-200 opacity-20 blur-3xl"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">My Orders</h1>
            <p className="text-zinc-600 max-w-xl">
              Track the status of your recent orders and view your complete purchase history.
            </p>
          </div>
          <div className="hidden sm:block p-4 bg-amber-100/50 rounded-full">
            <ShoppingCart className="h-10 w-10 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Orders</p>
              <h3 className="text-2xl font-bold text-zinc-900">{totalOrders}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Total Spent</p>
              <h3 className="text-2xl font-bold text-zinc-900">{formatCurrency(totalSpent)}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">In Progress</p>
              <h3 className="text-2xl font-bold text-zinc-900">{pendingOrders}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main DataTable */}
      <DataTable
          isLoading={isLoading}
          isEmpty={!orders || orders.length === 0}
          headers={[
            { key: 'orderNumber', label: 'Order #' },
            { key: 'orderDate', label: 'Date' },
            { key: 'status', label: 'Status' },
            { key: 'totalAmount', label: 'Amount', align: 'right' },
          ]}
        >
          <>
            {orders?.map((order: any) => (
              <TableRow 
                key={order.id} 
                className="hover:bg-zinc-50/50 transition-colors border-zinc-100 cursor-pointer"
                onClick={() => router.push(`/portal/orders/${order.id}`)}
              >
                <TableCell className="font-semibold text-amber-700">{order.orderNumber}</TableCell>
                <TableCell className="text-zinc-600 font-medium">{formatDate(order.orderDate)}</TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={`capitalize font-semibold border ${
                      order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      order.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-bold text-zinc-800">
                  {formatCurrency(Number(order.totalAmount))}
                </TableCell>
              </TableRow>
            ))}
          </>
        </DataTable>
    </div>
  );
}
