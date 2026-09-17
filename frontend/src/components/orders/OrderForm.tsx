'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatVariantName, getVariantDetailOnly } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { QuickContactModal } from '@/components/contacts/QuickContactModal';
import { QuickProductModal } from '@/components/products/QuickProductModal';
import { QuickVariantModal } from '@/components/products/QuickVariantModal';
import { ShoppingCart, User, Calendar, Plus, Trash2, Edit, CheckCircle2, ArrowRight, Layers, Building2, Package, Tag } from 'lucide-react';

interface OrderFormProps {
  type: 'sales' | 'purchase';
  isEdit?: boolean;
  initialData?: any;
}

interface OrderItem {
  productId: string;
  variantId: string;
  productLabel: string; // display name
  boxQty: number;
  looseQty: number;
  totalQty: number;
  unitPrice: number;
  resolvedPrice: number;
  priceModified: boolean;
  boxSize: number;
}

export default function OrderForm({ type, isEdit, initialData }: OrderFormProps) {
  const router = useRouter();

  // Master data
  const [contacts, setContacts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customPrices, setCustomPrices] = useState<any[]>([]);
  const [inventoryStock, setInventoryStock] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [orgDetails, setOrgDetails] = useState<any>(null);
  const [customerHasState, setCustomerHasState] = useState(false);

  // Loading
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Quick contact modal
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [quickContactInitialName, setQuickContactInitialName] = useState('');
  const [showQuickProduct, setShowQuickProduct] = useState(false);
  const [quickProductInitialName, setQuickProductInitialName] = useState('');
  const [showQuickVariant, setShowQuickVariant] = useState(false);

  // Form header
  const [contactId, setContactId] = useState(() => initialData?.contactId || initialData?.contact?.id || '');
  const [orderDate, setOrderDate] = useState(() => initialData?.orderDate ? initialData.orderDate.split('T')[0] : new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(() => initialData?.expectedDeliveryDate ? initialData.expectedDeliveryDate.split('T')[0] : '');
  const [isInterState, setIsInterState] = useState(() => initialData?.isInterState || false);
  const [notes, setNotes] = useState(() => initialData?.notes || '');

  // ─── Fixed input bar state (for adding items) ──────────────────────────────
  const [inputProduct, setInputProduct] = useState(''); // prodId
  const [inputVariant, setInputVariant] = useState<string | null>(null); // varId when editing
  const [inputBoxQty, setInputBoxQty] = useState<number>(0);
  const [inputLooseQty, setInputLooseQty] = useState<number>(0);
  const [inputPrice, setInputPrice] = useState<number>(0);
  const boxQtyRef = useRef<HTMLInputElement>(null);

  type VariantGridItem = {
    boxQty: number;
    looseQty: number;
    unitPrice: number;
    resolvedPrice: number;
  };
  const [variantGrid, setVariantGrid] = useState<Record<string, VariantGridItem>>({});

  const [items, setItems] = useState<OrderItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleTableKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    const target = e.target as HTMLElement;
    if (!['INPUT', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

    if (target.tagName === 'INPUT') {
      const input = target as HTMLInputElement;
      if (input.type !== 'checkbox') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          try {
            if (e.key === 'ArrowLeft' && input.selectionStart !== null && input.selectionStart > 0) return;
            if (e.key === 'ArrowRight' && input.selectionEnd !== null && input.selectionEnd < input.value.length) return;
          } catch (err) {
            return;
          }
        }
      }
    }

    const cell = target.closest('td');
    const row = target.closest('tr');
    if (!cell || !row) return;

    const tbody = row.parentElement;
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    const rowIndex = rows.indexOf(row as HTMLTableRowElement);
    const cells = Array.from(row.querySelectorAll('td'));
    const cellIndex = cells.indexOf(cell as HTMLTableCellElement);

    let nextTarget: HTMLElement | null = null;

    if (e.key === 'ArrowUp' && rowIndex > 0) {
      nextTarget = rows[rowIndex - 1].querySelectorAll('td')[cellIndex]?.querySelector('input:not([disabled]), select:not([disabled]), button:not([disabled])');
    } else if (e.key === 'ArrowDown' && rowIndex < rows.length - 1) {
      nextTarget = rows[rowIndex + 1].querySelectorAll('td')[cellIndex]?.querySelector('input:not([disabled]), select:not([disabled]), button:not([disabled])');
    } else if (e.key === 'ArrowLeft' && cellIndex > 0) {
      for (let i = cellIndex - 1; i >= 0; i--) {
        nextTarget = rows[rowIndex].querySelectorAll('td')[i]?.querySelector('input:not([disabled]), select:not([disabled]), button:not([disabled])');
        if (nextTarget) break;
      }
    } else if (e.key === 'ArrowRight' && cellIndex < cells.length - 1) {
      for (let i = cellIndex + 1; i < cells.length; i++) {
        nextTarget = rows[rowIndex].querySelectorAll('td')[i]?.querySelector('input:not([disabled]), select:not([disabled]), button:not([disabled])');
        if (nextTarget) break;
      }
    }

    if (nextTarget) {
      e.preventDefault();
      nextTarget.focus();
      if (nextTarget.tagName === 'INPUT') {
        const nextInput = nextTarget as HTMLInputElement;
        if (nextInput.type !== 'checkbox') {
          try {
            nextInput.select();
          } catch (err) {}
        }
      }
    }
  };

  // ─── Fetch initial data ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setDataLoading(true);
        const [contactsRes, productsRes, stockRes, taxRes, orgRes] = await Promise.all([
          api.get(`/contacts?type=${type === 'sales' ? 'customer' : 'vendor'}&limit=1000`),
          api.get('/products?limit=1000'),
          api.get('/inventory/stock?limit=1000'),
          api.get('/masters/tax-rates?limit=1000'),
          api.get('/organizations/me'),
        ]);
        let fetchedContacts = contactsRes.data?.data || [];
        if (initialData?.contact && !fetchedContacts.some((c: any) => c.id === initialData.contact.id)) {
          fetchedContacts = [initialData.contact, ...fetchedContacts];
        }
        setContacts(fetchedContacts);
        setProducts(productsRes.data?.data || []);
        setInventoryStock(stockRes.data?.data || []);
        setTaxRates(taxRes.data?.data || []);
        setOrgDetails(orgRes.data?.data || null);
      } catch (err) {
        toast.error('Failed to load form data');
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, [type, initialData]);

  // ─── Populate edit header data ────────────────────────────────────────────
  useEffect(() => {
    if (isEdit && initialData) {
      const cId = initialData.contactId || initialData.contact?.id || '';
      if (cId) setContactId(cId);
      if (initialData.orderDate) setOrderDate(initialData.orderDate.split('T')[0]);
      if (initialData.expectedDeliveryDate) setExpectedDeliveryDate(initialData.expectedDeliveryDate.split('T')[0]);
      if (initialData.isInterState !== undefined) setIsInterState(initialData.isInterState);
      if (initialData.notes !== undefined) setNotes(initialData.notes || '');
    }
  }, [isEdit, initialData]);

  // ─── Populate edit line items ─────────────────────────────────────────────
  useEffect(() => {
    if (isEdit && initialData && !dataLoading && products.length > 0) {
      const loadedItems = (initialData.items || []).map((item: any) => {
        const prodId = item.productId || item.product?.id;
        const varId = item.variantId || item.variant?.id || '';
        const boxSize = getBoxQuantity(prodId, varId || null);
        
        let boxQty = 0;
        let looseQty = item.totalQty || item.orderQuantity;
        if (item.unitType === 'box') {
          boxQty = item.orderQuantity;
          looseQty = 0;
        } else {
          looseQty = item.baseQuantity || item.orderQuantity;
        }

        return {
          productId: prodId,
          variantId: varId,
          productLabel: getProductLabel(prodId, varId || null) || item.product?.name || 'Unknown Product',
          boxQty,
          looseQty,
          totalQty: item.baseQuantity || item.orderQuantity,
          unitPrice: Number(item.unitPrice),
          resolvedPrice: Number(item.unitPrice),
          priceModified: false,
          boxSize,
        };
      });
      setItems(loadedItems);
    }
  }, [isEdit, initialData, dataLoading, products]);

  // ─── Fetch custom prices when contact changes ─────────────────────────────
  useEffect(() => {
    if (contactId) {
      api.get(`/contacts/${contactId}/prices?limit=1000`)
        .then(res => setCustomPrices(res.data?.data || []))
        .catch(() => setCustomPrices([]));

      const contact = contacts.find(c => c.id === contactId) || (initialData?.contact?.id === contactId ? initialData.contact : null);
      const billingAddress = contact?.addresses?.find((a: any) => a.isBillingDefault) || contact?.addresses?.[0];
      const hasState = !!(billingAddress?.stateCode || billingAddress?.stateName);
      setCustomerHasState(hasState);
      
      if (hasState && orgDetails) {
        const orgState = orgDetails.stateCode || orgDetails.stateName;
        const contactState = billingAddress.stateCode || billingAddress.stateName;
        setIsInterState(String(orgState).trim().toLowerCase() !== String(contactState).trim().toLowerCase());
      }
    } else {
      setCustomPrices([]);
      setCustomerHasState(false);
    }
  }, [contactId, contacts, orgDetails, initialData]);

  // When custom prices load, re-resolve price in the input bar if a product is selected
  useEffect(() => {
    if (inputProduct) {
      const product = products.find(p => p.id === inputProduct);
      if (product?.hasVariants && product.variants?.length > 0) {
        setVariantGrid(prev => {
          const next = { ...prev };
          product.variants.forEach((v: any) => {
            if (next[v.id]) {
               const newPrice = resolveUnitPrice(inputProduct, v.id);
               next[v.id].resolvedPrice = newPrice;
               next[v.id].unitPrice = newPrice;
            }
          });
          return next;
        });
      } else {
        const newPrice = resolveUnitPrice(inputProduct, null);
        setInputPrice(newPrice);
      }
    }
  }, [customPrices, products]);

  // ─── Price resolution ─────────────────────────────────────────────────────
  const resolveUnitPrice = useCallback((productId: string, variantId: string | null): number => {
    const rule = customPrices.find(
      (cp) =>
        cp.productId === productId &&
        (variantId ? cp.variantId === variantId : !cp.variantId)
    );
    if (rule) return Number(rule.customPrice);

    const product = products.find((p) => p.id === productId);
    if (!product) return 0;

    if (variantId) {
      const variant = product.variants?.find((v: any) => v.id === variantId);
      if (variant) {
        return Number(type === 'sales' ? variant.sellingPrice : variant.valuationCost);
      }
    }

    return Number(type === 'sales' ? product.sellingPrice : product.valuationCost);
  }, [customPrices, products, type]);

  // ─── Contact options ───────────────────────────────────────────────────────
  const contactOptions = useMemo(() => {
    const list = [...contacts];
    if (initialData?.contact && !list.some(c => c.id === initialData.contact.id)) {
      list.unshift(initialData.contact);
    }
    return list.map(c => {
      const isDeactivated = c.isActive === false;
      return {
        value: c.id,
        label: `${c.displayName || c.companyName || 'Unnamed Contact'}${isDeactivated ? ' [DEACTIVATED]' : ''}`,
        sublabel: [
          isDeactivated ? '⚠️ DEACTIVATED' : null,
          c.companyName,
          c.phone,
          c.email
        ].filter(Boolean).join(' • '),
        rightElement: isDeactivated ? (
          <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200 uppercase">
            Deactivated
          </span>
        ) : undefined,
      };
    });
  }, [contacts, initialData]);

  // ─── Product options ───────────────────────────────────────────────────────
  const getAvailableStock = useCallback((prodId: string, varId?: string) => {
    const records = inventoryStock.filter(
      s => s.productId === prodId && (varId ? s.variantId === varId : !s.variantId)
    );
    return records.reduce((sum, r) => sum + (r.quantityOnHand - (r.quantityReserved || 0)), 0);
  }, [inventoryStock]);

  const productOptions = useMemo(() => {
    const options: any[] = [];

    products.forEach((p) => {
      if (p.hasVariants && p.variants?.length > 0) {
        // Group Option (All Variants Matrix)
        const varSkus = p.variants.map((v: any) => v.sku).filter(Boolean).join(', ');
        options.push({
          value: p.id,
          label: `${p.name} (All Variants Matrix)`,
          sublabel: `Variants: ${p.variants.length} ${varSkus ? `• SKUs: ${varSkus}` : ''} • Group Grid Entry`,
          sku: p.sku || undefined,
          imageUrl: p.images?.[0]?.url || undefined,
          rightElement: (
            <div className="flex flex-col items-end gap-1">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 border-zinc-200">
                {p.variants.length} Variants Grid
              </Badge>
            </div>
          )
        });

        // Direct Variant Options
        p.variants.forEach((v: any) => {
          const stock = getAvailableStock(p.id, v.id);
          const globalPrice = Number(type === 'sales' ? (v.sellingPrice || p.sellingPrice || 0) : (v.valuationCost || p.valuationCost || 0));
          const rule = customPrices.find((cp) => cp.productId === p.id && cp.variantId === v.id);
          const priceLabel = rule
            ? `Customer: ₹${rule.customPrice} (Catalog: ₹${globalPrice})`
            : `₹${globalPrice}`;

          const formattedLabel = formatVariantName(p.name, v.name, v.sku);
          const varDetail = getVariantDetailOnly(p.name, v.name) || v.sku || 'N/A';

          options.push({
            value: `${p.id}:${v.id}`,
            label: formattedLabel,
            sublabel: `Variant: ${varDetail} • SKU: ${v.sku || 'N/A'} • Box Size: ${v.boxQuantity || p.boxQuantity || 1}`,
            sku: v.sku || p.sku || undefined,
            imageUrl: v.imageUrl || p.images?.[0]?.url || undefined,
            rightElement: (
              <div className="flex flex-col items-end gap-1">
                <Badge variant={stock > 0 ? "outline" : "destructive"} className="text-[10px] px-1.5 py-0 h-4 border-zinc-200">
                  {stock > 0 ? `${stock} In Stock` : 'Out of Stock'}
                </Badge>
                <span className="text-xs font-semibold text-amber-700">{priceLabel}</span>
              </div>
            )
          });
        });
      } else {
        const stock = getAvailableStock(p.id);
        const globalPrice = Number(type === 'sales' ? (p.sellingPrice || 0) : (p.valuationCost || 0));
        const rule = customPrices.find((cp) => cp.productId === p.id && !cp.variantId);
        const priceLabel = rule
          ? `Customer: ₹${rule.customPrice} (Catalog: ₹${globalPrice})`
          : `₹${globalPrice}`;

        options.push({
          value: `${p.id}:default`,
          label: p.name,
          sublabel: p.sku ? `SKU: ${p.sku}` : undefined,
          sku: p.sku || undefined,
          imageUrl: p.images?.[0]?.url || undefined,
          rightElement: (
            <div className="flex flex-col items-end gap-1">
              <Badge variant={stock > 0 ? "outline" : "destructive"} className="text-[10px] px-1.5 py-0 h-4 border-zinc-200">
                {stock > 0 ? `${stock} In Stock` : 'Out of Stock'}
              </Badge>
              <span className="text-xs font-semibold text-amber-700">{priceLabel}</span>
            </div>
          )
        });
      }
    });

    return options;
  }, [products, inventoryStock, type, customPrices, getAvailableStock]);

  // ─── Get box quantity for a product/variant ────────────────────────────────
  const getBoxQuantity = useCallback((productId: string, variantId: string | null): number => {
    const product = products.find((p) => p.id === productId);
    if (!product) return 1;
    if (variantId) {
      const variant = product.variants?.find((v: any) => v.id === variantId);
      if (variant?.boxQuantity) return variant.boxQuantity;
    }
    return product.boxQuantity || 1;
  }, [products]);

  // ─── Get product label ─────────────────────────────────────────────────────
  const getProductLabel = useCallback((productId: string, variantId: string | null): string => {
    const product = products.find((p) => p.id === productId);
    if (!product) return '—';
    if (variantId) {
      const variant = product.variants?.find((v: any) => v.id === variantId);
      if (variant) return formatVariantName(product.name, variant.name, variant.sku);
    }
    return product.name;
  }, [products]);

  // ─── When product changes in input bar ─────────────────────────────────────
  const handleInputProductChange = (selectedVal: string) => {
    setEditingIndex(null);
    if (!selectedVal) {
      setInputProduct('');
      setInputVariant(null);
      setInputPrice(0);
      setInputBoxQty(0);
      setInputLooseQty(0);
      setVariantGrid({});
      return;
    }

    if (selectedVal.includes(':')) {
      const [prodId, varId] = selectedVal.split(':');
      const actualVarId = varId === 'default' ? null : varId;
      setInputProduct(prodId);
      setInputVariant(actualVarId);
      setVariantGrid({});

      const price = resolveUnitPrice(prodId, actualVarId);
      setInputPrice(price);
      setInputBoxQty(0);
      setInputLooseQty(0);
      setTimeout(() => boxQtyRef.current?.focus(), 50);
    } else {
      setInputProduct(selectedVal);
      setInputVariant(null);

      const product = products.find((p) => p.id === selectedVal);
      if (product?.hasVariants && product.variants?.length > 0) {
        const gridState: Record<string, VariantGridItem> = {};
        product.variants.forEach((v: any) => {
          const price = resolveUnitPrice(selectedVal, v.id);
          gridState[v.id] = { boxQty: 0, looseQty: 0, unitPrice: price, resolvedPrice: price };
        });
        setVariantGrid(gridState);
      } else {
        const price = resolveUnitPrice(selectedVal, null);
        setInputPrice(price);
        setInputBoxQty(0);
        setInputLooseQty(0);
        setVariantGrid({});
        setTimeout(() => boxQtyRef.current?.focus(), 50);
      }
    }
  };

  // ─── Calculate total loose from box+loose ──────────────────────────────────
  const calcInputTotalQty = (): number => {
    if (!inputProduct) return 0;
    const boxSize = getBoxQuantity(inputProduct, inputVariant);
    return (inputBoxQty * boxSize) + inputLooseQty;
  };

  // ─── Add item to the list ──────────────────────────────────────────────────
  const handleAddItem = () => {
    if (!inputProduct) {
      toast.error('Please select a product');
      return;
    }

    const product = products.find(p => p.id === inputProduct);
    const isVariantGrid = product?.hasVariants && product.variants?.length > 0 && !inputVariant && editingIndex === null;

    if (isVariantGrid) {
      let itemsAdded = 0;
      Object.entries(variantGrid).forEach(([varId, gridItem]) => {
        const boxSize = getBoxQuantity(inputProduct, varId);
        const totalQty = (gridItem.boxQty * boxSize) + gridItem.looseQty;
        if (totalQty > 0) {
          const newItem: OrderItem = {
            productId: inputProduct,
            variantId: varId,
            productLabel: getProductLabel(inputProduct, varId),
            boxQty: gridItem.boxQty,
            looseQty: gridItem.looseQty,
            totalQty,
            unitPrice: gridItem.unitPrice,
            resolvedPrice: gridItem.resolvedPrice,
            priceModified: gridItem.unitPrice !== gridItem.resolvedPrice,
            boxSize,
          };

          if (type === 'sales') {
            const stock = getAvailableStock(inputProduct, varId);
            if (totalQty > stock) {
              toast.warning(`Insufficient stock for ${newItem.productLabel}. Selling ${totalQty} but only ${stock} available.`);
            }
          }

          commitItem(newItem);
          itemsAdded++;
        }
      });

      if (itemsAdded === 0) {
        toast.error('Please enter quantity for at least one variant');
      } else {
        toast.success(`Added ${itemsAdded} variant(s)`);
        setInputProduct('');
        setVariantGrid({});
      }
    } else {
      // Single product addition
      const totalQty = calcInputTotalQty();
      if (totalQty <= 0) {
        toast.error('Quantity must be greater than 0');
        return;
      }

      const boxSize = getBoxQuantity(inputProduct, inputVariant);
      const resolvedPrice = resolveUnitPrice(inputProduct, inputVariant);

      const newItem: OrderItem = {
        productId: inputProduct,
        variantId: inputVariant || '',
        productLabel: getProductLabel(inputProduct, inputVariant),
        boxQty: inputBoxQty,
        looseQty: inputLooseQty,
        totalQty,
        unitPrice: inputPrice,
        resolvedPrice,
        priceModified: inputPrice !== resolvedPrice,
        boxSize,
      };

      if (type === 'sales') {
        const stock = getAvailableStock(inputProduct, inputVariant || undefined);
        if (totalQty > stock) {
          toast.warning(`Insufficient stock. You are selling ${totalQty} units but only ${stock} are available.`);
        }
      }

      commitItem(newItem);
    }
  };

  const commitItem = (newItem: OrderItem) => {
    if (editingIndex !== null) {
      setItems(prev => {
        const updated = [...prev];
        updated[editingIndex] = newItem;
        return updated;
      });
      setEditingIndex(null);
      toast.success(`Updated ${newItem.productLabel}`);
    } else {
      // Check if same product+variant already exists — merge quantities
      const existingIdx = items.findIndex(
        i => i.productId === newItem.productId && i.variantId === newItem.variantId
      );

      if (existingIdx >= 0) {
        setItems(prev => {
          const updated = [...prev];
        const existing = updated[existingIdx];
        existing.boxQty += inputBoxQty;
        existing.looseQty += inputLooseQty;
        existing.totalQty = (existing.boxQty * existing.boxSize) + existing.looseQty;
        existing.unitPrice = newItem.unitPrice; // use latest price from newItem
        existing.priceModified = newItem.unitPrice !== newItem.resolvedPrice;
        return updated;
      });
      toast.success(`Updated quantity for ${newItem.productLabel}`);
    } else {
      setItems(prev => [...prev, newItem]);
    }
    }

    // Reset inputs
    setInputProduct('');
    setInputVariant(null);
    setInputBoxQty(0);
    setInputLooseQty(0);
    setInputPrice(0);
    // Auto-focus the product search

    // Auto-focus the product search
    setTimeout(() => {
      document.getElementById('product-search-input')?.focus();
    }, 50);
  };

  // ─── Handle Enter key in input fields to add item ──────────────────────────
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  // ─── Remove item ───────────────────────────────────────────────────────────
  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const editItem = (index: number) => {
    const item = items[index];
    setEditingIndex(index);
    setInputProduct(item.productId);
    setInputVariant(item.variantId || null);
    
    setInputBoxQty(item.boxQty);
    setInputLooseQty(item.looseQty);
    setInputPrice(item.unitPrice);
    setTimeout(() => boxQtyRef.current?.focus(), 50);
  };

  // ─── Grand total and Taxes ──────────────────────────────────────────────────
  const taxSummary = useMemo(() => {
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    items.forEach(item => {
      const itemTaxableValue = item.totalQty * item.unitPrice;
      taxableAmount += itemTaxableValue;

      // Find tax rate
      const product = products.find(p => p.id === item.productId);
      if (product?.taxRateId) {
        const rate = taxRates.find(r => r.id === product.taxRateId);
        if (rate) {
          if (isInterState) {
            igstAmount += (itemTaxableValue * Number(rate.igstRate || 0)) / 100;
          } else {
            cgstAmount += (itemTaxableValue * Number(rate.cgstRate || 0)) / 100;
            sgstAmount += (itemTaxableValue * Number(rate.sgstRate || 0)) / 100;
          }
        }
      }
    });

    const totalTax = cgstAmount + sgstAmount + igstAmount;
    const rawGrandTotal = taxableAmount + totalTax;
    const grandTotal = Math.round(rawGrandTotal);
    const roundOff = grandTotal - rawGrandTotal;

    return { taxableAmount, cgstAmount, sgstAmount, igstAmount, totalTax, roundOff, grandTotal };
  }, [items, products, taxRates, isInterState]);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // ─── Contact creation callback ─────────────────────────────────────────────
  const handleContactCreated = (newContact: any) => {
    setContacts(prev => [newContact, ...prev]);
    setContactId(newContact.id);
    toast.success(`${type === 'sales' ? 'Customer' : 'Supplier'} "${newContact.displayName}" created`);
  };

  const handleProductCreated = (newProduct: any) => {
    setProducts(prev => [...prev, newProduct]);
    setInputProduct(newProduct.id);
  };

  const handleVariantCreated = (updatedProduct: any) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };

  // ─── Submit (Triggers Confirmation) ────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (type === 'sales' && !contactId) {
      toast.error('Please select a customer');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    setShowConfirmModal(true);
  };

  // ─── Confirm Save Order ───────────────────────────────────────────────────
  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    try {
      // 1. Save modified prices as customer custom prices
      if (contactId) {
        const pricesToSave = items.filter(i => i.priceModified && i.unitPrice > 0);
        for (const item of pricesToSave) {
          try {
            await api.post(`/contacts/${contactId}/prices`, {
              productId: item.productId,
              variantId: item.variantId || null,
              customPrice: item.unitPrice,
            });
          } catch (err) {
            console.warn('Failed to save custom price for', item.productId, err);
          }
        }
      }

      // 2. Create the order
      const orderItems = items.map(item => ({
        productId: item.productId,
        variantId: item.variantId || null,
        unitType: 'loose' as const,
        orderQuantity: item.totalQty,
        unitPrice: Number(item.unitPrice),
      }));

      const payload = {
        type,
        contactId: contactId || null,
        orderDate,
        expectedDeliveryDate: expectedDeliveryDate || null,
        isInterState,
        roundOff: taxSummary.roundOff,
        notes,
        items: orderItems,
      };

      if (isEdit && initialData?.id) {
        await api.put(`/orders/${initialData.id}`, payload);
        toast.success(`${type === 'sales' ? 'Sales' : 'Purchase'} Order updated successfully!`);
        router.push(`/dashboard/orders/${type === 'sales' ? 'sales' : 'purchases'}/${initialData.id}`);
      } else {
        await api.post('/orders', payload);
        toast.success(`${type === 'sales' ? 'Sales' : 'Purchase'} Order created successfully!`);
        router.push(`/dashboard/orders/${type === 'sales' ? 'sales' : 'purchases'}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save order');
    } finally {
      setLoading(false);
    }
  };

  // ─── Input bar computed values ─────────────────────────────────────────────
  const inputTotalQty = calcInputTotalQty();
  const inputLineTotal = inputTotalQty * inputPrice;
  const inputBoxSize = inputProduct ? getBoxQuantity(inputProduct, null) : 0;

  if (dataLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-zinc-100 rounded-lg" />
        <div className="h-10 bg-zinc-100 rounded-lg" />
        <div className="h-40 bg-zinc-100 rounded-lg" />
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Header Metadata Card */}
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-5 space-y-4 overflow-visible">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-700 rounded-xl">
                <ShoppingCart className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  {isEdit ? 'Edit' : 'Create'} {type === 'sales' ? 'Sales Order' : 'Purchase Order'}
                  <Badge variant="outline" className="text-[11px] font-semibold bg-amber-500/10 text-amber-800 border-amber-500/20 capitalize">
                    {type === 'sales' ? 'Customer Order' : 'Vendor Procurement'}
                  </Badge>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Select {type === 'sales' ? 'customer' : 'supplier'}, set order date, and add line items.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-12 items-start">
            {/* Party Selector */}
            <div className="md:col-span-4 space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  Select {type === 'sales' ? 'Customer *' : 'Supplier / Vendor'}
                </label>
              </div>
              <SearchableSelect
                placeholder={`Search ${type === 'sales' ? 'customer' : 'supplier'}...`}
                options={contactOptions}
                value={contactId}
                onChange={setContactId}
                required={type === 'sales'}
                createNewText="Contact"
                onCreateNew={(term) => {
                  setQuickContactInitialName(term);
                  setShowQuickContact(true);
                }}
              />

              {/* Selected Contact Details Preview */}
              {(() => {
                const activeContact = contacts.find(c => c.id === contactId) || (initialData?.contact?.id === contactId ? initialData.contact : null);
                if (!activeContact) return null;
                const isDeactivated = activeContact.isActive === false;
                return (
                  <div className={`p-2.5 rounded-xl text-xs space-y-1 mt-2 border ${
                    isDeactivated
                      ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                      : 'bg-amber-50/50 border border-amber-200/60'
                  }`}>
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        {activeContact.displayName}
                        {isDeactivated && (
                          <span className="text-[10px] bg-rose-600 text-white font-extrabold px-1.5 py-0.5 rounded shadow-xs uppercase tracking-wider">
                            Deactivated
                          </span>
                        )}
                      </span>
                      {activeContact.gstin && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          isDeactivated
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-500/10 text-amber-800 border border-amber-500/20'
                        }`}>
                          GST: {activeContact.gstin}
                        </span>
                      )}
                    </div>
                    {activeContact.companyName && (
                      <p className="text-[11px] text-zinc-600 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-zinc-400 shrink-0" />
                        {activeContact.companyName}
                      </p>
                    )}
                    {isDeactivated && (
                      <p className="text-[11px] text-rose-700 font-semibold pt-1 border-t border-rose-200/70 flex items-center gap-1">
                        ⚠️ Note: This contact is marked as deactivated.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Order & Delivery Dates */}
            <div className="md:col-span-8 grid gap-4 sm:grid-cols-3">
              <Input
                label="Order Date *"
                name="orderDate"
                type="date"
                required
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="h-[38px] text-xs"
              />

              <Input
                label="Expected Delivery Date"
                name="deliveryDate"
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="h-[38px] text-xs"
              />

              <div className="flex flex-col justify-end pb-0.5">
                {!customerHasState && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer p-2 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-zinc-100/80 transition-colors">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-zinc-300 rounded"
                      checked={isInterState}
                      onChange={(e) => setIsInterState(e.target.checked)}
                    />
                    <span>Inter-State (Apply IGST)</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-3">
            <Input
              label="Order Notes / Instructions"
              name="notes"
              type="text"
              placeholder="e.g. Deliver before 5 PM, fragile packing requested..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-[38px] text-xs"
            />
          </div>
        </Card>

        {/* 2. Fast Product Entry Workspace */}
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-5 space-y-4 overflow-visible">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600" />
              {editingIndex !== null ? 'Update Order Line' : 'Add Product to Order'}
            </h3>
            {editingIndex !== null && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingIndex(null);
                  setInputProduct('');
                  setInputVariant(null);
                  setInputBoxQty(0);
                  setInputLooseQty(0);
                  setInputPrice(0);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-800 h-7"
              >
                Cancel Edit
              </Button>
            )}
          </div>

          <CardContent className="p-0 overflow-visible w-full">
            <div className="grid grid-cols-12 gap-3 items-end">
              {/* Product Search */}
              <div className={`col-span-12 ${products.find(p => p.id === inputProduct)?.hasVariants && products.find(p => p.id === inputProduct)?.variants?.length > 0 && !inputVariant && editingIndex === null ? 'lg:col-span-10' : 'lg:col-span-4'}`}>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-zinc-600">Product / Variant *</label>
                  <div className="flex items-center gap-2">
                    {inputProduct && products.find(p => p.id === inputProduct)?.hasVariants && (
                      <button
                        type="button"
                        onClick={() => setShowQuickVariant(true)}
                        className="text-[10px] text-amber-600 font-semibold hover:underline"
                      >
                        + Add Variant
                      </button>
                    )}
                    {inputVariant && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-800 border border-amber-500/20 text-[10px] font-semibold">
                        {getProductLabel(inputProduct, inputVariant).replace((products.find(p => p.id === inputProduct)?.name || '') + ' - ', '')}
                      </span>
                    )}
                  </div>
                </div>
                <SearchableSelect
                  id="product-search-input"
                  placeholder="Type product name, SKU, or variant..."
                  options={productOptions}
                  value={
                    inputVariant
                      ? `${inputProduct}:${inputVariant}`
                      : (products.find(p => p.id === inputProduct)?.hasVariants
                          ? inputProduct
                          : (inputProduct ? `${inputProduct}:default` : ''))
                  }
                  onChange={handleInputProductChange}
                  minSearchChars={1}
                  createNewText="Product"
                  onCreateNew={(term) => {
                    setQuickProductInitialName(term);
                    setShowQuickProduct(true);
                  }}
                />
              </div>

              {/* Single Product Field Inputs */}
              {(!inputProduct || !!inputVariant || editingIndex !== null || !(products.find(p => p.id === inputProduct)?.hasVariants && products.find(p => p.id === inputProduct)?.variants?.length > 0)) && (
                <>
                  <div className="col-span-4 lg:col-span-1">
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">
                      Boxes {inputProduct && <span className="text-[10px] text-zinc-400 font-normal ml-0.5">({getBoxQuantity(inputProduct, inputVariant)}/b)</span>}
                    </label>
                    <input
                      ref={boxQtyRef}
                      type="number"
                      min="0"
                      className="w-full border border-zinc-200 rounded-lg px-2.5 py-2 text-xs text-center font-mono focus:ring-amber-500 focus:border-amber-500 focus:outline-none h-[38px]"
                      value={inputBoxQty || ''}
                      placeholder="0"
                      onChange={(e) => setInputBoxQty(Number(e.target.value) || 0)}
                      onKeyDown={handleInputKeyDown}
                      disabled={!inputProduct}
                    />
                  </div>
                  <div className="col-span-4 lg:col-span-1">
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">Loose</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full border border-zinc-200 rounded-lg px-2.5 py-2 text-xs text-center font-mono focus:ring-amber-500 focus:border-amber-500 focus:outline-none h-[38px]"
                      value={inputLooseQty || ''}
                      placeholder="0"
                      onChange={(e) => setInputLooseQty(Number(e.target.value) || 0)}
                      onKeyDown={handleInputKeyDown}
                      disabled={!inputProduct}
                    />
                  </div>
                  <div className="col-span-4 lg:col-span-1">
                    <label className="block text-xs font-semibold text-amber-800 mb-1">Total Qty</label>
                    <div className="w-full border border-amber-500/20 bg-amber-500/10 rounded-lg h-[38px] flex items-center justify-center font-bold text-amber-900 font-mono text-sm">
                      {calcInputTotalQty()}
                    </div>
                  </div>
                  <div className="col-span-6 lg:col-span-2">
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`w-full border rounded-lg px-2.5 py-2 text-xs font-mono focus:ring-amber-500 focus:border-amber-500 focus:outline-none h-[38px] ${
                        inputProduct && inputPrice !== resolveUnitPrice(inputProduct, null)
                          ? 'border-amber-400 bg-amber-50 text-amber-900 font-semibold'
                          : 'border-zinc-200 text-zinc-800'
                      }`}
                      value={inputPrice || ''}
                      placeholder="0.00"
                      onChange={(e) => setInputPrice(Number(e.target.value) || 0)}
                      onKeyDown={handleInputKeyDown}
                      disabled={!inputProduct}
                    />
                  </div>
                </>
              )}

              {/* Add Button */}
              {(!inputProduct || !!inputVariant || editingIndex !== null || !(products.find(p => p.id === inputProduct)?.hasVariants && products.find(p => p.id === inputProduct)?.variants?.length > 0)) && (
                <div className="col-span-6 lg:col-span-3">
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    disabled={!inputProduct || inputTotalQty <= 0}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 rounded-xl h-[38px] shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  >
                    {editingIndex !== null ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Update Line Item
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Add Item to Order
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Matrix Variant Selection Grid */}
            {inputProduct && !inputVariant && editingIndex === null && (() => {
              const product = products.find(p => p.id === inputProduct);
              if (!product || !product.hasVariants || !product.variants?.length) return null;

              const firstVar = product.variants[0];
              const attributes = firstVar.attributes || {};
              const attrKeys = Object.keys(attributes);

              if (attrKeys.length >= 2) {
                const colAttr = attrKeys[attrKeys.length - 1];
                const rowAttr = attrKeys[attrKeys.length - 2];
                const groupAttrs = attrKeys.slice(0, attrKeys.length - 2);

                const groupCombinations: Record<string, string>[] = [];
                if (groupAttrs.length > 0) {
                  const seenCombinations = new Set<string>();
                  product.variants.forEach((v: any) => {
                    const combo: Record<string, string> = {};
                    groupAttrs.forEach(attr => {
                      combo[attr] = v.attributes[attr] || '';
                    });
                    const comboKey = JSON.stringify(combo);
                    if (!seenCombinations.has(comboKey)) {
                      seenCombinations.add(comboKey);
                      groupCombinations.push(combo);
                    }
                  });
                } else {
                  groupCombinations.push({});
                }

                const colValues = Array.from(new Set(product.variants.map((v: any) => v.attributes[colAttr]))).filter(Boolean) as string[];

                return (
                  <div className="mt-4 flex flex-col gap-6">
                    <div className="flex justify-between items-center -mb-2">
                      <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Select Matrix Variants to Order</span>
                      <Button variant="ghost" type="button" onClick={() => setShowQuickVariant(true)} className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8 px-3 text-xs font-semibold">
                        + Add New Variant
                      </Button>
                    </div>
                    {groupCombinations.map((combo, comboIdx) => {
                      const matchingVariants = product.variants.filter((v: any) => {
                        return Object.entries(combo).every(([k, val]) => (v.attributes[k] || '') === val);
                      });

                      const rowValues = Array.from(new Set(matchingVariants.map((v: any) => v.attributes[rowAttr]))).filter(Boolean) as string[];
                      if (rowValues.length === 0) return null;

                      const comboTitle = Object.entries(combo).map(([k, v]) => `${k}: ${v}`).join(' | ');

                      return (
                        <div key={comboIdx} className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
                          {comboTitle && (
                            <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200 font-bold text-zinc-800 text-xs">
                              <span>{comboTitle}</span>
                            </div>
                          )}
                          <div className="overflow-x-auto">
                            <Table className="min-w-full text-left text-xs text-zinc-600">
                              <TableHeader className="bg-zinc-50/80 font-semibold uppercase text-zinc-500">
                                <TableRow className="border-b border-zinc-100">
                                  <TableHead className="px-4 py-2.5 font-bold border-r border-zinc-200 bg-zinc-100 whitespace-nowrap">{rowAttr} \ {colAttr}</TableHead>
                                  {colValues.map((colVal: string) => (
                                    <TableHead key={colVal} className="px-4 py-2.5 font-bold text-center border-r border-zinc-200">{colVal}</TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody className="divide-y divide-zinc-100" onKeyDown={handleTableKeyDown}>
                                {rowValues.map((rowVal: string) => (
                                  <TableRow key={rowVal} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                                    <TableCell className="px-4 py-2.5 font-bold text-zinc-900 border-r border-zinc-200 bg-zinc-50/50 align-middle whitespace-nowrap">
                                      {rowVal}
                                    </TableCell>
                                    {colValues.map((colVal: string) => {
                                      const v = matchingVariants.find((v: any) => v.attributes[rowAttr] === rowVal && v.attributes[colAttr] === colVal);
                                      if (!v) {
                                        return <TableCell key={colVal} className="px-4 py-2.5 text-center bg-zinc-50/20 border-r border-zinc-200 text-zinc-300">N/A</TableCell>;
                                      }

                                      const gridItem = variantGrid[v.id];
                                      if (!gridItem) return <TableCell key={colVal} className="px-4 py-2.5 border-r border-zinc-200"></TableCell>;

                                      const stock = getAvailableStock(product.id, v.id);
                                      const boxSize = v.boxQuantity || 1;

                                      return (
                                        <TableCell key={colVal} className="px-4 py-2.5 border-r border-zinc-200 align-top">
                                          <div className="flex flex-col gap-1.5">
                                            <div className="flex justify-between items-center text-[10px] font-medium text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded font-mono">
                                              <span className={stock <= 0 ? 'text-red-600 font-bold' : 'text-amber-700'}>Stock: {stock}</span>
                                              {v.sku && <span>{v.sku}</span>}
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-1.5">
                                              <div>
                                                <label className="text-[10px] text-zinc-500 font-semibold mb-0.5 block">Box ({boxSize})</label>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  className="w-full border border-zinc-200 rounded text-center px-1 py-0.5 text-xs font-mono h-7 focus:ring-1 focus:ring-amber-500"
                                                  value={gridItem.boxQty || ''}
                                                  placeholder="0"
                                                  onChange={(e) => setVariantGrid(prev => ({ ...prev, [v.id]: { ...prev[v.id], boxQty: Number(e.target.value) || 0 } }))}
                                                />
                                              </div>
                                              <div>
                                                <label className="text-[10px] text-zinc-500 font-semibold mb-0.5 block">Loose</label>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  className="w-full border border-zinc-200 rounded text-center px-1 py-0.5 text-xs font-mono h-7 focus:ring-1 focus:ring-amber-500"
                                                  value={gridItem.looseQty || ''}
                                                  placeholder="0"
                                                  onChange={(e) => setVariantGrid(prev => ({ ...prev, [v.id]: { ...prev[v.id], looseQty: Number(e.target.value) || 0 } }))}
                                                />
                                              </div>
                                            </div>

                                            <div>
                                              <label className="text-[10px] text-zinc-500 font-semibold mb-0.5 block">Price (₹)</label>
                                              <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className={`w-full border rounded text-right px-1.5 py-0.5 text-xs font-mono h-7 ${
                                                  gridItem.unitPrice !== gridItem.resolvedPrice ? 'border-amber-400 bg-amber-50 text-amber-900 font-semibold' : 'border-zinc-200 text-zinc-800'
                                                }`}
                                                value={gridItem.unitPrice || ''}
                                                onChange={(e) => setVariantGrid(prev => ({ ...prev, [v.id]: { ...prev[v.id], unitPrice: Number(e.target.value) || 0 } }))}
                                              />
                                            </div>
                                          </div>
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })}

                    <div className="p-3 bg-zinc-50 flex justify-end border border-zinc-200 rounded-xl">
                      <Button
                        type="button"
                        onClick={handleAddItem}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2 rounded-xl shadow-sm flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Matrix Items to Order
                      </Button>
                    </div>
                  </div>
                );
              }

              // Fallback 1D Grid
              return (
                <div className="mt-4 space-y-3">
                  <div className="border border-zinc-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
                    <Table className="min-w-full text-left text-xs text-zinc-600">
                      <TableHeader className="bg-zinc-50/80 font-semibold uppercase text-zinc-500">
                        <TableRow className="border-b border-zinc-100">
                          <TableHead className="px-4 py-2.5 font-bold">Variant</TableHead>
                          <TableHead className="px-4 py-2.5 font-bold text-center">Available Stock</TableHead>
                          <TableHead className="px-4 py-2.5 font-bold text-right w-24">Price (₹)</TableHead>
                          <TableHead className="px-4 py-2.5 font-bold text-center w-28">Box Qty</TableHead>
                          <TableHead className="px-4 py-2.5 font-bold text-center w-20">Loose Qty</TableHead>
                          <TableHead className="px-4 py-2.5 font-bold text-center w-20">Total Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-zinc-100" onKeyDown={handleTableKeyDown}>
                        {products.find(p => p.id === inputProduct)?.variants?.map((v: any) => {
                          const gridItem = variantGrid[v.id];
                          if (!gridItem) return null;
                          const stock = getAvailableStock(inputProduct, v.id);
                          const boxSize = v.boxQuantity || 1;
                          const totalQty = (gridItem.boxQty * boxSize) + gridItem.looseQty;
                          return (
                            <TableRow key={v.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                              <TableCell className="px-4 py-2.5">
                                <div className="font-bold text-zinc-900">{v.name || v.sku || 'Variant'}</div>
                                {v.sku && <div className="text-[10px] font-mono text-zinc-400">SKU: {v.sku}</div>}
                              </TableCell>
                              <TableCell className="px-4 py-2.5 text-center font-mono font-bold text-zinc-700">{stock}</TableCell>
                              <TableCell className="px-4 py-2.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className={`w-full border rounded text-right px-2 py-1 text-xs font-mono ${
                                    gridItem.unitPrice !== gridItem.resolvedPrice ? 'border-amber-400 bg-amber-50 font-semibold' : 'border-zinc-200'
                                  }`}
                                  value={gridItem.unitPrice || ''}
                                  onChange={(e) => setVariantGrid(prev => ({ ...prev, [v.id]: { ...prev[v.id], unitPrice: Number(e.target.value) || 0 } }))}
                                />
                              </TableCell>
                              <TableCell className="px-4 py-2.5">
                                <div className="flex items-center justify-center gap-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    className="w-16 border border-zinc-200 rounded text-center px-1 py-1 text-xs font-mono h-7"
                                    value={gridItem.boxQty || ''}
                                    placeholder="0"
                                    onChange={(e) => setVariantGrid(prev => ({ ...prev, [v.id]: { ...prev[v.id], boxQty: Number(e.target.value) || 0 } }))}
                                  />
                                  <span className="text-[10px] text-zinc-400 font-mono">×{boxSize}</span>
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-2.5">
                                <input
                                  type="number"
                                  min="0"
                                  className="w-full border border-zinc-200 rounded text-center px-1 py-1 text-xs font-mono h-7"
                                  value={gridItem.looseQty || ''}
                                  placeholder="0"
                                  onChange={(e) => setVariantGrid(prev => ({ ...prev, [v.id]: { ...prev[v.id], looseQty: Number(e.target.value) || 0 } }))}
                                />
                              </TableCell>
                              <TableCell className="px-4 py-2.5 text-center font-extrabold text-zinc-900 font-mono">
                                {totalQty}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleAddItem}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2 rounded-xl shadow-sm flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Selected Variants to Order
                    </Button>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* 3. Interactive Order Items Table */}
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50/50">
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" />
              Order Items Breakdown
              {items.length > 0 && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-800 border-amber-500/20 text-[10px]">
                  {items.length} item{items.length > 1 ? 's' : ''}
                </Badge>
              )}
            </h3>
          </div>

          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-sm">
                <Package className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
                <p className="font-semibold text-zinc-600">No products added yet</p>
                <p className="text-xs text-zinc-400 mt-0.5">Use the workspace above to search and add items to this order.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-full text-left text-sm text-zinc-600">
                  <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500 border-b border-zinc-100">
                    <TableRow className="border-b border-zinc-100 transition-colors">
                      <TableHead className="px-4 py-3 w-10 text-center">#</TableHead>
                      <TableHead className="px-4 py-3 min-w-[200px]">Product & Variant</TableHead>
                      <TableHead className="px-4 py-3 text-center w-20">Boxes</TableHead>
                      <TableHead className="px-4 py-3 text-center w-20">Loose</TableHead>
                      <TableHead className="px-4 py-3 text-center w-24">Total Qty</TableHead>
                      <TableHead className="px-4 py-3 text-right w-28">Unit Price</TableHead>
                      <TableHead className="px-4 py-3 text-right w-32">Line Total</TableHead>
                      <TableHead className="px-4 py-3 w-20 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-zinc-100">
                    {items.map((item, idx) => {
                      const lineTotal = item.totalQty * item.unitPrice;
                      const isEditing = idx === editingIndex;
                      return (
                        <TableRow key={idx} className={`border-b border-zinc-100 transition-colors ${isEditing ? 'bg-amber-50/60 font-semibold' : 'hover:bg-zinc-50/50'}`}>
                          <TableCell className="px-4 py-3 text-center text-zinc-400 text-xs font-mono">{idx + 1}</TableCell>
                          <TableCell className="px-4 py-3">
                            <span className="font-semibold text-zinc-900 block">{item.productLabel}</span>
                            {item.priceModified && (
                              <span className="text-[10px] bg-amber-500/10 text-amber-800 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium mt-1 inline-block">
                                Custom Price
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center font-mono text-zinc-700 font-medium">
                            {item.boxQty > 0 ? item.boxQty : '—'}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center font-mono text-zinc-700 font-medium">
                            {item.looseQty > 0 ? item.looseQty : '—'}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center font-extrabold text-zinc-900 font-mono">
                            {item.totalQty}
                            {item.boxQty > 0 && item.looseQty > 0 && (
                              <span className="text-[10px] text-zinc-400 block font-normal font-mono">
                                {item.boxQty}B×{item.boxSize} + {item.looseQty}L
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right font-mono text-zinc-800 font-medium">
                            ₹{Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                            ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            <div className="flex justify-center items-center gap-1">
                              <Button
                                variant="ghost"
                                type="button"
                                size="icon"
                                onClick={() => editItem(idx)}
                                title="Edit order line"
                                className="text-zinc-400 hover:text-amber-600 hover:bg-amber-50 h-7 w-7 rounded-lg transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                type="button"
                                size="icon"
                                onClick={() => removeItem(idx)}
                                title="Remove order line"
                                className="text-zinc-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <tfoot className="border-t-2 border-zinc-200 bg-zinc-50/80">
                    <TableRow className="border-b border-zinc-100 transition-colors">
                      <TableCell colSpan={4} className="px-4 py-3 text-right font-semibold text-zinc-700 text-xs uppercase tracking-wider">
                        Total Order Units
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center font-extrabold text-zinc-900 text-base font-mono">
                        {items.reduce((acc, item) => acc + item.totalQty, 0)}
                      </TableCell>
                      <TableCell colSpan={3} className="px-4 py-3"></TableCell>
                    </TableRow>
                    <TableRow className="border-b border-zinc-100 transition-colors">
                      <TableCell colSpan={6} className="px-4 py-2.5 text-right font-semibold text-zinc-600 text-xs">
                        Net Taxable Value
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right font-mono font-bold text-zinc-900">
                        ₹{taxSummary.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="px-4 py-2.5"></TableCell>
                    </TableRow>
                    {isInterState ? (
                      <TableRow className="border-b border-zinc-100 transition-colors">
                        <TableCell colSpan={6} className="px-4 py-2.5 text-right font-semibold text-zinc-600 text-xs">
                          Inter-State IGST
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right font-mono font-medium text-zinc-800">
                          ₹{taxSummary.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="px-4 py-2.5"></TableCell>
                      </TableRow>
                    ) : (
                      <>
                        <TableRow className="border-b border-zinc-100 transition-colors">
                          <TableCell colSpan={6} className="px-4 py-2 text-right font-semibold text-zinc-600 text-xs">
                            Intra-State CGST
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right font-mono text-zinc-700">
                            ₹{taxSummary.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="px-4 py-2"></TableCell>
                        </TableRow>
                        <TableRow className="border-b border-zinc-100 transition-colors">
                          <TableCell colSpan={6} className="px-4 py-2 text-right font-semibold text-zinc-600 text-xs">
                            Intra-State SGST
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right font-mono text-zinc-700">
                            ₹{taxSummary.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="px-4 py-2"></TableCell>
                        </TableRow>
                      </>
                    )}
                    {taxSummary.roundOff !== 0 && (
                      <TableRow className="border-b border-zinc-100 transition-colors">
                        <TableCell colSpan={6} className="px-4 py-2 text-right font-semibold text-zinc-500 text-xs">
                          Round Off Adjustment
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right font-mono text-zinc-700">
                          {taxSummary.roundOff > 0 ? '+' : ''}₹{taxSummary.roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="px-4 py-2"></TableCell>
                      </TableRow>
                    )}
                    <TableRow className="border-b border-zinc-100">
                      <TableCell colSpan={6} className="px-4 py-3 text-right font-bold text-zinc-900 text-sm uppercase tracking-wider">
                        Order Grand Total
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right font-mono font-extrabold text-xl text-amber-600">
                        ₹{taxSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="px-4 py-3"></TableCell>
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="border-zinc-200 hover:bg-zinc-50 text-zinc-700"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={loading || items.length === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>Processing Order...</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {isEdit ? 'Update' : 'Create'} {type === 'sales' ? 'Sales' : 'Purchase'} Order
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      <QuickContactModal
        isOpen={showQuickContact}
        onClose={() => setShowQuickContact(false)}
        onCreated={handleContactCreated}
        defaultType={type === 'sales' ? 'customer' : 'vendor'}
        initialName={quickContactInitialName}
      />
      <QuickProductModal
        isOpen={showQuickProduct}
        onClose={() => setShowQuickProduct(false)}
        onCreated={handleProductCreated}
        initialName={quickProductInitialName}
      />
      <QuickVariantModal
        isOpen={showQuickVariant}
        onClose={() => setShowQuickVariant(false)}
        onCreated={handleVariantCreated}
        product={products.find(p => p.id === inputProduct)}
      />

      {/* Confirmation Dialog */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-100 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-amber-500/10 text-amber-700 rounded-xl shrink-0">
                <ShoppingCart className="w-6 h-6 text-amber-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-900">
                  Confirm {isEdit ? 'Update' : 'Create'} {type === 'sales' ? 'Sales' : 'Purchase'} Order
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Please review the order summary below before saving.
                </p>
              </div>
            </div>

            {/* Summary Box */}
            <div className="bg-zinc-50/80 rounded-xl p-4 border border-zinc-200/80 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-zinc-600">
                <span className="font-medium">{type === 'sales' ? 'Customer' : 'Supplier'}:</span>
                <span className="font-bold text-zinc-900 truncate max-w-[200px]">
                  {contacts.find(c => c.id === contactId)?.displayName || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-600">
                <span className="font-medium">Order Date:</span>
                <span className="font-semibold text-zinc-800">{orderDate}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-600">
                <span className="font-medium">Total Line Items:</span>
                <span className="font-semibold text-zinc-800">{items.length} item(s)</span>
              </div>
              <div className="flex justify-between items-center text-zinc-600">
                <span className="font-medium">Total Quantity:</span>
                <span className="font-semibold text-zinc-800">
                  {items.reduce((acc, curr) => acc + curr.totalQty, 0)} units
                </span>
              </div>
              <div className="pt-2 border-t border-zinc-200/80 flex justify-between items-baseline">
                <span className="font-bold text-zinc-800">Grand Total:</span>
                <span className="text-base font-extrabold text-amber-700">
                  ₹{taxSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-xl text-xs font-semibold px-4 py-2"
              >
                Review Order
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSave}
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold px-5 py-2 shadow-sm transition-all flex items-center gap-2"
              >
                {loading ? (
                  <>Saving...</>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Yes, Save Order
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
