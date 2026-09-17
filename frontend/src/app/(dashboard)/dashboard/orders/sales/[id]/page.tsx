'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, CheckCircle2, AlertCircle, Clock, ArrowUpRight, Package, ArrowLeft, Edit3, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

export default function SalesOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data.data);
    } catch (err) {
      toast.error('Failed to fetch order details');
    } finally {
      setLoading(false);
    }
  };

  const handleFulfill = () => {
    router.push(`/dashboard/dispatches/new?orderId=${id}&contactId=${order.contactId}`);
  };

  const handleApprove = async () => {
    try {
      await api.patch(`/orders/${id}/status`, { status: 'confirmed' });
      toast.success('Order approved successfully');
      fetchOrder();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve order');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-6">
        <div className="h-8 w-48 bg-zinc-200 animate-pulse rounded mb-6"></div>
        <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 h-64 animate-pulse" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-12 text-center text-zinc-500 max-w-5xl mx-auto">
        <Package className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
        <h3 className="text-lg font-bold text-zinc-800">Order Not Found</h3>
        <p className="text-sm text-zinc-500 mt-1">The requested sales order could not be located.</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/orders/sales')} className="mt-4">
          Back to Sales Orders
        </Button>
      </div>
    );
  }

  // Calculate aggregate fulfillment statistics
  const totalOrdered = (order.items || []).reduce((sum: number, it: any) => sum + Number(it.baseQuantity || it.orderQuantity || 0), 0);
  const totalDispatched = (order.items || []).reduce((sum: number, it: any) => sum + Number(it.dispatchedQuantity || 0), 0);
  const totalBalance = Math.max(0, totalOrdered - totalDispatched);
  const percentDispatched = totalOrdered > 0 ? Math.min(100, Math.round((totalDispatched / totalOrdered) * 100)) : 0;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8 text-zinc-500 hover:text-zinc-900"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-2xl font-bold text-zinc-900 flex flex-wrap items-center gap-3">
              Sales Order <span className="font-mono text-amber-700">{order.orderNumber}</span>
              <Badge variant="outline" className="capitalize px-3 py-1 bg-white border-zinc-300 text-zinc-700 whitespace-nowrap shadow-2xs">
                {order.status}
              </Badge>
            </h2>
          </div>
          <p className="text-zinc-500 mt-1 ml-10 text-xs">
            Created: {new Date(order.orderDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {['draft', 'confirmed'].includes(order.status) && (
            <Button
              variant="outline"
              onClick={() => router.push(`/dashboard/orders/sales/${id}/edit`)}
              className="flex items-center gap-1.5"
            >
              <Edit3 className="w-4 h-4" />
              Edit Order
            </Button>
          )}
          {order.status === 'draft' && (
            <Button variant="default" onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Approve Order
            </Button>
          )}
          {['confirmed', 'processing'].includes(order.status) && totalBalance > 0 && (
            <Button onClick={handleFulfill} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
              <Truck className="w-4 h-4 mr-1.5" />
              Create Dispatch
            </Button>
          )}
        </div>
      </div>

      {/* Dispatch & Fulfillment Progress Tracker */}
      <Card className="bg-gradient-to-r from-amber-50/70 via-white to-amber-50/40 border border-amber-200/80 p-5 rounded-2xl shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-zinc-900 text-sm">Dispatch & Fulfillment Status</h3>
            </div>
            <p className="text-xs text-zinc-600">
              {percentDispatched === 100
                ? 'All products in this sales order have been completely dispatched.'
                : totalDispatched > 0
                ? 'This sales order is partially dispatched. Remaining items can be dispatched or billed.'
                : 'No products have been dispatched yet for this order.'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono shrink-0">
            <div className="bg-white px-3 py-1.5 rounded-xl border border-zinc-200 text-center shadow-2xs">
              <span className="text-[10px] uppercase font-sans text-zinc-400 block">Total Ordered</span>
              <span className="font-bold text-zinc-900 text-sm">{totalOrdered} pcs</span>
            </div>
            <div className="bg-white px-3 py-1.5 rounded-xl border border-emerald-200 text-center shadow-2xs">
              <span className="text-[10px] uppercase font-sans text-emerald-600 block">Dispatched</span>
              <span className="font-bold text-emerald-700 text-sm">{totalDispatched} pcs</span>
            </div>
            <div className={`px-3 py-1.5 rounded-xl border text-center shadow-2xs ${totalBalance > 0 ? 'bg-amber-100/60 border-amber-300' : 'bg-white border-zinc-200'}`}>
              <span className="text-[10px] uppercase font-sans text-amber-800 block">Balance</span>
              <span className="font-bold text-amber-900 text-sm">{totalBalance} pcs</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-[11px] font-semibold text-zinc-600">
            <span>Progress: {percentDispatched}% fulfilled</span>
            <span>{totalDispatched} of {totalOrdered} items</span>
          </div>
          <div className="w-full bg-zinc-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                percentDispatched === 100 ? 'bg-emerald-600' : 'bg-amber-600'
              }`}
              style={{ width: `${percentDispatched}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Customer & Financial Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white rounded-xl shadow-2xs border border-zinc-200 p-6 space-y-3">
          <h3 className="font-bold text-zinc-900 text-sm border-b border-zinc-100 pb-2">Customer Details</h3>
          {order.contact ? (
            <div className="space-y-1 text-xs">
              <p className="font-bold text-sm text-zinc-900">{order.contact.displayName}</p>
              {order.contact.companyName && (
                <p className="text-zinc-600 font-medium">{order.contact.companyName}</p>
              )}
              {order.contact.gstin && (
                <p className="text-zinc-500 font-mono text-[11px]">GSTIN: {order.contact.gstin}</p>
              )}
              {order.contact.email && <p className="text-zinc-500">{order.contact.email}</p>}
              {order.contact.phone && <p className="text-zinc-500">{order.contact.phone}</p>}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Walk-in Customer</p>
          )}
        </Card>

        <Card className="bg-white rounded-xl shadow-2xs border border-zinc-200 p-6">
          <h3 className="font-bold text-zinc-900 text-sm border-b border-zinc-100 pb-2 mb-3">Order Summary</h3>
          <div className="space-y-2 text-xs">
            {order.expectedDeliveryDate && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Expected Delivery:</span>
                <span className="font-semibold text-amber-700">{new Date(order.expectedDeliveryDate).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-500">Total Unique Line Items:</span>
              <span className="font-medium text-zinc-800">{order.items?.length || 0}</span>
            </div>
            
            {Number(order.totalTaxAmount) > 0 && (
              <>
                <div className="flex justify-between pt-2 border-t border-zinc-100">
                  <span className="text-zinc-500">Taxable Amount:</span>
                  <span className="font-medium text-zinc-700 font-mono">₹{Number(order.taxableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {order.isInterState ? (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">IGST:</span>
                    <span className="font-medium text-zinc-700 font-mono">₹{Number(order.igstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">CGST:</span>
                      <span className="font-medium text-zinc-700 font-mono">₹{Number(order.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">SGST:</span>
                      <span className="font-medium text-zinc-700 font-mono">₹{Number(order.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Tax:</span>
                  <span className="font-medium text-zinc-700 font-mono">₹{Number(order.totalTaxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </>
            )}

            <div className="flex justify-between pt-2 border-t border-zinc-200 text-sm">
              <span className="text-zinc-800 font-bold">Grand Total:</span>
              <span className="font-bold font-mono text-amber-700 text-base">
                ₹{Number(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {order.notes && (
              <div className="mt-3 pt-2 border-t border-zinc-100">
                <span className="text-zinc-400 text-[11px] block">Notes:</span>
                <span className="text-zinc-700 text-xs">{order.notes}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Order Items Table with Dispatched & Balance Qty */}
      <Card className="bg-white rounded-xl shadow-2xs border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-zinc-900 text-sm">Order Items Breakdown</h3>
          </div>
          <span className="text-xs text-zinc-500 font-medium">
            Showing Ordered vs Dispatched vs Balance to Dispatch
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-full text-left text-xs">
            <TableHeader className="bg-zinc-50/90 text-zinc-500 uppercase font-semibold text-[11px]">
              <TableRow className="border-b border-zinc-100">
                <TableHead className="px-4 py-3">Product / Variant</TableHead>
                <TableHead className="px-3 py-3 text-right">Ordered Qty</TableHead>
                <TableHead className="px-3 py-3 text-right">Dispatched Qty</TableHead>
                <TableHead className="px-3 py-3 text-right">Balance Qty</TableHead>
                <TableHead className="px-3 py-3 text-center">Fulfillment</TableHead>
                <TableHead className="px-3 py-3 text-right">Unit Rate</TableHead>
                <TableHead className="px-4 py-3 text-right">Total (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-zinc-100 text-zinc-700">
              {order.items?.map((item: any) => {
                const ordered = Number(item.baseQuantity || item.orderQuantity || 0);
                const dispatched = Number(item.dispatchedQuantity || 0);
                const balance = item.balanceQuantity !== undefined ? Number(item.balanceQuantity) : Math.max(0, ordered - dispatched);
                const isComplete = balance === 0 && ordered > 0;
                const isPartial = dispatched > 0 && balance > 0;

                const boxQty = item.variant?.boxQuantity || item.product?.boxQuantity || 1;
                const boxes = Math.floor(ordered / boxQty);
                const loose = ordered % boxQty;
                const boxDisplay = [];
                if (boxes > 0) boxDisplay.push(`${boxes} Box${boxes > 1 ? 'es' : ''}`);
                if (loose > 0) boxDisplay.push(`${loose} Loose`);

                return (
                  <TableRow key={item.id} className="hover:bg-zinc-50/60 transition-colors">
                    <TableCell className="px-4 py-3">
                      <p className="font-bold text-zinc-900 text-xs">
                        {item.product?.name || item.productName || 'Product'}
                      </p>
                      {item.variant?.name && (
                        <p className="text-[11px] text-amber-800 font-medium">
                          Variant: {item.variant.name}
                        </p>
                      )}
                      {(item.variant?.sku || item.product?.sku) && (
                        <span className="text-[10px] font-mono text-zinc-400">
                          SKU: {item.variant?.sku || item.product?.sku}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="px-3 py-3 text-right">
                      <div className="font-mono font-bold text-zinc-900 text-xs">
                        {ordered} pcs
                      </div>
                      {boxDisplay.length > 0 && boxQty > 1 && (
                        <span className="text-[10px] text-zinc-400 block font-sans">
                          ({boxDisplay.join(', ')})
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="px-3 py-3 text-right font-mono font-semibold text-emerald-700">
                      {dispatched > 0 ? (
                        <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          {dispatched} pcs
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-normal">0 pcs</span>
                      )}
                    </TableCell>

                    <TableCell className="px-3 py-3 text-right font-mono">
                      {isComplete ? (
                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">
                          0 (Complete)
                        </span>
                      ) : (
                        <span className={`font-bold px-2 py-0.5 rounded-md text-xs ${
                          isPartial ? 'bg-amber-100 text-amber-950 border border-amber-300' : 'text-zinc-900'
                        }`}>
                          {balance} pcs
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="px-3 py-3 text-center">
                      {isComplete ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0 text-[10px] font-semibold">
                          Fully Dispatched
                        </Badge>
                      ) : isPartial ? (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0 text-[10px] font-semibold">
                          Partial ({dispatched}/{ordered})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-zinc-500 bg-zinc-50 text-[10px]">
                          Pending (0/{ordered})
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="px-3 py-3 text-right font-mono text-zinc-700">
                      ₹{Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                      ₹{Number(item.totalPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Linked Dispatches History (if any) */}
      {order.dispatches && order.dispatches.length > 0 && (
        <Card className="bg-white rounded-xl shadow-2xs border border-zinc-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-zinc-900 text-sm">Dispatches for this Order ({order.dispatches.length})</h3>
            </div>
          </div>
          <div className="divide-y divide-zinc-100">
            {order.dispatches.map((disp: any) => (
              <div key={disp.id} className="p-4 flex items-center justify-between hover:bg-zinc-50/60 transition-colors text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-900">{disp.dispatchNumber}</span>
                    <Badge variant="outline" className="capitalize text-[10px] bg-zinc-50 text-zinc-700">
                      {disp.status}
                    </Badge>
                  </div>
                  <p className="text-zinc-500 text-[11px]">
                    Created: {new Date(disp.createdAt).toLocaleDateString()}
                    {disp.carrierName && ` • Carrier: ${disp.carrierName}`}
                    {disp.trackingNumber && ` • Tracking: ${disp.trackingNumber}`}
                  </p>
                </div>
                <Link
                  href={`/dashboard/dispatches/${disp.id}`}
                  className="flex items-center gap-1 text-amber-700 hover:text-amber-800 font-semibold hover:underline"
                >
                  <span>View Dispatch</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
