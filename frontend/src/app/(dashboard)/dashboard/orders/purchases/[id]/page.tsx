'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { formatVariantName } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  confirmed: 'bg-blue-100 text-blue-700',
  partially_received: 'bg-amber-100 text-amber-700',
  fully_received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  // legacy compatibility
  shipped: 'bg-amber-100 text-amber-700',
  delivered: 'bg-green-100 text-green-700',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  partially_received: 'Partially Received',
  fully_received: 'Fully Received',
  cancelled: 'Cancelled',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

type Warehouse = { id: string; name: string };
type GRN = {
  id: string;
  receiptNumber: string;
  receiptDate: string;
  status: string;
  notes?: string;
  warehouse: { name: string };
  creator?: { firstName: string; lastName: string };
  items: {
    id: string;
    product: { name: string; sku: string };
    variant?: { name: string; sku: string };
    orderedQty: number;
    receivedQty: number;
    unitPrice: string;
  }[];
  invoiceId?: string;
};

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [grns, setGrns] = useState<GRN[]>([]);
  const [grnsLoading, setGrnsLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [linkedInvoice, setLinkedInvoice] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // GRN Modal state
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [grnWarehouseId, setGrnWarehouseId] = useState('');
  const [grnDate, setGrnDate] = useState(new Date().toISOString().split('T')[0]);
  const [grnNotes, setGrnNotes] = useState('');
  const [grnItems, setGrnItems] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [adHocItems, setAdHocItems] = useState<{ id: string; productId: string; variantId: string | null; name: string; receivedQty: number; unitPrice: number }[]>([]);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/orders/' + id);
      setOrder(res.data.data);
    } catch {
      toast.error('Failed to fetch purchase order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchGrns = useCallback(async () => {
    try {
      setGrnsLoading(true);
      const res = await api.get('/goods-receipts', { params: { orderId: id } });
      setGrns(res.data.data || []);
    } catch {
      // silently fail — GRN list is supplementary
    } finally {
      setGrnsLoading(false);
    }
  }, [id]);

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await api.get('/inventory/warehouses');
      setWarehouses(res.data.data || []);
      // Auto-select first warehouse
      if (res.data.data?.length > 0) setGrnWarehouseId(res.data.data[0].id);
    } catch {
      // fail silently
    }
  }, []);

  const fetchLinkedInvoice = useCallback(async () => {
    try {
      const res = await api.get('/invoices', { params: { orderId: id, limit: 1 } });
      if (res.data?.data?.length > 0) {
        setLinkedInvoice(res.data.data[0]);
      }
    } catch {
      // silently fail
    }
  }, [id]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/products?limit=1000');
      setProducts(res.data.data || []);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (id) {
      fetchOrder();
      fetchGrns();
      fetchWarehouses();
      fetchLinkedInvoice();
      fetchProducts();
    }
  }, [id, fetchOrder, fetchGrns, fetchWarehouses, fetchLinkedInvoice, fetchProducts]);

  // Compute total received qty per order_item across all GRNs
  const totalReceivedMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const grn of grns) {
      for (const gi of grn.items) {
        // We match by orderItemId which is embedded in each GRN item via the orderItemId field
        // For display purposes we match by product+variant combo using a compound key
        const key = (gi as any).orderItemId || gi.id;
        map[key] = (map[key] || 0) + gi.receivedQty;
      }
    }
    return map;
  }, [grns]);

  // When GRN modal opens, prefill received quantities with remaining (ordered - received)
  const openGrnModal = () => {
    if (!order?.items) return;
    const initial: Record<string, number> = {};
    for (const item of order.items) {
      const alreadyReceived = getItemTotalReceived(item);
      const remaining = Math.max(0, (item.baseQuantity ?? item.orderQuantity) - alreadyReceived);
      initial[item.id] = remaining;
    }
    setGrnItems(initial);
    setAdHocItems([]);
    setShowGrnModal(true);
  };

  // Get total received qty for a specific order item across all GRNs
  const getItemTotalReceived = (item: any): number => {
    let total = 0;
    for (const grn of grns) {
      for (const gi of grn.items) {
        if ((gi as any).orderItemId === item.id) {
          total += gi.receivedQty;
        }
      }
    }
    return total;
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      await api.patch('/orders/' + id + '/status', { status: 'confirmed' });
      toast.success('Purchase order approved');
      fetchOrder();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitGrn = async () => {
    if (!grnWarehouseId) {
      toast.error('Please select a warehouse');
      return;
    }
    try {
      setActionLoading(true);
      const adHoc = adHocItems
        .filter(i => i.productId && i.receivedQty > 0)
        .map(i => ({
          orderItemId: null,
          productId: i.productId,
          variantId: i.variantId || null,
          orderedQty: 0,
          receivedQty: i.receivedQty,
          unitPrice: i.unitPrice,
        }));

      const items = [
        ...order.items.map((item: any) => ({
          orderItemId: item.id,
          productId: item.productId,
          variantId: item.variantId || null,
          orderedQty: item.baseQuantity ?? item.orderQuantity,
          receivedQty: grnItems[item.id] ?? 0,
          unitPrice: item.unitPrice,
        })),
        ...adHoc
      ].filter((i: any) => i.receivedQty > 0);

      if (items.length === 0) {
        toast.error('Please enter at least one item with received quantity > 0');
        return;
      }

      await api.post('/goods-receipts', {
        orderId: id,
        warehouseId: grnWarehouseId,
        receiptDate: grnDate,
        notes: grnNotes || null,
        items,
      });

      toast.success('Goods receipt recorded successfully');
      setShowGrnModal(false);
      setGrnNotes('');
      setAdHocItems([]);
      await Promise.all([fetchOrder(), fetchGrns()]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record goods receipt');
    } finally {
      setActionLoading(false);
    }
  };

  const canReceive = order && ['confirmed', 'partially_received'].includes(order.status);
  const isFullyReceived = order?.status === 'fully_received' || order?.status === 'delivered';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-zinc-200 rounded" />
        <div className="h-40 bg-zinc-100 rounded-lg" />
        <div className="h-64 bg-zinc-100 rounded-lg" />
      </div>
    );
  }

  if (!order) {
    return <div className="p-6 text-center text-zinc-500">Purchase order not found.</div>;
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-3 flex-wrap">
            Purchase Order {order.orderNumber}
            <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_BADGE[order.status] || STATUS_BADGE.draft}`}>
              {STATUS_LABEL[order.status] || order.status}
            </span>
          </h2>
          <p className="text-zinc-500 mt-1 text-sm">
            Date: {new Date(order.orderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost"
            onClick={() => router.back()}
            className="bg-white border border-zinc-300 text-zinc-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
          >
            Back
          </Button>

          {['draft', 'confirmed'].includes(order.status) && (
            <Button variant="ghost"
              onClick={() => router.push(`/dashboard/orders/purchases/${id}/edit`)}
              className="bg-white border border-zinc-300 text-zinc-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
            >
              Edit PO
            </Button>
          )}

          {order.status === 'draft' && (
            <Button variant="ghost"
              onClick={handleApprove}
              disabled={actionLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {actionLoading ? 'Approving…' : 'Approve PO'}
            </Button>
          )}

          {canReceive && (
            <Button variant="ghost"
              onClick={openGrnModal}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Record Goods Receipt
            </Button>
          )}

          {isFullyReceived && (
            linkedInvoice ? (
              <Button variant="ghost"
                onClick={() => router.push(`/dashboard/invoices`)}
                className="bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                View Purchase Invoice ({linkedInvoice.invoiceNumber})
              </Button>
            ) : (
              <Button variant="ghost"
                onClick={() => router.push(`/dashboard/invoices/new?orderId=${id}`)}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Create Purchase Invoice
              </Button>
            )
          )}
        </div>
      </div>

      {/* ── GRN Modal ── */}
      <Dialog open={showGrnModal} onOpenChange={setShowGrnModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-zinc-200">
            <DialogTitle className="font-semibold text-zinc-900 text-lg">Record Goods Receipt</DialogTitle>
          </DialogHeader>
          <div className="p-6 flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Destination Warehouse *</label>
                  <Select
                    value={grnWarehouseId}
                    onChange={(e) => setGrnWarehouseId(e.target.value)}
                    options={[
                      { value: '', label: '— Select Warehouse —' },
                      ...warehouses.map(w => ({ value: w.id, label: w.name }))
                    ]}
                    className="w-full bg-white border-zinc-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Receipt Date *</label>
                  <Input
                    type="date"
                    value={grnDate}
                    onChange={(e) => setGrnDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Item quantities */}
              <div>
                <h4 className="text-sm font-semibold text-zinc-700 mb-2">Items Received in This Lot</h4>
                <div className="overflow-x-auto rounded-lg border border-zinc-200">
                  <Table className="min-w-full text-left text-sm text-zinc-600">
                    <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                      <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                        <TableHead className="px-4 py-3 font-medium">Product</TableHead>
                        <TableHead className="px-4 py-3 font-medium text-right w-28">Ordered (Pcs)</TableHead>
                        <TableHead className="px-4 py-3 font-medium text-right w-28">Already Rcvd</TableHead>
                        <TableHead className="px-4 py-3 font-medium w-36">Receiving Now</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-zinc-100">
                      {order.items?.map((item: any) => {
                        const alreadyReceived = getItemTotalReceived(item);
                        const maxReceivable = (item.baseQuantity ?? item.orderQuantity) - alreadyReceived;
                        return (
                          <TableRow key={item.id} className={maxReceivable <= 0 ? 'opacity-40' : ''}>
                            <TableCell className="px-4 py-3">
                              <div className="font-medium text-zinc-900">{item.product?.name || '—'}</div>
                              {item.variant && <div className="text-xs text-zinc-500">{item.variant.name}</div>}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right text-zinc-600 font-mono text-xs">
                              {item.baseQuantity ?? item.orderQuantity}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right text-zinc-600 font-mono text-xs">
                              {alreadyReceived > 0
                                ? <span className="text-amber-600 font-semibold">{alreadyReceived}</span>
                                : <span className="text-zinc-500">0</span>}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <Input
                                type="number"
                                min="0"
                                max={maxReceivable}
                                value={grnItems[item.id] ?? 0}
                                onChange={(e) => setGrnItems(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                                disabled={maxReceivable <= 0}
                                className="text-right disabled:opacity-50"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Ad-hoc Items */}
              <div className="mt-1">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold text-zinc-700">Additional Ad-hoc Items</h4>
                  <Button variant="ghost" onClick={() => {
                    setAdHocItems(prev => [...prev, { id: Math.random().toString(), productId: '', variantId: null, name: '', receivedQty: 1, unitPrice: 0 }]);
                  }} className="text-xs text-amber-600 hover:text-amber-700 font-medium underline-offset-2 hover:underline">
                    + Add Product
                  </Button>
                </div>
                {adHocItems.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-zinc-200" style={{ minHeight: '200px' }}>
                    <Table className="min-w-full text-left text-sm text-zinc-600">
                      <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                        <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                          <TableHead className="px-4 py-3 font-medium">Product</TableHead>
                          <TableHead className="px-4 py-3 font-medium text-right w-28">Quantity</TableHead>
                          <TableHead className="px-4 py-3 font-medium text-right w-36">Unit Price</TableHead>
                          <TableHead className="px-4 py-3 font-medium w-12 text-center"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-zinc-100">
                        {adHocItems.map((item, idx) => (
                          <TableRow key={item.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                            <TableCell className="px-4 py-3">
                              <SearchableSelect
                                options={products.flatMap(p => 
                                  p.variants && p.variants.length > 0 
                                    ? p.variants.map((v: any) => ({
                                        value: `${p.id}::${v.id}`,
                                        label: formatVariantName(p.name, v.name, v.sku),
                                        sku: v.sku
                                      }))
                                    : [{
                                        value: `${p.id}::`,
                                        label: p.name,
                                        sku: p.sku
                                      }]
                                )}
                                value={item.variantId ? `${item.productId}::${item.variantId}` : (item.productId ? `${item.productId}::` : '')}
                                onChange={(val) => {
                                  const [pId, vId] = val.split('::');
                                  const prod = products.find(p => p.id === pId);
                                  const unitPrice = prod?.costPrice || 0;
                                  setAdHocItems(prev => prev.map((it, i) => i === idx ? { ...it, productId: pId, variantId: vId || null, unitPrice: Number(unitPrice) } : it));
                                }}
                                placeholder="Search product..."
                              />
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <Input
                                type="number"
                                min="1"
                                value={item.receivedQty}
                                onChange={(e) => setAdHocItems(prev => prev.map((it, i) => i === idx ? { ...it, receivedQty: Number(e.target.value) } : it))}
                                className="text-right"
                              />
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) => setAdHocItems(prev => prev.map((it, i) => i === idx ? { ...it, unitPrice: Number(e.target.value) } : it))}
                                className="text-right"
                              />
                            </TableCell>
                            <TableCell className="px-4 py-3 text-center">
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => setAdHocItems(prev => prev.filter((_, i) => i !== idx))}>&times;</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Notes (optional)</label>
                <textarea
                  value={grnNotes}
                  onChange={(e) => setGrnNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Lot 1 of 2, partial delivery due to transport issues..."
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost"
                  onClick={() => setShowGrnModal(false)}
                  className="border border-zinc-300 text-zinc-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-50"
                >
                  Cancel
                </Button>
                <Button variant="ghost"
                  onClick={handleSubmitGrn}
                  disabled={actionLoading || !grnWarehouseId}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {actionLoading ? 'Saving…' : 'Confirm Receipt'}
                </Button>
              </div>
            </div>
        </DialogContent>
      </Dialog>

      {/* ── Info Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wide text-zinc-800">Supplier Details</CardTitle>
          </CardHeader>
          <CardContent>
          {order.contact ? (
            <div className="space-y-1">
              <p className="font-medium text-zinc-900">{order.contact.displayName}</p>
              {order.contact.companyName && <p className="text-sm text-zinc-500">{order.contact.companyName}</p>}
              {order.contact.email && <p className="text-sm text-zinc-500">{order.contact.email}</p>}
              {order.contact.phone && <p className="text-sm text-zinc-500">{order.contact.phone}</p>}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">No supplier information</p>
          )}
          </CardContent>
        </Card>

        <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wide text-zinc-800">Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-500">Total Line Items:</span>
              <span className="font-medium">{order.items?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Goods Receipts:</span>
              <span className="font-medium">{grns.length}</span>
            </div>
            {Number(order.totalTaxAmount) > 0 && (
              <>
                <div className="flex justify-between mt-2 pt-2 border-t border-zinc-100">
                  <span className="text-zinc-500">Taxable Amount:</span>
                  <span className="font-medium">₹{Number(order.taxableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tax:</span>
                  <span className="font-medium">₹{Number(order.totalTaxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </>
            )}
            {Math.abs(Number(order.totalAmount) - (Number(order.taxableAmount) + Number(order.totalTaxAmount))) > 0.001 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Round Off:</span>
                <span className="font-medium">
                  {Number(order.totalAmount) - (Number(order.taxableAmount) + Number(order.totalTaxAmount)) > 0 ? '+' : ''}
                  ₹{(Number(order.totalAmount) - (Number(order.taxableAmount) + Number(order.totalTaxAmount))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between mt-2 pt-2 border-t border-zinc-200">
              <span className="text-zinc-600 font-semibold">Grand Total:</span>
              <span className="font-bold text-xl text-amber-600">
                ₹{Number(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Order Items Table ── */}
      <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 border overflow-hidden">
        <CardHeader className="px-5 py-3 border-b flex flex-row items-center justify-between space-y-0">
          <CardTitle className="font-semibold text-zinc-800 text-sm">Order Items</CardTitle>
          <span className="text-xs text-zinc-500">
            {isFullyReceived ? '✓ All items fully received' : grns.length > 0 ? `${grns.length} receipt(s) recorded` : 'No receipts yet'}
          </span>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
        <Table className="min-w-full text-left text-sm text-zinc-600">
          <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
            <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
              <TableHead className="px-4 py-3">Product</TableHead>
              <TableHead className="px-4 py-3 text-right">Ordered Quantity</TableHead>
              <TableHead className="px-4 py-3 text-right">Received</TableHead>
              <TableHead className="px-4 py-3 text-right">Pending</TableHead>
              <TableHead className="px-4 py-3 text-right">Unit Price</TableHead>
              <TableHead className="px-4 py-3 text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-zinc-100">
            {order.items?.length > 0 ? (
              order.items.map((item: any) => {
                const ordered = item.baseQuantity ?? item.orderQuantity;
                const received = getItemTotalReceived(item);
                const pending = Math.max(0, ordered - received);
                return (
                  <TableRow key={item.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                    <TableCell className="px-4 py-3">
                      <p className="font-medium text-zinc-900">{item.product?.name || '—'}</p>
                      {item.variant && <p className="text-xs text-zinc-500 mt-0.5">{item.variant.name}</p>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {(() => {
                        const boxQty = item.variant?.boxQuantity || item.product?.boxQuantity || 1;
                        const boxes = Math.floor(ordered / boxQty);
                        const loose = ordered % boxQty;
                        
                        const display = [];
                        if (boxes > 0) display.push(`${boxes} Box${boxes > 1 ? 'es' : ''}`);
                        if (loose > 0) display.push(`${loose} Loose`);
                        if (display.length === 0) display.push('0 Loose');
                        
                        return (
                          <div className="flex flex-col items-end">
                            <span className="font-medium text-zinc-900">{display.join(', ')}</span>
                            <span className="text-xs text-zinc-500 mt-0.5">
                              (Base: {ordered} pcs)
                            </span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono">
                      {received > 0
                        ? <span className="text-amber-600 font-semibold">{received}</span>
                        : <span className="text-zinc-500">0</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono">
                      {pending > 0
                        ? <span className="text-amber-600 font-semibold">{pending}</span>
                        : <span className="text-zinc-500">—</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">₹{Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="px-4 py-3 text-right font-medium text-zinc-900">₹{Number(item.totalPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50"><TableCell colSpan={6} className="px-4 py-3 text-center text-zinc-500">No items found.</TableCell></TableRow>
            )}
          </TableBody>
          {order.items?.length > 0 && (
            <tfoot className="border-t border-zinc-200 bg-zinc-50">
              <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                <TableCell colSpan={4} className="px-4 py-3 text-right font-semibold text-zinc-700 text-sm">Grand Total</TableCell>
                <TableCell className="px-4 py-3 text-right font-bold font-mono text-amber-600" colSpan={2}>
                  ₹{Number(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </tfoot>
          )}
        </Table>
        </CardContent>
      </Card>

      {/* ── Goods Receipts History ── */}
      <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 border overflow-hidden">
        <CardHeader className="px-5 py-3 border-b flex flex-row items-center justify-between space-y-0">
          <CardTitle className="font-semibold text-zinc-800 text-sm">Goods Receipt History</CardTitle>
          {canReceive && (
            <Button variant="link" size="sm" onClick={openGrnModal} className="h-auto p-0 text-xs text-amber-600 hover:text-amber-700 font-medium">+ Record New Lot</Button>
          )}
        </CardHeader>
        <CardContent className="p-0">

        {grnsLoading ? (
          <div className="p-6 text-center text-sm text-zinc-500">Loading receipts…</div>
        ) : grns.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            No goods receipts yet.
            {canReceive && (
              <span> Click <strong>Record Goods Receipt</strong> above to log the first delivery lot.</span>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {grns.map((grn) => (
              <div key={grn.id} className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-zinc-900">{grn.receiptNumber}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {new Date(grn.receiptDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' · '}{grn.warehouse?.name}
                      {grn.creator && ` · by ${grn.creator.firstName} ${grn.creator.lastName}`}
                    </p>
                    {grn.notes && <p className="text-xs text-zinc-500 italic mt-1">"{grn.notes}"</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 capitalize">{grn.status}</span>
                    {grn.invoiceId ? (
                      <Button variant="ghost" onClick={() => router.push(`/dashboard/invoices`)} className="text-xs text-amber-600 hover:text-amber-700 font-medium underline-offset-2 hover:underline">
                        View Invoice
                      </Button>
                    ) : (
                      <Button variant="ghost" onClick={() => router.push(`/dashboard/invoices/new?grnId=${grn.id}&type=purchase_invoice`)} className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded shadow-sm font-medium transition-colors">
                        Create Invoice
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto rounded border border-zinc-100">
                  <Table className="min-w-full text-left text-sm text-zinc-600">
                    <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                      <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                        <TableHead className="px-4 py-3 text-left font-medium">Product</TableHead>
                        <TableHead className="px-4 py-3 text-right font-medium w-24">Ordered</TableHead>
                        <TableHead className="px-4 py-3 text-right font-medium w-24">Received</TableHead>
                        <TableHead className="px-4 py-3 text-right font-medium w-28">Unit Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-zinc-100">
                      {grn.items.map((gi) => (
                        <TableRow key={gi.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                          <TableCell className="px-4 py-3">
                            <span className="font-medium text-zinc-800">{gi.product?.name}</span>
                            {gi.variant && <span className="text-zinc-500 ml-1">· {gi.variant.name}</span>}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right text-zinc-500 font-mono">{gi.orderedQty}</TableCell>
                          <TableCell className="px-4 py-3 text-right font-mono text-amber-600 font-semibold">{gi.receivedQty}</TableCell>
                          <TableCell className="px-4 py-3 text-right text-zinc-500">₹{Number(gi.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>

    </div>
  );
}
