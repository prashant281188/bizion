'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { API_ROUTES, INDIAN_STATES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatCurrency, formatVariantName, getVariantDetailOnly } from '@/lib/utils';
import { createInvoiceSchema } from '@/schemas/invoice.schema';
import { ZodError } from 'zod';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { QuickContactModal } from '@/components/contacts/QuickContactModal';
import { QuickProductModal } from '@/components/products/QuickProductModal';
import { QuickVariantModal } from '@/components/products/QuickVariantModal';
import { QuickTransporterModal } from '@/components/ui/quick-transporter-modal';
import { ImportOrderItemsModal } from '@/components/invoices/import-order-items-modal';
import { FileText, User, Calendar, Plus, Trash2, Edit, Copy, Calculator, CheckCircle2, ArrowRight, ShieldCheck, Tag, ShoppingBag, Layers, Percent, Sparkles, Building2, CheckSquare, X } from 'lucide-react';
import { toast } from 'sonner';

const DOCUMENT_TYPES = [
  { value: 'sales_invoice', label: 'Sales Invoice' },
  { value: 'purchase_invoice', label: 'Purchase Invoice' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'debit_note', label: 'Debit Note' },
];

interface InvoiceFormProps {
  invoiceId?: string;
  /** When provided, the form is pre-filled from this Purchase Order and stock will NOT be double-adjusted. */
  orderId?: string;
}

