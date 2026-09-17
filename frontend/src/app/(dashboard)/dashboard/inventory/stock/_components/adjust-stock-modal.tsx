'use client';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Minus, SlidersHorizontal, Warehouse as WarehouseIcon, Package, CheckCircle2 } from 'lucide-react';

import React, { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { formatVariantName } from '@/lib/utils';

interface AdjustStockModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialWarehouseId?: string;
}

export function AdjustStockModal({ isOpen = true, onClose, onSuccess, initialWarehouseId }: AdjustStockModalProps) {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  
  const [mode, setMode] = useState<'add' | 'subtract'>('add');

  const [formData, setFormData] = useState({
    warehouseId: initialWarehouseId || '',
    productId: '',
    variantId: '',
    notes: '',
  });

  const [boxes, setBoxes] = useState('');
  const [loosePieces, setLoosePieces] = useState('');
  const [inputProduct, setInputProduct] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/inventory/warehouses'),
      api.get('/products?limit=250')
    ]).then(([whRes, prRes]) => {
      setWarehouses(whRes.data.data || []);
      setProducts(prRes.data.data || []);
    }).catch(err => {
      toast.error('Failed to load form data');
    });
  }, []);

  useEffect(() => {
    if (formData.productId) {
      const selectedProduct = products.find(p => p.id === formData.productId);
      if (selectedProduct && selectedProduct.hasVariants && selectedProduct.variants) {
        setVariants(selectedProduct.variants);
        setFormData(prev => ({ ...prev, variantId: '' }));
      } else {
        setVariants([]);
        setFormData(prev => ({ ...prev, variantId: '' }));
      }
    } else {
      setVariants([]);
      setFormData(prev => ({ ...prev, variantId: '' }));
    }
  }, [formData.productId, products]);

  const productOptions = useMemo(() => {
    const opts: any[] = [];
    products.forEach((p) => {
      if (p.hasVariants && p.variants?.length > 0) {
        p.variants.forEach((v: any) => {
          opts.push({
            value: `${p.id}:${v.id}`,
            label: formatVariantName(p.name, v.name, v.sku),
            sublabel: `SKU: ${v.sku || p.sku || 'N/A'}`,
            imageUrl: v.imageUrl || p.images?.[0]?.url || undefined
          });
        });
      } else {
        opts.push({
          value: `${p.id}:`,
          label: p.name,
          sublabel: `SKU: ${p.sku || 'N/A'}`,
          imageUrl: p.images?.[0]?.url || undefined
        });
      }
    });
    return opts;
  }, [products]);

  const handleInputProductChange = (val: string) => {
    setInputProduct(val);
    if (!val) {
      setFormData(prev => ({ ...prev, productId: '', variantId: '' }));
      return;
    }
    const [pId, vId] = val.split(':');
    setFormData(prev => ({
      ...prev,
      productId: pId || '',
      variantId: vId || ''
    }));
  };

  const selectedProduct = products.find(p => p.id === formData.productId);
  const selectedVariant = variants.find(v => v.id === formData.variantId);
  const currentBoxQuantity = selectedVariant ? (selectedVariant.boxQuantity || 1) : (selectedProduct ? (selectedProduct.boxQuantity || 1) : 1);
  
  const b = Math.abs(parseInt(boxes, 10) || 0);
  const l = Math.abs(parseInt(loosePieces, 10) || 0);
  const rawQty = (b * currentBoxQuantity) + l;
  const calculatedQty = mode === 'subtract' ? -rawQty : rawQty;

  const QUICK_REASONS = [
    'Physical Audit Correction',
    'Supplier Receipt Intake',
    'Damaged / Expired Goods',
    'Customer Return Re-entry',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.warehouseId || !formData.productId) {
      return toast.error('Please select both warehouse and product');
    }

    if (calculatedQty === 0) {
      return toast.error('Stock adjustment quantity cannot be zero');
    }

    try {
      setLoading(true);
      await api.post('/inventory/stock/adjust', {
        warehouseId: formData.warehouseId,
        productId: formData.productId,
        variantId: formData.variantId || null,
        quantityChange: calculatedQty,
        notes: formData.notes
      });
      toast.success('Stock adjusted successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-amber-600" />
            Adjust Stock Balance
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Mode Switcher */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Adjustment Mode *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('add')}
                className={`p-3 rounded-xl text-left border flex items-center justify-between transition-all ${
                  mode === 'add'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm text-emerald-900 font-bold'
                    : 'border-zinc-200 bg-white text-zinc-700 font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs">Add Stock (+)</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('subtract')}
                className={`p-3 rounded-xl text-left border flex items-center justify-between transition-all ${
                  mode === 'subtract'
                    ? 'border-red-600 bg-red-50/50 shadow-sm text-red-900 font-bold'
                    : 'border-zinc-200 bg-white text-zinc-700 font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Minus className="w-4 h-4 text-red-600" />
                  <span className="text-xs">Deduct Stock (-)</span>
                </div>
              </button>
            </div>
          </div>

          {/* Location & Product Selection */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Target Warehouse *</label>
              <Select
                required
                value={formData.warehouseId}
                onChange={e => setFormData({...formData, warehouseId: e.target.value})}
                options={[
                  { value: '', label: 'Select Warehouse Location...' },
                  ...warehouses.map(w => ({ value: w.id, label: `${w.name} (${w.code})` }))
                ]}
                className="w-full bg-zinc-50 border-zinc-200 h-9 text-xs font-medium rounded-xl"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Target Product / Variant *</label>
              <SearchableSelect
                placeholder="Search product name or SKU..."
                value={inputProduct}
                onChange={handleInputProductChange}
                options={productOptions}
                minSearchChars={1}
              />
            </div>
          </div>

          {/* Unit Quantity Math Workspace */}
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">Quantity Adjustment Breakdown</span>
              <span className="text-[11px] font-mono text-zinc-500">1 Box = {currentBoxQuantity} pcs</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">Full Boxes</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={boxes}
                  onChange={e => setBoxes(e.target.value)}
                  className="h-9 text-xs font-mono bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">Loose Pieces</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={loosePieces}
                  onChange={e => setLoosePieces(e.target.value)}
                  className="h-9 text-xs font-mono bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between bg-white border border-zinc-200/80 rounded-xl px-3.5 py-2">
              <span className="text-xs font-bold text-zinc-600">Net Quantity Change:</span>
              <span className={`text-sm font-extrabold font-mono ${calculatedQty > 0 ? 'text-emerald-600' : calculatedQty < 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                {calculatedQty > 0 ? `+${calculatedQty}` : calculatedQty} units
              </span>
            </div>
          </div>

          {/* Reason & Notes */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Adjustment Reason / Audit Notes</label>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {QUICK_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, notes: r }))}
                  className="text-[10px] font-semibold bg-zinc-100 hover:bg-amber-50 hover:text-amber-800 text-zinc-600 px-2.5 py-1 rounded-lg transition-all"
                >
                  + {r}
                </button>
              ))}
            </div>
            <Textarea
              rows={2}
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              placeholder="Provide reason for stock change..."
              className="w-full bg-zinc-50 border-zinc-200 text-xs rounded-xl"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
            <Button variant="outline" type="button" onClick={onClose} disabled={loading} className="text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || calculatedQty === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition-all"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                'Save Adjustment'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
