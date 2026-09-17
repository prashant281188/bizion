'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';

interface QuickVariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (updatedProduct: any) => void;
  product: any;
}

export function QuickVariantModal({
  isOpen,
  onClose,
  onCreated,
  product,
}: QuickVariantModalProps) {
  // ---- Form state ----
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [sku, setSku] = useState('');
  const [basePrice, setBasePrice] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attributeKeys, setAttributeKeys] = useState<string[]>([]);

  // Reset form whenever the modal opens
  useEffect(() => {
    if (isOpen && product) {
      // Find the attribute keys from the first variant
      const firstVar = product.variants?.[0];
      const keys = firstVar?.attributes ? Object.keys(firstVar.attributes) : [];
      setAttributeKeys(keys);

      const initialAttrs: Record<string, string> = {};
      keys.forEach((k) => (initialAttrs[k] = ''));
      setAttributes(initialAttrs);

      setSku('');
      setBasePrice(product.basePrice?.toString() || '');
      setError('');
      setLoading(false);
    }
  }, [isOpen, product]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleAttributeChange = (key: string, value: string) => {
    setAttributes((prev) => ({ ...prev, [key]: value }));
  };

  // ---- Submit ----
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      // Validation
      for (const key of attributeKeys) {
        if (!attributes[key]?.trim()) {
          setError(`Attribute "${key}" is required.`);
          return;
        }
      }
      
      if (!basePrice || isNaN(Number(basePrice)) || Number(basePrice) < 0) {
        setError('Valid Base Price is required.');
        return;
      }

      setLoading(true);

      try {
        // Fetch the full existing product to preserve all fields
        const productRes = await api.get(`/products/${product.id}`);
        const fullProduct = productRes.data.data;

        // Construct the new variant
        const newVariant = {
          clientKey: `temp_${Date.now()}`,
          name: `${fullProduct.name} - ${Object.values(attributes).join(' ')}`,
          sku: sku.trim() || null,
          attributes: { ...attributes },
          basePrice: parseFloat(basePrice),
          sellingPrice: parseFloat(basePrice),
          costPrice: 0,
          mrp: parseFloat(basePrice),
          isActive: true,
          boxQuantity: fullProduct.boxQuantity || 1,
          stockQuantity: 0,
          listPrice: parseFloat(basePrice),
        };

        // Append the new variant
        const updatedVariants = [...(fullProduct.variants || []), newVariant];
        
        // Construct the update payload
        const payload = {
          ...fullProduct,
          variants: updatedVariants,
          images: fullProduct.images || [],
        };

        const res = await api.put(`/products/${product.id}`, payload);
        onCreated(res.data.data);
        onClose();
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to add variant. Please try again.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [
      attributes,
      attributeKeys,
      sku,
      basePrice,
      product,
      onCreated,
      onClose,
    ]
  );

  // ---- Render ----
  if (!isOpen || !product) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-zinc-200/80 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-white">
          <h2 className="text-base font-bold text-zinc-900">Add Variant to {product.name}</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-semibold">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {attributeKeys.map((key, idx) => (
              <div key={key}>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 capitalize">
                  {key} *
                </label>
                <Input
                  autoFocus={idx === 0}
                  placeholder={`e.g., Small, Red`}
                  value={attributes[key] || ''}
                  onChange={(e) => handleAttributeChange(key, e.target.value)}
                  className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Variant SKU (Optional)
              </label>
              <Input
                placeholder="e.g., VAR-01"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="h-9 text-xs font-mono uppercase bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Override Rate (₹) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="h-9 text-xs font-mono bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white px-6 rounded-xl shadow-sm"
            >
              {loading ? 'Saving...' : 'Save Variant'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