export function InvoiceForm({ invoiceId, orderId: orderIdProp }: InvoiceFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // orderId can come from prop (edit page) or URL search param (from PO detail page CTA)
  const orderId = orderIdProp || searchParams.get('orderId') || undefined;
  const grnId = searchParams.get('grnId') || undefined;
  // Track the PO-linked order ID to pass to backend (skips stock adjustment)
  const [poLinkedOrderId, setPoLinkedOrderId] = useState<string | undefined>(orderId);

  // Loaders
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Master lists
  const [contacts, setContacts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
  const [inventoryStock, setInventoryStock] = useState<any[]>([]);
  const [financialYears, setFinancialYears] = useState<any[]>([]);
  const [supplierStateCode, setSupplierStateCode] = useState('27'); // default MH

  // Customer sub-records
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([]);

  const queryType = searchParams.get('type') as any;
  const initialType = ['sales_invoice', 'purchase_invoice', 'credit_note', 'debit_note'].includes(queryType) ? queryType : 'sales_invoice';
  const [documentType, setDocumentType] = useState<'sales_invoice' | 'purchase_invoice' | 'credit_note' | 'debit_note'>(initialType);
  const [invoicePrefix, setInvoicePrefix] = useState('');
  const [invoiceSequence, setInvoiceSequence] = useState('');
  const invoiceNumber = invoicePrefix + invoiceSequence;
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [contactId, setContactId] = useState('');
  const [billingAddressId, setBillingAddressId] = useState('');
  const [shippingAddressId, setShippingAddressId] = useState('');
  const [supplyType, setSupplyType] = useState('b2b');
  const [placeOfSupplyCode, setPlaceOfSupplyCode] = useState('27');
  const [reverseCharge, setReverseCharge] = useState(false);
  const [paymentTermId, setPaymentTermId] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [roundOff, setRoundOff] = useState('0');
  const [status, setStatus] = useState('approved');
  const [lastInvoiceDate, setLastInvoiceDate] = useState<string | null>(null);

  // Transporter state
  const [transporters, setTransporters] = useState<any[]>([]);
  const [transporterId, setTransporterId] = useState('');
  const [showQuickTransporter, setShowQuickTransporter] = useState(false);

  // Pending sales orders for the selected customer
  const [pendingSalesOrders, setPendingSalesOrders] = useState<any[]>([]);
  const [loadingPendingOrders, setLoadingPendingOrders] = useState(false);
  const [selectedOrderIdToImport, setSelectedOrderIdToImport] = useState<string | null>(null);

  // Quick contact modal states
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [quickContactInitialName, setQuickContactInitialName] = useState('');
  const [showQuickProduct, setShowQuickProduct] = useState(false);
  const [quickProductInitialName, setQuickProductInitialName] = useState('');
  const [showQuickVariant, setShowQuickVariant] = useState(false);
  const [customPrices, setCustomPrices] = useState<any[]>([]);

  // Custom Fields (dynamic metadata configured in settings)
  const [customFieldDefs, setCustomFieldDefs] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<Record<string, any>>({});

  // Fixed input bar state
  const [inputProduct, setInputProduct] = useState('');
  const [inputBoxQty, setInputBoxQty] = useState<number>(0);
  const [inputLooseQty, setInputLooseQty] = useState<number>(0);

  const checkSequenceBounds = async (dateStr: string, numStr: string) => {
    if (!dateStr || !numStr || documentType !== 'sales_invoice') return;
    try {
      const res = await api.get(`/invoices/sequence-bounds?type=sales_invoice&invoiceNumber=${encodeURIComponent(numStr)}`);
      const { prev, next } = res.data.data;
      if (prev?.invoiceDate && new Date(dateStr) < new Date(prev.invoiceDate)) {
        toast.error(`Date cannot be earlier than previous invoice (${prev.invoiceNumber} dated ${prev.invoiceDate})`);
      }
      if (next?.invoiceDate && new Date(dateStr) > new Date(next.invoiceDate)) {
        toast.error(`Date cannot be later than next invoice (${next.invoiceNumber} dated ${next.invoiceDate})`);
      }
    } catch (e) {
      console.error('Sequence check failed', e);
    }
  };

  const updatePrefixForDate = async (newDate: string) => {
    if (!newDate) return null;
    try {
      const numRes = await api.get(`/invoices/next-number?type=${documentType}&date=${newDate}`);
      const fullNum = numRes.data.data.invoiceNumber || '';
      const lastSlash = fullNum.lastIndexOf('/');
      if (lastSlash !== -1) {
        const newPrefix = fullNum.substring(0, lastSlash + 1);
        setInvoicePrefix(newPrefix);
        return newPrefix;
      }
      return null;
    } catch(e) {
      console.error('Failed to update prefix', e);
      return null;
    }
  };
  const [inputPrice, setInputPrice] = useState<number>(0);
  const [inputDescription, setInputDescription] = useState('');
  const [inputHsnCode, setInputHsnCode] = useState('');
  const [inputTaxRateId, setInputTaxRateId] = useState('');
  const [inputDiscountType, setInputDiscountType] = useState('percentage');
  const [inputDiscountValue, setInputDiscountValue] = useState<number>(0);
  
  const boxQtyRef = useRef<HTMLInputElement>(null);

  // Line items state array
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const getBoxQuantity = (productId: string, variantId: string | null): number => {
    const product = products.find((p) => p.id === productId);
    if (!product) return 1;
    if (variantId) {
      const variant = product.variants?.find((v: any) => v.id === variantId);
      if (variant?.boxQuantity) return variant.boxQuantity;
    }
    return product.boxQuantity || 1;
  };

  const resolveUnitPrice = (prodId: string, varId: string | null) => {
    const rule = customPrices.find(
      (cp) =>
        cp.productId === prodId &&
        (varId ? cp.variantId === varId : !cp.variantId)
    );

    if (rule) {
      return Number(rule.customPrice);
    }

    const prod = products.find((p) => p.id === prodId);
    if (!prod) return 0;

    const isPurchase = documentType === 'purchase_invoice';

    if (varId) {
      const variant = prod.variants?.find((v: any) => v.id === varId);
      if (variant) {
        return Number(isPurchase ? variant.valuationCost : variant.sellingPrice);
      }
    }

    return Number(isPurchase ? prod.valuationCost : prod.sellingPrice);
  };

  const getAvailableStock = useCallback((prodId: string, varId?: string) => {
    const records = inventoryStock.filter(
      (s) => s.productId === prodId && (varId ? s.variantId === varId : !s.variantId)
    );
    return records.reduce((sum, r) => sum + (r.quantityOnHand - (r.quantityReserved || 0)), 0);
  }, [inventoryStock]);

  const productOptions = useMemo(() => {
    const options: any[] = [];

    const isPurchase = documentType === 'purchase_invoice';

    products.forEach((p) => {
      if (p.hasVariants && p.variants?.length > 0) {
        p.variants.forEach((v: any) => {
          const stock = getAvailableStock(p.id, v.id);
          const generalPrice = Number(isPurchase ? v.valuationCost : v.sellingPrice || p.sellingPrice || 0);
          
          const rule = customPrices.find(
            (cp) => cp.productId === p.id && cp.variantId === v.id
          );

          const priceLabel = rule
            ? `Contract: ${rule.customPrice} INR (Catalog: ${generalPrice} INR)`
            : `Price: ${generalPrice} INR`;

          const formattedLabel = formatVariantName(p.name, v.name, v.sku);
          const varDetail = getVariantDetailOnly(p.name, v.name) || v.sku || 'Variant';

          options.push({
            value: `${p.id}:${v.id}`,
            label: formattedLabel,
            sublabel: `Variant: ${varDetail} ${v.sku ? `• SKU: ${v.sku}` : ''}`,
            sku: v.sku || undefined,
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
        const generalPrice = Number(isPurchase ? p.valuationCost : p.sellingPrice || 0);

        const rule = customPrices.find(
          (cp) => cp.productId === p.id && !cp.variantId
        );

        const priceLabel = rule
          ? `Contract: ${rule.customPrice} INR (Catalog: ${generalPrice} INR)`
          : `Price: ${generalPrice} INR`;

        options.push({
          value: `${p.id}:`,
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
  }, [products, inventoryStock, documentType, customPrices]);

  // Load layout data
  const loadFormData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const [
        orgRes, contactsRes, productsRes, trRes, ptRes, stockRes, trpRes
      ] = await Promise.all([
        api.get(API_ROUTES.ORGANIZATION.ME),
        api.get('/contacts?limit=1000'),
        api.get('/products?limit=1000'),
        api.get('/masters/tax-rates?limit=1000'),
        api.get('/masters/payment-terms?limit=1000'),
        api.get('/inventory/stock?limit=1000'),
        api.get('/transporters?limit=1000').catch(() => ({ data: { data: [] } })),
      ]);

      setSupplierStateCode(orgRes.data.data.stateCode || '27');
      setContacts(contactsRes.data.data || []);
      setProducts(productsRes.data.data || []);
      setTaxRates(trRes.data.data || []);
      setPaymentTerms(ptRes.data.data || []);
      setInventoryStock(stockRes.data.data || []);
      setTransporters(trpRes.data.data || []);
      setFinancialYears(orgRes.data.data.settings?.financialYears || []);
      const orgCustomFields = orgRes.data.data.settings?.invoiceCustomFields || [];
      setCustomFieldDefs(orgCustomFields);

      if (invoiceId) {
        // Load existing invoice
        const invRes = await api.get(`${API_ROUTES.INVOICES.BASE}/${invoiceId}`);
        const inv = invRes.data.data;

        setDocumentType(inv.documentType);
        const fullNum = inv.invoiceNumber || '';
        const lastSlash = fullNum.lastIndexOf('/');
        if (lastSlash !== -1) {
          setInvoicePrefix(fullNum.substring(0, lastSlash + 1));
          setInvoiceSequence(fullNum.substring(lastSlash + 1));
        } else {
          setInvoicePrefix('');
          setInvoiceSequence(fullNum);
        }
        setInvoiceDate(inv.invoiceDate);
        setDueDate(inv.dueDate || '');
        setContactId(inv.contactId);
        setBillingAddressId(inv.billingAddressId || '');
        setShippingAddressId(inv.shippingAddressId || '');
        setSupplyType(inv.supplyType || 'b2b');
        setPlaceOfSupplyCode(inv.placeOfSupplyCode || '27');
        setReverseCharge(inv.reverseCharge || false);
        setPaymentTermId(inv.paymentTermId || '');
        setTransporterId(inv.transporterId || '');
        setCustomFields(inv.customFields || {});
        setNotes(inv.notes || '');
        setTermsAndConditions(inv.termsAndConditions || '');
        setCustomerNotes(inv.customerNotes || '');
        setRoundOff(inv.roundOff || '0');
        setStatus(inv.status || 'draft');
        
        // Load line items
        setLineItems(inv.lineItems.map((line: any) => ({
          productId: line.productId || '',
          variantId: line.variantId || '',
          description: line.description,
          hsnCode: line.hsnCode || '',
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          discountType: line.discountType || 'percentage',
          discountValue: Number(line.discountValue || 0),
          taxRateId: line.taxRateId || '',
        })));

        // Load contact address sub-list
        const matchedContact = contactsRes.data.data.find((c: any) => c.id === inv.contactId);
        if (matchedContact) {
          setCustomerAddresses(matchedContact.addresses || []);
        }
      } else {
        // Load next number sequence
        const numRes = await api.get(`/invoices/next-number?type=${documentType}&date=${invoiceDate}`);
        const fullNum = numRes.data.data.invoiceNumber || '';
        const lastSlash = fullNum.lastIndexOf('/');
        if (lastSlash !== -1) {
          setInvoicePrefix(fullNum.substring(0, lastSlash + 1));
          setInvoiceSequence(fullNum.substring(lastSlash + 1));
        } else {
          setInvoicePrefix('');
          setInvoiceSequence(fullNum);
        }

        // Set default terms & notes from organization settings
        const orgSettings = orgRes.data.data.settings;
        if (orgSettings) {
          setTermsAndConditions(orgSettings.invoiceTerms || '');
          setCustomerNotes(orgSettings.invoiceNotes || '');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to initialize invoice form data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFormData();
  }, [invoiceId]);

  // When grnId or orderId is provided (from PO/GRN → Create Invoice flow), pre-fill from source
  useEffect(() => {
    if ((!orderId && !grnId) || invoiceId) return; // skip if editing existing invoice
    const prefillFromSource = async () => {
      try {
        let po: any = null;
        let grnItems: any[] | null = null;

        if (grnId) {
          const res = await api.get('/goods-receipts/' + grnId);
          const grn = res.data.data;

          if (grn.invoiceId) {
            toast.error('An invoice has already been created for this goods receipt');
            router.push('/dashboard/invoices');
            return;
          }

          po = grn.order;
          if (!po || po.type !== 'purchase') return;
          grnItems = grn.items;
        } else if (orderId) {
          const res = await api.get('/orders/' + orderId);
          po = res.data.data;
          if (!po || po.type !== 'purchase') return;
        }

        // Switch to purchase invoice
        setDocumentType('purchase_invoice');
        setPoLinkedOrderId(po.id);

        // Pre-fill supplier
        if (po.contactId) {
          setContactId(po.contactId);
          const matchedContact = contacts.find((c: any) => c.id === po.contactId);
          if (matchedContact) {
            setCustomerAddresses(matchedContact.addresses || []);
            const defaultBill = matchedContact.addresses?.find((a: any) => a.isBillingDefault) || matchedContact.addresses?.[0];
            if (defaultBill) {
              setPlaceOfSupplyCode(defaultBill.stateCode);
              setBillingAddressId(defaultBill.id);
            }
          }
        }

        // Pre-fill line items
        const sourceItems = grnItems || po.items;
        if (sourceItems?.length > 0) {
          const prefilled = sourceItems.map((item: any) => {
            const prod = products.find((p: any) => p.id === item.productId);
            const varObj = prod?.variants?.find((v: any) => v.id === item.variantId);
            const desc = varObj
              ? formatVariantName(prod?.name || '', varObj.name, varObj.sku)
              : (prod?.name || item.product?.name || 'Item');
            
            const quantity = grnItems ? item.receivedQty : (item.baseQuantity ?? item.orderQuantity);
            
            return {
              productId: item.productId,
              variantId: item.variantId || '',
              description: desc,
              hsnCode: prod?.hsnCode || '',
              quantity: quantity,
              unitPrice: Number(item.unitPrice),
              discountType: 'percentage',
              discountValue: 0,
              taxRateId: item.taxRateId || prod?.taxRateId || '',
            };
          });
          setLineItems(prefilled);
        }
      } catch (err) {
        console.error('Failed to prefill from source:', err);
      }
    };

    // Wait for master data to be loaded before prefilling
    if (!loading) {
      prefillFromSource();
    }
  }, [orderId, grnId, loading, invoiceId, contacts, products]);

  // Load custom pricing for selected contact
  useEffect(() => {
    if (contactId) {
      api.get(`/contacts/${contactId}/prices?limit=1000`)
        .then(res => {
          setCustomPrices(res.data.data || []);
        })
        .catch(err => {
          console.error('Failed to fetch custom pricing for contact:', err);
          setCustomPrices([]);
        });
    } else {
      setCustomPrices([]);
    }
  }, [contactId]);

  // Fetch pending sales orders for selected customer
  useEffect(() => {
    if (!contactId || documentType !== 'sales_invoice' || invoiceId) {
      setPendingSalesOrders([]);
      return;
    }

    let isMounted = true;
    setLoadingPendingOrders(true);
    api.get(`/orders?type=sales&contactId=${contactId}&status=draft,confirmed,processing,partially_dispatched&limit=10`)
      .then((res) => {
        if (isMounted) {
          setPendingSalesOrders(res.data?.data || []);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch pending orders for contact:', err);
        if (isMounted) setPendingSalesOrders([]);
      })
      .finally(() => {
        if (isMounted) setLoadingPendingOrders(false);
      });

    return () => {
      isMounted = false;
    };
  }, [contactId, documentType, invoiceId]);

  const handleImportSalesOrder = async (soId: string) => {
    try {
      const res = await api.get(`/orders/${soId}`);
      const so = res.data?.data;
      if (!so) return;

      const newItems = (so.items || []).map((item: any) => {
        const prod = products.find((p: any) => p.id === item.productId) || item.product;
        const varObj = prod?.variants?.find((v: any) => v.id === item.variantId) || item.variant;
        const desc = varObj
          ? formatVariantName(prod?.name || '', varObj.name, varObj.sku)
          : (prod?.name || item.product?.name || 'Item');
        const quantity = Number(item.baseQuantity ?? item.orderQuantity ?? 1);

        return {
          productId: item.productId,
          variantId: item.variantId || '',
          description: desc,
          hsnCode: prod?.hsnCode || item.hsnCode || '',
          quantity: quantity,
          unitPrice: Number(item.unitPrice),
          discountType: 'percentage',
          discountValue: 0,
          taxRateId: item.taxRateId || prod?.taxRateId || '',
        };
      });

      if (newItems.length === 0) {
        toast.info('No line items found in this sales order.');
        return;
      }

      setPoLinkedOrderId(so.id);
      setLineItems((prev) => {
        if (prev.length === 0) return newItems;
        return [...prev, ...newItems];
      });

      toast.success(`Quick added ${newItems.length} item(s) from Sales Order ${so.orderNumber}`);
    } catch (err) {
      console.error('Failed to import sales order items', err);
      toast.error('Failed to import items from sales order');
    }
  };

  // If document type shifts, generate next invoice serial on new invoices
  useEffect(() => {
    if (invoiceId) return;
    const fetchNextSeq = async () => {
      try {
        const numRes = await api.get(`/invoices/next-number?type=${documentType}&date=${invoiceDate}`);
        const fullNum = numRes.data.data.invoiceNumber || '';
        const lastSlash = fullNum.lastIndexOf('/');
        if (lastSlash !== -1) {
          setInvoicePrefix(fullNum.substring(0, lastSlash + 1));
          setInvoiceSequence(fullNum.substring(lastSlash + 1));
        } else {
          setInvoicePrefix('');
          setInvoiceSequence(fullNum);
        }
      } catch (e) {
        console.error('Failed to generate next number for docType', e);
      }
    };
    fetchNextSeq();
  }, [documentType]);

  // Auto-compute due date when payment term or invoice date changes
  useEffect(() => {
    if (!invoiceDate) return;
    const baseDate = new Date(invoiceDate);
    if (isNaN(baseDate.getTime())) return;

    if (!paymentTermId) {
      // "Due on Receipt" — due date equals invoice date
      setDueDate(invoiceDate);
      return;
    }

    const selectedTerm = paymentTerms.find((pt: any) => pt.id === paymentTermId);
    if (selectedTerm && selectedTerm.dueDays != null) {
      const due = new Date(baseDate);
      due.setDate(due.getDate() + Number(selectedTerm.dueDays));
      setDueDate(due.toISOString().split('T')[0]);
    }
  }, [paymentTermId, invoiceDate, paymentTerms]);

  const handleContactCreated = (newContact: any) => {
    setContacts((prev) => [newContact, ...prev]);
    setContactId(newContact.id);
    setCustomerAddresses(newContact.addresses || []);

    const defaultBill = newContact.addresses?.find((a: any) => a.isBillingDefault) || newContact.addresses?.[0];
    if (defaultBill) {
      setPlaceOfSupplyCode(defaultBill.stateCode);
      setBillingAddressId(defaultBill.id);
    }
    
    const defaultShip = newContact.addresses?.find((a: any) => a.isShippingDefault) || newContact.addresses?.[0];
    if (defaultShip) {
      setShippingAddressId(defaultShip.id);
    }
  };

  const handleProductCreated = (newProduct: any) => {
    setProducts(prev => [...prev, newProduct]);
    setInputProduct(`${newProduct.id}:`);
  };

  const handleVariantCreated = (updatedProduct: any) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    const newVariant = updatedProduct.variants[updatedProduct.variants.length - 1];
    setInputProduct(`${updatedProduct.id}:${newVariant.id}`);
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    setContactId(cid);
    setBillingAddressId('');
    setShippingAddressId('');
    setTransporterId('');

    const matched = contacts.find((c) => c.id === cid);
    if (matched) {
      setCustomerAddresses(matched.addresses || []);
      
      // Auto-set place of supply based on default billing address or first address
      const defaultBill = matched.addresses?.find((a: any) => a.isBillingDefault) || matched.addresses?.[0];
      if (defaultBill) {
        setPlaceOfSupplyCode(defaultBill.stateCode);
        setBillingAddressId(defaultBill.id);
      }
      
      const defaultShip = matched.addresses?.find((a: any) => a.isShippingDefault) || matched.addresses?.[0];
      if (defaultShip) {
        setShippingAddressId(defaultShip.id);
      }

      // Auto-set default payment term
      if (matched.paymentTermId) {
        const ptExists = paymentTerms.some((pt: any) => pt.id === matched.paymentTermId);
        if (ptExists) {
          setPaymentTermId(matched.paymentTermId);
        } else {
          setPaymentTermId('');
        }
      }

      // Auto-set saved transporter if saved on contact profile
      const savedVal = matched.preferredTransporterId || matched.transporterId || matched.preferredTransporter;
      if (savedVal) {
        const found = transporters.find((t: any) =>
          t.id === savedVal ||
          t.name.toLowerCase() === savedVal.toLowerCase() ||
          (t.code && t.code.toLowerCase() === savedVal.toLowerCase())
        );
        if (found) {
          setTransporterId(found.id);
        }
      }
    } else {
      setCustomerAddresses([]);
    }
  };

  const handleInputProductChange = (compoundValue: string) => {
    setInputProduct(compoundValue);
    setEditingIndex(null);
    if (!compoundValue || compoundValue === 'custom') {
      setInputPrice(0);
      setInputBoxQty(0);
      setInputLooseQty(0);
      setInputDescription('');
      setInputHsnCode('');
      setInputTaxRateId('');
      return;
    }
    const [prodId, varId] = compoundValue.split(':');
    const price = resolveUnitPrice(prodId, varId || null);
    setInputPrice(price);
    setInputBoxQty(0);
    setInputLooseQty(0);

    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setInputHsnCode(prod.hsnCode || '');
      setInputTaxRateId(prod.taxRateId || '');
      if (varId) {
        const variant = prod.variants?.find((v: any) => v.id === varId);
        setInputDescription(variant ? (variant.name || variant.sku) : prod.name);
      } else {
        setInputDescription(prod.name);
      }
    }

    setTimeout(() => boxQtyRef.current?.focus(), 50);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleAddItem = () => {
    if (!inputProduct && !inputDescription) {
      setErrorMsg('Please select a product or enter a description.');
      return;
    }
    const isCustom = inputProduct === 'custom' || !inputProduct;
    const prodId = isCustom ? '' : inputProduct.split(':')[0];
    const varId = isCustom ? '' : (inputProduct.split(':')[1] || '');
    const boxSize = isCustom ? 1 : getBoxQuantity(prodId, varId || null);
    const totalQty = (inputBoxQty * boxSize) + inputLooseQty;

    if (totalQty <= 0) {
      setErrorMsg('Quantity must be greater than 0.');
      return;
    }

    const newItem = {
      productId: prodId || null,
      variantId: varId || null,
      description: inputDescription,
      hsnCode: inputHsnCode,
      quantity: totalQty,
      unitPrice: inputPrice,
      discountType: inputDiscountType,
      discountValue: inputDiscountValue,
      taxRateId: inputTaxRateId || null,
      boxQty: inputBoxQty,
      looseQty: inputLooseQty,
      boxSize: boxSize,
      priceModified: !isCustom ? (inputPrice !== resolveUnitPrice(prodId, varId || null)) : false,
    };

    if (documentType === 'sales_invoice' && !isCustom) {
      const stock = getAvailableStock(prodId, varId || undefined);
      if (totalQty > stock) {
        toast.warning(`Insufficient stock. You are selling ${totalQty} units but only ${stock} are available.`);
      }
    }

    commitItem(newItem);
  };

  const commitItem = (item: any) => {
    if (editingIndex !== null) {
      setLineItems((prev) => {
        const updated = [...prev];
        updated[editingIndex] = item;
        return updated;
      });
      setEditingIndex(null);
    } else {
      setLineItems((prev) => [...prev, item]);
    }

    setInputProduct('');
    setInputBoxQty(0);
    setInputLooseQty(0);
    setInputPrice(0);
    setInputDescription('');
    setInputHsnCode('');
    setInputTaxRateId('');
    setInputDiscountType('percentage');
    setInputDiscountValue(0);

    setTimeout(() => {
      document.getElementById('invoice-product-search')?.focus();
    }, 50);
  };

  const handleRemoveLine = (index: number) => {
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleEditLine = (index: number) => {
    const item = lineItems[index];
    setEditingIndex(index);

    if (item.productId && !item.variantId) {
      setInputProduct(item.productId);
    } else if (item.productId && item.variantId) {
      setInputProduct(`${item.productId}:${item.variantId}`);
    } else {
      setInputProduct(`custom:${item.description}`);
    }

    setInputBoxQty(item.boxQty || 0);
    setInputLooseQty(item.looseQty || 0);
    setInputPrice(item.unitPrice || 0);
    setInputDescription(item.description || '');
    setInputHsnCode(item.hsnCode || '');
    setInputTaxRateId(item.taxRateId || '');
    setInputDiscountType(item.discountType || 'percentage');
    setInputDiscountValue(item.discountValue || 0);

    setTimeout(() => {
      boxQtyRef.current?.focus();
    }, 50);
  };

  // Inline GST calculations for previews
  const totals = useMemo(() => {
    let subtotal = 0;
    let discountAmount = 0;
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    const cessAmount = 0;
    let totalTaxAmount = 0;

    const isInterState = supplierStateCode !== placeOfSupplyCode;

    lineItems.forEach((line) => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unitPrice) || 0;
      const disc = Number(line.discountValue) || 0;
      const taxRateObj = taxRates.find((t) => t.id === line.taxRateId);
      const taxRate = taxRateObj ? Number(taxRateObj.ratePercentage) : 0;

      const lineTotal = qty * price;
      let lineDiscount = 0;
      if (line.discountType === 'percentage') {
        lineDiscount = (lineTotal * disc) / 100;
      } else {
        lineDiscount = disc;
      }

      const taxable = Math.max(0, lineTotal - lineDiscount);
      let cgst = 0, sgst = 0, igst = 0;

      if (isInterState) {
        igst = (taxable * taxRate) / 100;
      } else {
        cgst = (taxable * (taxRate / 2)) / 100;
        sgst = (taxable * (taxRate / 2)) / 100;
      }

      subtotal += lineTotal;
      discountAmount += lineDiscount;
      taxableAmount += taxable;
      cgstAmount += cgst;
      sgstAmount += sgst;
      igstAmount += igst;
      totalTaxAmount += cgst + sgst + igst;
    });

    const unroundedGrandTotal = taxableAmount + totalTaxAmount;
    const grandTotal = Math.round(unroundedGrandTotal);
    const calculatedRoundOff = Number((grandTotal - unroundedGrandTotal).toFixed(2));

    return {
      subtotal,
      discountAmount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      cessAmount,
      totalTaxAmount,
      calculatedRoundOff,
      grandTotal,
      isInterState,
    };
  }, [lineItems, placeOfSupplyCode, supplierStateCode]);

  const hsnSummary = useMemo(() => {
    const summary: Record<string, { taxableValue: number; taxAmount: number; rate: number; totalAmount: number; quantity: number }> = {};

    lineItems.forEach((line) => {
      const hsn = line.hsnCode || 'Unspecified';
      const lineTotal = line.quantity * line.unitPrice;
      const lineDiscount = line.discountType === 'percentage' ? (lineTotal * line.discountValue) / 100 : line.discountValue;
      const taxable = Math.max(0, lineTotal - lineDiscount);
      const taxRateObj = taxRates.find((t) => t.id === line.taxRateId);
      const rate = taxRateObj ? Number(taxRateObj.ratePercentage) : 0;
      const taxAmount = (taxable * rate) / 100;
      const key = `${hsn}_${rate}`;

      if (!summary[key]) {
        summary[key] = { taxableValue: 0, taxAmount: 0, rate, totalAmount: 0, quantity: 0 };
      }
      summary[key].taxableValue += taxable;
      summary[key].taxAmount += taxAmount;
      summary[key].totalAmount += (taxable + taxAmount);
      summary[key].quantity += line.quantity;
    });

    return Object.entries(summary).map(([key, data]) => ({
      hsnCode: key.split('_')[0],
      ...data
    })).sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));
  }, [lineItems, taxRates]);

  // Keep roundOff state in sync with computed values for form submit payload
  useEffect(() => {
    const calculated = totals.calculatedRoundOff.toString();
    if (roundOff !== calculated) {
      setRoundOff(calculated);
    }
  }, [totals.calculatedRoundOff, roundOff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setErrorMsg(null);
    setSaving(true);

    const payload: any = {
      documentType,
      invoiceNumber,
      invoiceDate,
      dueDate: dueDate || null,
      contactId,
      billingAddressId: billingAddressId || null,
      shippingAddressId: shippingAddressId || null,
      supplyType,
      placeOfSupplyCode,
      reverseCharge,
      paymentTermId: paymentTermId || null,
      transporterId: transporterId || null,
      customFields: Object.keys(customFields).length > 0 ? customFields : null,
      notes: notes || null,
      termsAndConditions: termsAndConditions || null,
      customerNotes: customerNotes || null,
      roundOff: Number(roundOff) || 0,
      status,
      lineItems: lineItems.map((line) => ({
        productId: line.productId || null,
        variantId: line.variantId || null,
        description: line.description,
        hsnCode: line.hsnCode || null,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        discountType: line.discountType,
        discountValue: Number(line.discountValue || 0),
        taxRateId: line.taxRateId || null,
      })),
    };

    // Pass orderId when invoice is linked to a PO (backend will skip double stock adjustment)
    if (poLinkedOrderId) {
      payload.orderId = poLinkedOrderId;
    }

    try {
      // Validate schema client-side
      createInvoiceSchema.parse(payload);

      if (invoiceId) {
        await api.put(`${API_ROUTES.INVOICES.BASE}/${invoiceId}`, payload);
      } else {
        await api.post(API_ROUTES.INVOICES.BASE, payload);
      }

      router.push('/dashboard/invoices');
    } catch (err: any) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {};
        err.issues.forEach((issue) => {
          const path = issue.path.join('.');
          errors[path] = issue.message;
        });
        setFormErrors(errors);
        setErrorMsg('Please resolve validation errors in the form.');
      } else {
        setErrorMsg(err.response?.data?.message || 'Failed to save invoice record');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
    <div className="space-y-6">
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-zinc-200 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {invoiceId ? 'Edit Invoice Profile' : poLinkedOrderId ? 'Create Purchase Invoice' : 'Generate Invoice'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {poLinkedOrderId
              ? 'Pre-filled from Purchase Order. Review items and amounts before saving.'
              : 'Form to configure customer supply details, product line rates, and tax parameters.'}
          </p>
        </div>
      </div>

      {/* PO-linked banner */}
      {poLinkedOrderId && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <span className="text-amber-600 text-lg leading-none mt-0.5">✓</span>
          <div>
            <p className="font-medium text-amber-800">Linked to Purchase Order</p>
            <p className="text-amber-700 mt-0.5">
              Stock has already been updated via Goods Receipts — this invoice is for financial/accounting records only.
              No duplicate stock adjustment will be made.
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center space-x-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          <span>{errorMsg}</span>
        </div>

      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Header & Party Info Card */}
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-5 space-y-5 overflow-visible">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-700 rounded-xl">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  {documentType === 'sales_invoice' ? 'Sales Invoice' : documentType === 'purchase_invoice' ? 'Purchase Invoice' : documentType === 'credit_note' ? 'Credit Note' : 'Debit Note'}
                  <Badge variant="outline" className="text-[11px] font-semibold bg-amber-500/10 text-amber-800 border-amber-500/20 capitalize">
                    {status}
                  </Badge>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Fill document metadata, select customer/supplier, and add line items.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {financialYears.filter(fy => fy.isActive !== false).length > 0 && (
                <Select
                  label=""
                  name="financialYear"
                  value={financialYears.find(fy => (fy.prefixes?.[documentType] || fy.prefix) === invoicePrefix)?.label || ''}
                  onChange={(e: any) => {
                    const selectedLabel = e.target.value;
                    const selectedFy = financialYears.find(fy => fy.label === selectedLabel);
                    if (selectedFy) {
                      const newPrefix = selectedFy.prefixes?.[documentType] || selectedFy.prefix || '';
                      setInvoicePrefix(newPrefix);
                      api.get(`/invoices/next-number?type=${documentType}&prefix=${encodeURIComponent(newPrefix)}`)
                        .then((res) => {
                          const fullNum = res.data.data.invoiceNumber || '';
                          if (fullNum.startsWith(newPrefix)) {
                            setInvoiceSequence(fullNum.substring(newPrefix.length));
                          }
                        }).catch(console.error);
                    }
                  }}
                  options={financialYears.filter(fy => fy.isActive !== false).map(fy => ({
                    label: `FY: ${fy.label}`,
                    value: fy.label
                  }))}
                  disabled={!!invoiceId}
                  className="h-9 text-xs bg-zinc-50"
                />
              )}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-12 items-start">
            {/* Party Picker */}
            <div className="md:col-span-4 space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  {documentType === 'purchase_invoice' ? 'Supplier / Vendor *' : 'Customer / Party *'}
                </label>
              </div>
              <SearchableSelect
                placeholder="Choose party..."
                value={contactId}
                onChange={(val) => handleContactChange({ target: { value: val } } as any)}
                required
                disabled={!!invoiceId}
                error={formErrors.contactId}
                createNewText="Contact"
                onCreateNew={!invoiceId ? (term) => {
                  setQuickContactInitialName(term);
                  setShowQuickContact(true);
                } : undefined}
                options={contacts.map((c) => {
                  const isDeactivated = c.isActive === false;
                  return {
                    value: c.id,
                    label: `${c.displayName} ${c.companyName ? `(${c.companyName})` : ''}${isDeactivated ? ' [DEACTIVATED]' : ''}`,
                    sublabel: isDeactivated ? '⚠️ DEACTIVATED' : undefined,
                    rightElement: isDeactivated ? (
                      <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200 uppercase">
                        Deactivated
                      </span>
                    ) : undefined,
                  };
                })}
              />

              {/* Selected Contact Details Preview */}
              {(() => {
                const activeContact = contacts.find(c => c.id === contactId);
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

              {/* Pending Sales Orders Notification & Selection Widget */}
              {pendingSalesOrders.length > 0 && !invoiceId && (
                <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl space-y-2.5 mt-2 text-xs shadow-xs animate-in fade-in">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                      <ShoppingBag className="w-4 h-4 text-amber-600 shrink-0" />
                      Pending Sales Order{pendingSalesOrders.length > 1 ? 's' : ''} ({pendingSalesOrders.length})
                    </span>
                    {poLinkedOrderId && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-300">
                          Linked: {pendingSalesOrders.find((o) => o.id === poLinkedOrderId)?.orderNumber || 'SO'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPoLinkedOrderId(undefined)}
                          title="Unlink Order"
                          className="text-zinc-400 hover:text-red-600 p-0.5 rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-800/90 leading-tight">
                    This customer has pending orders. You can select specific products or quick add all:
                  </p>
                  <div className="space-y-2 max-h-56 overflow-y-auto pt-0.5">
                    {pendingSalesOrders.map((so: any) => {
                      const isLinked = poLinkedOrderId === so.id;
                      return (
                        <div
                          key={so.id}
                          className={`p-2.5 rounded-xl border transition-all space-y-2 ${
                            isLinked ? 'bg-emerald-50/80 border-emerald-300 shadow-xs' : 'bg-white border-amber-200/90 shadow-2xs hover:border-amber-400'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-xs text-zinc-900">{so.orderNumber}</span>
                            <Badge
                              variant="outline"
                              className="capitalize text-[10px] px-2 py-0.5 bg-zinc-100/80 text-zinc-700 font-medium border-zinc-200"
                            >
                              {so.status}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between text-[11px] text-zinc-500">
                            <span>{new Date(so.orderDate).toLocaleDateString()}</span>
                            <span className="font-mono font-bold text-zinc-900">
                              ₹{Number(so.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-100">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setSelectedOrderIdToImport(so.id)}
                              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold flex-1 rounded-lg shadow-2xs"
                            >
                              <CheckSquare className="w-3.5 h-3.5 mr-1" />
                              Select Products
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleImportSalesOrder(so.id)}
                              disabled={isLinked}
                              className={`h-7 px-2.5 text-xs font-semibold rounded-lg ${
                                isLinked
                                  ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                  : 'border-amber-300 text-amber-900 hover:bg-amber-100/60'
                              }`}
                            >
                              {isLinked ? 'Added' : 'Add All'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Document Number & Dates */}
            <div className="md:col-span-8 grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Invoice Number *</label>
                <div className="flex rounded-lg border border-zinc-200 overflow-hidden focus-within:border-amber-500 transition-colors">
                  <input
                    type="text"
                    value={invoicePrefix}
                    onChange={(e) => {
                      setInvoicePrefix(e.target.value);
                      checkSequenceBounds(invoiceDate, e.target.value + invoiceSequence);
                    }}
                    className="w-1/2 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-600 font-mono focus:outline-none border-r border-zinc-200"
                    placeholder="PREFIX/"
                  />
                  <input
                    type="text"
                    value={invoiceSequence}
                    onChange={(e) => {
                      setInvoiceSequence(e.target.value);
                      checkSequenceBounds(invoiceDate, invoicePrefix + e.target.value);
                    }}
                    className="w-1/2 bg-white px-2.5 py-2 text-xs text-zinc-900 font-mono font-semibold focus:outline-none"
                    placeholder="1"
                    required
                  />
                </div>
              </div>

              <Input
                label="Invoice Date *"
                name="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setInvoiceDate(val);
                  checkSequenceBounds(val, invoicePrefix + invoiceSequence);
                }}
                required
                className="h-[38px] text-xs"
              />

              <Input
                label="Due Date"
                name="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-[38px] text-xs"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4 border-t border-zinc-100 pt-4">
            <Select
              label="Place of Supply UT *"
              value={placeOfSupplyCode}
              onChange={(e) => setPlaceOfSupplyCode(e.target.value)}
              required
              options={INDIAN_STATES.map((s) => ({ value: s.code, label: `${s.code} - ${s.name}` }))}
              className="h-[38px] text-xs"
            />

            <Select
              label="Billing Address"
              name="billingAddressId"
              value={billingAddressId}
              onChange={(e) => setBillingAddressId(e.target.value)}
              options={[
                { value: '', label: 'Select registered billing address...' },
                ...customerAddresses.map((a) => ({ value: a.id, label: `${a.label}: ${a.addressLine1}, ${a.city}` })),
              ]}
              className="h-[38px] text-xs"
            />

            <Select
              label="Shipping Address"
              name="shippingAddressId"
              value={shippingAddressId}
              onChange={(e) => setShippingAddressId(e.target.value)}
              options={[
                { value: '', label: 'Same as Billing Address' },
                ...customerAddresses.map((a) => ({ value: a.id, label: `${a.label}: ${a.addressLine1}, ${a.city}` })),
              ]}
              className="h-[38px] text-xs"
            />

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Freight Transporter</label>
                <button
                  type="button"
                  onClick={() => setShowQuickTransporter(true)}
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-800"
                >
                  + Quick Transporter
                </button>
              </div>
              <SearchableSelect
                placeholder="Select transporter..."
                value={transporterId}
                onChange={(val) => setTransporterId(val)}
                options={[
                  { value: '', label: 'None / Self Pickup' },
                  ...transporters.map((t) => ({
                    value: t.id,
                    label: t.name,
                    sublabel: t.transporterId ? `GST ID: ${t.transporterId}` : t.vehicleNumber ? `Vehicle: ${t.vehicleNumber}` : undefined,
                  })),
                ]}
              />
            </div>
          </div>

          {/* Dynamic Custom Fields Grid */}
          {customFieldDefs.length > 0 && (
            <div className="border-t border-zinc-100 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Custom Fields</span>
                <span className="text-[10px] text-zinc-400">Configured in Organization Settings</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                {customFieldDefs.map((cf: any) => (
                  <Input
                    key={cf.id}
                    label={`${cf.label}${cf.required ? ' *' : ''}`}
                    type={cf.type || 'text'}
                    value={customFields[cf.id] || ''}
                    onChange={(e) =>
                      setCustomFields((prev) => ({
                        ...prev,
                        [cf.id]: e.target.value,
                      }))
                    }
                    placeholder={`Enter ${cf.label.toLowerCase()}...`}
                    required={!!cf.required}
                    className="h-[38px] text-xs"
                  />
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* 2. Fast Item Entry Workspace */}
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-5 space-y-4 overflow-visible">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              {editingIndex !== null ? 'Update Item Entry' : 'Add Line Item'}
            </h3>
            {editingIndex !== null && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingIndex(null);
                  setInputProduct('');
                  setInputBoxQty(0);
                  setInputLooseQty(0);
                  setInputPrice(0);
                  setInputDescription('');
                }}
                className="text-xs text-zinc-500 hover:text-zinc-800 h-7"
              >
                Cancel Edit
              </Button>
            )}
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            {/* Product Selector */}
            <div className="col-span-12 lg:col-span-4">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-zinc-600">Product / Variant *</label>
                {inputProduct && inputProduct.split(':')[0] !== 'custom' && products.find(p => p.id === inputProduct.split(':')[0])?.hasVariants && (
                  <button type="button" onClick={() => setShowQuickVariant(true)} className="text-[10px] text-amber-600 font-semibold hover:underline">
                    + Variant
                  </button>
                )}
              </div>
              <SearchableSelect
                id="invoice-product-search"
                placeholder="Type name, SKU, or scan barcode..."
                options={productOptions}
                value={inputProduct}
                onChange={handleInputProductChange}
                minSearchChars={1}
                createNewText="Product"
                onCreateNew={(term) => {
                  setQuickProductInitialName(term);
                  setShowQuickProduct(true);
                }}
              />
            </div>

            {/* Boxes */}
            <div className="col-span-4 lg:col-span-1">
              <label className="block text-xs font-semibold text-zinc-600 mb-1">
                Boxes {inputProduct && <span className="text-[10px] text-zinc-400 font-normal ml-0.5">({inputProduct ? getBoxQuantity(inputProduct.split(':')[0], inputProduct.split(':')[1] || null) : 0}/b)</span>}
              </label>
              <Input
                ref={boxQtyRef}
                type="number"
                min="0"
                className="text-center font-mono h-[38px] text-xs"
                value={inputBoxQty || ''}
                placeholder="0"
                onChange={(e) => setInputBoxQty(Number(e.target.value) || 0)}
                onKeyDown={handleInputKeyDown}
                disabled={!inputProduct}
              />
            </div>

            {/* Loose */}
            <div className="col-span-4 lg:col-span-1">
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Loose</label>
              <Input
                type="number"
                min="0"
                className="text-center font-mono h-[38px] text-xs"
                value={inputLooseQty || ''}
                placeholder="0"
                onChange={(e) => setInputLooseQty(Number(e.target.value) || 0)}
                onKeyDown={handleInputKeyDown}
                disabled={!inputProduct}
              />
            </div>

            {/* Live Total Qty Pill */}
            <div className="col-span-4 lg:col-span-1">
              <label className="block text-xs font-semibold text-amber-800 mb-1">Total Qty</label>
              <div className="w-full border border-amber-500/20 bg-amber-500/10 rounded-lg h-[38px] flex items-center justify-center font-bold text-amber-900 font-mono text-sm">
                {(inputBoxQty * (inputProduct && inputProduct !== 'custom' ? getBoxQuantity(inputProduct.split(':')[0], inputProduct.split(':')[1] || null) : 1)) + inputLooseQty}
              </div>
            </div>

            {/* Unit Price */}
            <div className="col-span-6 lg:col-span-2">
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Price (₹)</label>
              <Input
                type="number"
                min="0"
                step="any"
                className="font-mono h-[38px] text-xs"
                value={inputPrice || ''}
                placeholder="0.00"
                onChange={(e) => setInputPrice(Number(e.target.value) || 0)}
                onKeyDown={handleInputKeyDown}
                disabled={!inputProduct}
              />
            </div>

            {/* Discount */}
            <div className="col-span-6 lg:col-span-2">
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Discount</label>
              <div className="flex rounded-lg overflow-hidden border border-zinc-200">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  className="w-2/3 rounded-none border-none focus-visible:ring-0 font-mono h-[38px] text-xs"
                  value={inputDiscountValue || ''}
                  placeholder="0"
                  onChange={(e) => setInputDiscountValue(Number(e.target.value) || 0)}
                  onKeyDown={handleInputKeyDown}
                  disabled={!inputProduct}
                />
                <div className="w-1/3">
                  <Select
                    value={inputDiscountType}
                    onChange={(e) => setInputDiscountType(e.target.value)}
                    disabled={!inputProduct}
                    options={[
                      { value: 'percentage', label: '%' },
                      { value: 'fixed', label: '₹' }
                    ]}
                    className="bg-zinc-50 border-none border-l border-zinc-200 rounded-none h-[38px] text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Tax Rate */}
            <div className="col-span-12 lg:col-span-1">
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Tax Rate</label>
              <Select
                value={inputTaxRateId}
                onChange={(e) => setInputTaxRateId(e.target.value)}
                disabled={!inputProduct}
                options={[
                  { value: '', label: '0%' },
                  ...taxRates.map((tr) => ({ value: tr.id, label: `${tr.ratePercentage}%` }))
                ]}
                className="bg-white border-zinc-200 h-[38px] text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 items-center pt-2">
            <div className="col-span-12 sm:col-span-9">
              <Input
                type="text"
                value={inputDescription}
                onChange={(e) => setInputDescription(e.target.value)}
                onKeyDown={handleInputKeyDown}
                disabled={!inputProduct}
                placeholder="Item description override (optional)..."
                className="h-[38px] text-xs"
              />
            </div>
            <div className="col-span-12 sm:col-span-3">
              <Button
                type="button"
                onClick={handleAddItem}
                disabled={(!inputProduct && !inputDescription) || ((inputBoxQty * (inputProduct && inputProduct !== 'custom' ? getBoxQuantity(inputProduct.split(':')[0], inputProduct.split(':')[1] || null) : 1)) + inputLooseQty) <= 0}
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
                    Add Item to Invoice
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* 3. Interactive Line Items Table */}
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
          <CardContent className="p-0">
            <Table className="min-w-full text-left text-sm text-zinc-600">
              <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500 border-b border-zinc-100">
                <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                  <TableHead className="px-4 py-3 w-10 text-center">#</TableHead>
                  <TableHead className="px-4 py-3 min-w-[200px]">Product & Description</TableHead>
                  <TableHead className="px-4 py-3 text-center">HSN</TableHead>
                  <TableHead className="px-4 py-3 text-center min-w-[100px]">Qty (B/L)</TableHead>
                  <TableHead className="px-4 py-3 text-right">Unit Price</TableHead>
                  <TableHead className="px-4 py-3 text-right">Discount</TableHead>
                  <TableHead className="px-4 py-3 text-right">Tax Rate</TableHead>
                  <TableHead className="px-4 py-3 text-right">Net Total</TableHead>
                  <TableHead className="px-4 py-3 w-20 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-zinc-100">
                {lineItems.length === 0 ? (
                  <TableRow className="border-b border-zinc-100 transition-colors">
                    <TableCell colSpan={9} className="px-4 py-10 text-center text-zinc-400">
                      <div className="flex flex-col items-center gap-2">
                        <ShoppingBag className="w-8 h-8 text-zinc-300" />
                        <p className="text-sm font-medium text-zinc-600">No items added yet</p>
                        <p className="text-xs text-zinc-400">Use the workspace above to add products to this invoice.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  lineItems.map((line, idx) => {
                    const lineTotal = line.quantity * line.unitPrice;
                    const lineDiscount = line.discountType === 'percentage' ? (lineTotal * line.discountValue) / 100 : line.discountValue;
                    const taxable = Math.max(0, lineTotal - lineDiscount);
                    const taxRateObj = taxRates.find((t) => t.id === line.taxRateId);
                    const taxRate = taxRateObj ? Number(taxRateObj.ratePercentage) : 0;
                    const taxAmount = (taxable * taxRate) / 100;
                    const finalTotal = taxable + taxAmount;
                    
                    const isEditing = idx === editingIndex;

                    return (
                      <TableRow key={idx} className={`border-b border-zinc-100 transition-colors ${isEditing ? 'bg-amber-50/60 font-semibold' : 'hover:bg-zinc-50/50'}`}>
                        <TableCell className="px-4 py-3 text-center text-zinc-400 text-xs font-mono">{idx + 1}</TableCell>
                        <TableCell className="px-4 py-3">
                          <span className="font-semibold text-zinc-900 block">{line.description}</span>
                          {line.priceModified && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-800 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium mt-1 inline-block">
                              Contract Price
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center text-zinc-500 text-xs font-mono">{line.hsnCode || '—'}</TableCell>
                        <TableCell className="px-4 py-3 text-center font-bold text-zinc-900">
                          {line.quantity}
                          {(line.boxQty > 0 || line.looseQty > 0) && (
                            <span className="text-[10px] text-zinc-500 block font-normal font-mono">
                              {line.boxQty || 0}B + {line.looseQty || 0}L
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right font-mono text-zinc-800 font-medium">
                          ₹{Number(line.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-red-600 font-mono text-xs">
                          {line.discountValue > 0 ? (
                            <>
                              {line.discountType === 'percentage' ? `${line.discountValue}%` : `₹${line.discountValue}`}
                              <span className="block text-[10px] opacity-80">(-₹{lineDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                            </>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-zinc-600 text-xs">
                          <span className="inline-block bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded font-medium">
                            {taxRateObj ? `${taxRateObj.ratePercentage}%` : '0%'}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                          ₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <div className="flex justify-center items-center gap-1">
                            <Button
                              variant="ghost"
                              type="button"
                              size="icon"
                              onClick={() => handleEditLine(idx)}
                              title="Edit line item"
                              className="text-zinc-400 hover:text-amber-600 hover:bg-amber-50 h-7 w-7 rounded-lg transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              type="button"
                              size="icon"
                              onClick={() => handleRemoveLine(idx)}
                              title="Remove line item"
                              className="text-zinc-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              {lineItems.length > 0 && (
                <tfoot className="border-t-2 border-zinc-200 bg-zinc-50/80">
                  <TableRow className="border-b border-zinc-100 transition-colors">
                    <TableCell colSpan={3} className="px-4 py-3 text-right font-semibold text-zinc-700 text-xs uppercase tracking-wider">
                      Total Invoice Quantity
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center font-extrabold text-zinc-900 text-base font-mono">
                      {lineItems.reduce((acc, line) => acc + Number(line.quantity), 0)}
                    </TableCell>
                    <TableCell colSpan={5} className="px-4 py-3"></TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </CardContent>
        </Card>

        {/* 4. HSN Summary */}
        {hsnSummary.length > 0 && (
          <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
            <CardHeader className="px-5 py-3 border-b border-zinc-100 space-y-0 bg-zinc-50/50">
              <CardTitle className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                HSN Tax Breakdown Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-full text-left text-xs text-zinc-600">
                <TableHeader className="bg-zinc-50/80 font-semibold uppercase text-zinc-500">
                  <TableRow className="border-b border-zinc-100">
                    <TableHead className="px-4 py-2.5">HSN Code</TableHead>
                    <TableHead className="px-4 py-2.5 text-right">Total Qty</TableHead>
                    <TableHead className="px-4 py-2.5 text-right">Taxable Value</TableHead>
                    <TableHead className="px-4 py-2.5 text-right">Rate</TableHead>
                    <TableHead className="px-4 py-2.5 text-right">Tax Amount</TableHead>
                    <TableHead className="px-4 py-2.5 text-right">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-zinc-100">
                  {hsnSummary.map((item, idx) => (
                    <TableRow key={idx} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                      <TableCell className="px-4 py-2.5 font-bold text-zinc-900 font-mono">{item.hsnCode}</TableCell>
                      <TableCell className="px-4 py-2.5 text-right font-medium text-zinc-900 font-mono">{item.quantity}</TableCell>
                      <TableCell className="px-4 py-2.5 text-right text-zinc-700 font-mono">₹{item.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="px-4 py-2.5 text-right text-zinc-700 font-medium">{item.rate}%</TableCell>
                      <TableCell className="px-4 py-2.5 text-right text-zinc-700 font-mono">₹{item.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="px-4 py-2.5 text-right font-bold text-zinc-900 font-mono">₹{item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 5. Bottom Split: Disclaimers & Sticky Totals Card */}
        <div className="grid gap-6 md:grid-cols-12 items-start">
          {/* Notes & Terms Left Column */}
          <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 md:col-span-7 p-5 space-y-4">
            <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider border-b border-zinc-100 pb-2.5 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Notes & Terms & Conditions
            </h3>
            
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Customer Footnotes / Disclaimers
              </label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                rows={2}
                placeholder="Footnotes printed at bottom of invoice..."
                className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs text-zinc-800 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Invoicing Terms and Conditions
              </label>
              <textarea
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                rows={3}
                placeholder="Payment terms, warranty policy, dispute jurisdiction..."
                className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs text-zinc-800 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>
          </Card>

          {/* Sticky Totals Right Column */}
          <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 md:col-span-5 p-5 space-y-4 sticky top-20">
            <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider border-b border-zinc-100 pb-2.5 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-600" />
              Totals & GST Breakdown
            </h3>
            
            <div className="space-y-2 text-xs font-medium">
              <div className="flex justify-between text-zinc-600">
                <span>Gross Subtotal</span>
                <span className="font-mono font-semibold text-zinc-900">{formatCurrency(totals.subtotal)}</span>
              </div>
              
              <div className="flex justify-between text-zinc-600 pb-2 border-b border-zinc-100">
                <span>Total Discounts</span>
                <span className="font-mono text-red-600">({formatCurrency(totals.discountAmount)})</span>
              </div>

              <div className="flex justify-between text-zinc-900 font-semibold pt-1">
                <span>Net Taxable Value</span>
                <span className="font-mono">{formatCurrency(totals.taxableAmount)}</span>
              </div>

              {/* GST Tax Type Indicator Badge */}
              <div className="p-2.5 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-1.5 my-2">
                <div className="flex justify-between items-center text-[11px] font-semibold text-zinc-600">
                  <span className="uppercase tracking-wider">
                    {!totals.isInterState ? 'Intra-State GST (CGST + SGST)' : 'Inter-State GST (IGST)'}
                  </span>
                  <span className="font-mono font-bold text-zinc-900">{formatCurrency(totals.totalTaxAmount)}</span>
                </div>

                {!totals.isInterState ? (
                  <div className="space-y-1 pt-1 border-t border-zinc-200/50 text-[11px] text-zinc-500">
                    <div className="flex justify-between">
                      <span>CGST</span>
                      <span className="font-mono">{formatCurrency(totals.cgstAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST</span>
                      <span className="font-mono">{formatCurrency(totals.sgstAmount)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-1 border-t border-zinc-200/50 text-[11px] text-zinc-500 flex justify-between">
                    <span>IGST</span>
                    <span className="font-mono">{formatCurrency(totals.igstAmount)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-zinc-500 text-[11px] pt-1">
                <span>Round Off Adjustment</span>
                <span className="font-mono font-semibold text-zinc-700">{roundOff !== '0' ? `${roundOff} ₹` : '0.00 ₹'}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200/80 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Total Payable</p>
                <p className="text-xl font-extrabold text-amber-600 font-mono tracking-tight">
                  {formatCurrency(totals.grandTotal)}
                </p>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-800 border-amber-500/20 text-xs px-2.5 py-1">
                GST Included
              </Badge>
            </div>
          </Card>
        </div>

        {/* Action Buttons Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/invoices')}
            className="border-zinc-200 hover:bg-zinc-50 text-zinc-700"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-all"
            >
              {saving ? (
                <>Saving Invoice...</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {!!invoiceId ? 'Save Changes' : 'Approve & Create Invoice'}
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
        defaultType={documentType === 'purchase_invoice' ? 'vendor' : 'customer'}
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
        product={products.find(p => p.id === (inputProduct ? inputProduct.split(':')[0] : ''))}
      />
      <QuickTransporterModal
        open={showQuickTransporter}
        onOpenChange={setShowQuickTransporter}
        onTransporterCreated={(newTrp) => {
          setTransporters((prev) => [newTrp, ...prev]);
          setTransporterId(newTrp.id);
        }}
      />
      <ImportOrderItemsModal
        isOpen={!!selectedOrderIdToImport}
        onClose={() => setSelectedOrderIdToImport(null)}
        orderId={selectedOrderIdToImport}
        products={products}
        onImport={(items, orderId) => {
          setPoLinkedOrderId(orderId);
          setLineItems((prev) => {
            if (prev.length === 0) return items;
            return [...prev, ...items];
          });
        }}
      />
    </div>
  );
}
