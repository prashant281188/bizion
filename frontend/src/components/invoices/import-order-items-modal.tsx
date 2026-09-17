'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import api from '@/lib/api';
import { formatCurrency, formatVariantName } from '@/lib/utils';
import { ShoppingBag, CheckCircle2, Loader2, CheckSquare, Square, Package } from 'lucide-react';

interface ImportOrderItem {
  id: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  variantName?: string;
  sku?: string;
  hsnCode?: string;
  orderedQty: number;
  dispatchedQty: number;
  balanceQty: number;
  selectedQty: number;
  unitPrice: number;
  taxRateId?: string | null;
  taxRatePercent?: number;
  unitType?: string;
  selected: boolean;
}

interface ImportOrderItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
  products: any[];
  onImport: (items: any[], orderId: string, orderNumber: string) => void;
}

export function ImportOrderItemsModal({
  isOpen,
  onClose,
  orderId,
  products,
  onImport,
}: ImportOrderItemsModalProps) {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<ImportOrderItem[]>([]);

  useEffect(() => {
    if (isOpen && orderId) {
      setLoading(true);
      api
        .get(`/orders/${orderId}`)
        .then((res) => {
          const ord = res.data?.data;
          setOrder(ord);

          const mapped: ImportOrderItem[] = (ord?.items || []).map((item: any, idx: number) => {
            const prod = products.find((p: any) => p.id === item.productId) || item.product;
            const varObj = prod?.variants?.find((v: any) => v.id === item.variantId) || item.variant;
            const baseQty = Number(item.baseQuantity ?? item.orderQuantity ?? 1);
            const dispatched = Number(item.dispatchedQuantity || 0);
            const balance = item.balanceQuantity !== undefined ? Number(item.balanceQuantity) : Math.max(0, baseQty - dispatched);
            const initialSelectedQty = balance > 0 ? balance : baseQty;

            return {
              id: item.id || `item_${idx}`,
              productId: item.productId,
              variantId: item.variantId || null,
              productName: prod?.name || item.product?.name || 'Product',
              variantName: varObj?.name,
              sku: varObj?.sku || prod?.sku,
              hsnCode: prod?.hsnCode || item.hsnCode || '',
              orderedQty: baseQty,
              dispatchedQty: dispatched,
              balanceQty: balance,
              selectedQty: initialSelectedQty,
              unitPrice: Number(item.unitPrice || 0),
              taxRateId: item.taxRateId || prod?.taxRateId || null,
              taxRatePercent: Number(item.taxRatePercent || 0),
              unitType: item.unitType,
              selected: balance > 0,
            };
          });

          setItems(mapped);
        })
        .catch((err) => {
          console.error('Failed to fetch order details', err);
          toast.error('Failed to load order items');
          onClose();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setOrder(null);
      setItems([]);
    }
  }, [isOpen, orderId, products, onClose]);

  const allSelected = items.length > 0 && items.every((i) => i.selected);
  const someSelected = items.some((i) => i.selected);
  const selectedCount = items.filter((i) => i.selected).length;

  const toggleSelectAll = () => {
    const nextState = !allSelected;
    setItems((prev) => prev.map((item) => ({ ...item, selected: nextState })));
  };

  const toggleSelectItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const updateItemQty = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const validQty = Math.max(0.01, isNaN(qty) ? 1 : qty);
        return { ...item, selectedQty: validQty };
      })
    );
  };

  const totalSelectedAmount = items
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + i.selectedQty * i.unitPrice, 0);

  const handleConfirmImport = () => {
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      toast.error('Please select at least one product to import');
      return;
    }

    const invoiceLines = selectedItems.map((item) => {
      const desc = item.variantName
        ? formatVariantName(item.productName, item.variantName, item.sku)
        : item.productName;

      return {
        productId: item.productId,
        variantId: item.variantId || '',
        description: desc,
        hsnCode: item.hsnCode || '',
        quantity: item.selectedQty,
        unitPrice: item.unitPrice,
        discountType: 'percentage',
        discountValue: 0,
        taxRateId: item.taxRateId || '',
      };
    });

    onImport(invoiceLines, order.id, order.orderNumber);
    toast.success(`Added ${invoiceLines.length} product(s) from Sales Order ${order.orderNumber}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl bg-white p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border border-zinc-200">
        <DialogHeader className="p-5 pb-4 border-b border-zinc-100 bg-zinc-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 text-amber-700 rounded-xl">
                <ShoppingBag className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-zinc-900">
                  Select Products from Sales Order
                </DialogTitle>
                {order && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Order <span className="font-mono font-bold text-amber-900">{order.orderNumber}</span> • Dated {new Date(order.orderDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            {order && (
              <Badge variant="outline" className="capitalize bg-zinc-100 text-zinc-700 font-semibold px-2.5 py-1 text-xs">
                Status: {order.status}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            <span className="text-sm font-medium">Loading sales order products...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-zinc-400">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No items found in this sales order.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 font-semibold text-zinc-700 hover:text-amber-700 transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="w-4 h-4 text-amber-600" />
                ) : someSelected ? (
                  <div className="w-4 h-4 border-2 border-amber-600 bg-amber-100 rounded-sm flex items-center justify-center">
                    <div className="w-2 h-0.5 bg-amber-600" />
                  </div>
                ) : (
                  <Square className="w-4 h-4 text-zinc-400" />
                )}
                <span>Select All ({items.length} products)</span>
              </button>
              <span>Choose which products and quantities to include</span>
            </div>

            <div className="border border-zinc-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              <Table>
                <TableHeader className="bg-zinc-50 sticky top-0 z-10">
                  <TableRow className="text-zinc-600 text-xs">
                    <TableHead className="w-10 text-center px-2">#</TableHead>
                    <TableHead className="px-3">Product / Variant</TableHead>
                    <TableHead className="w-20 text-right px-2">Ordered</TableHead>
                    <TableHead className="w-20 text-right px-2">Dispatched</TableHead>
                    <TableHead className="w-24 text-right px-2">Balance Qty</TableHead>
                    <TableHead className="w-24 text-right px-3">Include Qty</TableHead>
                    <TableHead className="w-24 text-right px-3">Rate</TableHead>
                    <TableHead className="w-24 text-right px-3">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => {
                    const lineTotal = item.selectedQty * item.unitPrice;
                    const isFullyDispatched = item.balanceQty === 0;
                    return (
                      <TableRow
                        key={item.id}
                        className={`transition-colors text-xs ${
                          item.selected ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'bg-zinc-50/20 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <TableCell className="text-center px-2">
                          <button
                            type="button"
                            onClick={() => toggleSelectItem(item.id)}
                            className="p-1 hover:text-amber-600 transition-colors"
                          >
                            {item.selected ? (
                              <CheckSquare className="w-4 h-4 text-amber-600" />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-300" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="px-3 py-2.5" onClick={() => toggleSelectItem(item.id)}>
                          <div className="font-semibold text-zinc-900 cursor-pointer">{item.productName}</div>
                          {item.variantName && (
                            <div className="text-[11px] text-amber-800 font-medium cursor-pointer">
                              Variant: {item.variantName}
                            </div>
                          )}
                          {item.sku && (
                            <span className="text-[10px] font-mono text-zinc-400 uppercase">
                              SKU: {item.sku}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-2.5 text-right font-mono font-medium text-zinc-700">
                          {item.orderedQty}
                        </TableCell>
                        <TableCell className="px-2 py-2.5 text-right font-mono font-medium text-zinc-600">
                          {item.dispatchedQty}
                        </TableCell>
                        <TableCell className="px-2 py-2.5 text-right font-mono">
                          {isFullyDispatched ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded">
                              0 (Delivered)
                            </span>
                          ) : (
                            <span className="font-bold text-amber-900 bg-amber-100/70 px-1.5 py-0.5 rounded text-[11px]">
                              {item.balanceQty}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-right">
                          <Input
                            type="number"
                            min="0.01"
                            max={item.orderedQty}
                            step="1"
                            value={item.selectedQty}
                            disabled={!item.selected}
                            onChange={(e) => updateItemQty(item.id, parseFloat(e.target.value))}
                            className="h-8 w-20 text-xs text-right font-mono font-semibold"
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-right font-mono text-zinc-800">
                          {formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-right font-mono font-bold text-zinc-950">
                          {formatCurrency(lineTotal)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-zinc-100">
              <div className="text-xs text-zinc-600 flex items-center gap-3">
                <span>
                  Selected: <strong className="text-zinc-900">{selectedCount}</strong> of {items.length} items
                </span>
                <span>•</span>
                <span>
                  Total: <strong className="text-amber-900 font-mono font-bold">{formatCurrency(totalSelectedAmount)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs flex-1 sm:flex-none">
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={selectedCount === 0}
                  className="h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold flex-1 sm:flex-none shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Add Selected to Invoice ({selectedCount})
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
