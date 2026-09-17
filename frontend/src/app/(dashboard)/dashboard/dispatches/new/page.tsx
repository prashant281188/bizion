'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatVariantName } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { QuickTransporterModal } from '@/components/ui/quick-transporter-modal';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function CreateDispatchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialContactId = searchParams.get('contactId') || '';
  const initialOrderId = searchParams.get('orderId') || '';
  
  const [contacts, setContacts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [contactId, setContactId] = useState(initialContactId);
  const [orderIds, setOrderIds] = useState<string[]>(initialOrderId ? [initialOrderId] : []);
  const [items, setItems] = useState<any[]>([]);

  // Standalone custom item input bar
  const [inputProduct, setInputProduct] = useState('');
  const [inputQty, setInputQty] = useState<number>(1);
  const [inputPrice, setInputPrice] = useState<number>(0);

  // Logistics & Transporter Details
  const [transporterName, setTransporterName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [ewayBillNumber, setEwayBillNumber] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickTransporterModalOpen, setQuickTransporterModalOpen] = useState(false);
  
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const contactOptions = useMemo(() => {
    return contacts.map(c => {
      const isDeactivated = c.isActive === false;
      return {
        value: c.id,
        label: `${c.displayName || c.companyName || 'Unnamed Customer'}${isDeactivated ? ' [DEACTIVATED]' : ''}`,
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
  }, [contacts]);

  // Fetch transporters list
  const [transportersList, setTransportersList] = useState<any[]>([]);
  useEffect(() => {
    api.get('/transporters')
      .then(res => setTransportersList(res.data?.data || []))
      .catch(() => {
        setTransportersList([
          { id: '1', name: 'VRL Logistics Ltd', transporterId: '27AAAAA0000A1Z5', vehicleNumber: 'MH-12-VT-9988' },
          { id: '2', name: 'TCI Freight Services', transporterId: '27BBBBB1111B1Z2', vehicleNumber: 'MH-14-AX-5544' },
        ]);
      });
  }, []);

  const transporterOptions = useMemo(() => transportersList.map(t => ({
    value: t.name,
    label: t.name,
    sublabel: t.transporterId ? `GST ID: ${t.transporterId}` : t.vehicleNumber ? `Vehicle: ${t.vehicleNumber}` : undefined,
  })), [transportersList]);

  const handleSelectTransporter = (val: string) => {
    setTransporterName(val);
    const found = transportersList.find(t => t.name === val);
    if (found) {
      if (found.vehicleNumber && !vehicleNumber) setVehicleNumber(found.vehicleNumber);
      if (found.transporterId && !ewayBillNumber) setEwayBillNumber(found.transporterId);
    }
  };

  // Fetch initial master data
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [contactsRes, productsRes] = await Promise.all([
          api.get('/contacts?type=customer&limit=1000'),
          api.get('/products?limit=1000')
        ]);
        setContacts(contactsRes.data?.data || []);
        setProducts(productsRes.data?.data || []);
      } catch (err) {
        toast.error('Failed to load master data');
      } finally {
        setLoadingContacts(false);
      }
    };
    fetchMasters();
  }, []);

  const isInitialLoad = React.useRef(true);

  // Fetch pending orders when contact changes
  useEffect(() => {
    if (contactId) {
      setLoadingOrders(true);
      if (!isInitialLoad.current) {
        setOrderIds([]);
        setItems([]);
      } else {
        isInitialLoad.current = false;
      }
      
      api.get(`/orders?contactId=${contactId}&status=confirmed,processing&type=sales&limit=100`)
        .then(res => {
          setOrders(res.data?.data || []);
        })
        .catch(() => {
          toast.error('Failed to load orders for the selected customer');
        })
        .finally(() => {
          setLoadingOrders(false);
        });
    } else {
      setOrders([]);
      setOrderIds([]);
      setItems([]);
    }
  }, [contactId]);

  // Fetch order details when orders are selected
  useEffect(() => {
    if (orderIds.length > 0) {
      Promise.all(orderIds.map(id => api.get(`/orders/${id}`)))
        .then(responses => {
          let allMappedItems: any[] = [];
          
          responses.forEach(res => {
            const order = res.data?.data;
            if (order && order.items) {
              const mappedItems = order.items.map((item: any) => {
                const remaining = Math.max(0, item.baseQuantity - (item.dispatchedQuantity || 0));
                return {
                  id: item.id, // orderItemId
                  orderNumber: order.orderNumber,
                  productId: item.productId,
                  variantId: item.variantId,
                  productLabel: formatVariantName(item.product?.name || '', item.variant?.name, item.variant?.sku),
                  orderedQty: item.baseQuantity,
                  dispatchedQty: item.dispatchedQuantity || 0,
                  remainingQty: remaining,
                  dispatchQuantity: remaining, // default to remaining
                  unitPrice: item.unitPrice, // the requested unitPrice from Sales Order
                  isNew: false,
                };
              });
              allMappedItems = [...allMappedItems, ...mappedItems];
            }
          });
          
          // Merge with any "new" items already added by user
          setItems(prevItems => {
            const newItems = prevItems.filter(i => i.isNew);
            return [...allMappedItems, ...newItems];
          });
        })
        .catch(() => {
          toast.error('Failed to load order details');
        });
    } else {
      setItems(prevItems => prevItems.filter(i => i.isNew));
    }
  }, [orderIds]);

  // Handle product selection for new items
  const handleInputProductChange = (compoundValue: string) => {
    setInputProduct(compoundValue);
    if (!compoundValue) {
      setInputPrice(0);
      return;
    }
    const [prodId, varId] = compoundValue.split(':');
    const product = products.find(p => p.id === prodId);
    if (product) {
      let price = product.sellingPrice || 0;
      if (varId && product.variants) {
        const variant = product.variants.find((v: any) => v.id === varId);
        if (variant && variant.sellingPrice) price = variant.sellingPrice;
      }
      setInputPrice(price);
    }
  };

  const handleAddNewItem = () => {
    if (!inputProduct) {
      toast.error('Please select a product');
      return;
    }
    if (inputQty <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    const [prodId, varId] = inputProduct.split(':');
    const product = products.find(p => p.id === prodId);
    let label = product?.name || 'Unknown';
    if (varId && product?.variants) {
      const v = product.variants.find((v: any) => v.id === varId);
      if (v) label += ` - ${v.name}`;
    }

    const newItem = {
      id: `new-${Date.now()}`,
      orderNumber: 'N/A',
      productId: prodId,
      variantId: varId || null,
      productLabel: label,
      orderedQty: 0,
      dispatchedQty: 0,
      remainingQty: 0, // N/A for new items
      dispatchQuantity: inputQty,
      unitPrice: inputPrice,
      isNew: true,
      unitType: 'loose',
    };

    setItems([...items, newItem]);
    
    // Reset inputs
    setInputProduct('');
    setInputQty(1);
    setInputPrice(0);
  };

  const handleDispatchQtyChange = (id: string, qty: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        let validQty = Math.max(0, qty);
        if (!item.isNew && validQty > item.remainingQty) {
          validQty = item.remainingQty;
          toast.error('Cannot dispatch more than the remaining quantity');
        }
        return { ...item, dispatchQuantity: validQty };
      }
      return item;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderIds.length === 0 && items.filter(i => i.isNew).length === 0) {
      toast.error('Please add items to dispatch');
      return;
    }
    
    if (orderIds.length === 0 && !contactId) {
      toast.error('Please select a customer for this standalone dispatch');
      return;
    }
    
    const itemsToDispatch = items.filter(i => i.dispatchQuantity > 0);
    if (itemsToDispatch.length === 0) {
      toast.error('Please add items to dispatch with quantity > 0');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        orderIds,
        contactId,
        transporterName,
        vehicleNumber,
        lrNumber,
        ewayBillNumber,
        dispatchDate,
        items: itemsToDispatch.map(item => {
          if (item.isNew) {
            return {
              isNew: true,
              productId: item.productId,
              variantId: item.variantId,
              unitType: item.unitType,
              quantity: item.dispatchQuantity,
              unitPrice: item.unitPrice,
            };
          } else {
            return {
              orderItemId: item.id,
              dispatchQuantity: item.dispatchQuantity,
            };
          }
        }),
      };

      const res = await api.post('/dispatches', payload);
      toast.success('Dispatch created successfully');
      router.push(`/dashboard/dispatches/${res.data.data.id}?print=true`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create dispatch');
    } finally {
      setSubmitting(false);
    }
  };

  const productOptions = useMemo(() => {
    const opts: any[] = [];
    products.forEach(p => {
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

  const toggleOrder = (id: string) => {
    if (orderIds.includes(id)) {
      setOrderIds(orderIds.filter(o => o !== id));
    } else {
      setOrderIds([...orderIds, id]);
    }
  };

  if (loadingContacts) {
    return <div className="p-6 animate-pulse"><div className="h-10 bg-zinc-100 rounded-lg w-1/3 mb-6" /></div>;
  }

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Create Dispatch Advice Note</h1>
          <p className="text-xs text-zinc-500">Issue warehouse dispatch manifest against customer sales orders or direct shipments.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()} className="text-xs border-zinc-200">
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Step 1: Customer & Sales Orders */}
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-6 space-y-4 overflow-visible">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">1. Customer & Linked Sales Orders</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Select Customer / Party *</label>
              <SearchableSelect
                placeholder="Search customer by name or phone..."
                options={contactOptions}
                value={contactId}
                onChange={setContactId}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Pending Customer Sales Orders</label>
              {contactId ? (
                loadingOrders ? (
                  <div className="text-xs text-zinc-500 py-2 font-medium">Loading confirmed sales orders...</div>
                ) : orders.length > 0 ? (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border border-zinc-200/80 rounded-xl p-2.5 bg-zinc-50/50">
                    {orders.map(o => (
                      <label key={o.id} className="flex items-center justify-between gap-2 text-xs cursor-pointer hover:bg-white p-2 rounded-lg border border-transparent hover:border-zinc-200 transition-all">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={orderIds.includes(o.id)}
                            onChange={() => toggleOrder(o.id)}
                            className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                          />
                          <span className="font-bold text-zinc-900 font-mono">{o.orderNumber}</span>
                        </div>
                        <span className="text-zinc-600 font-mono text-[11px]">₹{Number(o.totalAmount || 0).toLocaleString('en-IN')} ({o.status})</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 py-2.5 font-medium italic">No pending confirmed sales orders found for this customer.</div>
                )
              ) : (
                <div className="text-xs text-zinc-400 py-2.5 font-medium italic">Select a customer above to view open orders</div>
              )}
            </div>
          </div>
        </Card>

        {/* Step 2: Transporter & Logistics Details */}
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-6 space-y-4 overflow-visible">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">2. Logistics & Transporter Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Dispatch Date</label>
              <Input
                type="date"
                value={dispatchDate}
                onChange={e => setDispatchDate(e.target.value)}
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Transporter Partner</label>
                <button
                  type="button"
                  onClick={() => setQuickTransporterModalOpen(true)}
                  className="text-[10px] font-bold text-amber-700 hover:underline"
                >
                  + Quick Transporter
                </button>
              </div>
              <SearchableSelect
                placeholder="Search registered transporter..."
                options={transporterOptions}
                value={transporterName}
                onChange={handleSelectTransporter}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Vehicle No. / LR No.</label>
              <Input
                type="text"
                placeholder="e.g. MH-12-AB-1234 / LR-998"
                value={vehicleNumber}
                onChange={e => setVehicleNumber(e.target.value)}
                className="h-9 text-xs font-mono uppercase bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">E-Way Bill Number</label>
              <Input
                type="text"
                placeholder="e.g. 121009988776"
                value={ewayBillNumber}
                onChange={e => setEwayBillNumber(e.target.value)}
                className="h-9 text-xs font-mono uppercase bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
          </div>
        </Card>

        {/* Step 3: Line Items */}
        {!!contactId && (
          <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200/80 bg-zinc-50/60 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">3. Dispatch Manifest Line Items</h3>
              <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                {items.length} Items Configured
              </span>
            </div>

            {/* Quick Add Custom Item Bar */}
            <div className="px-6 py-3 border-b border-zinc-200/80 bg-amber-50/30 flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">Add Standalone Item (Optional)</label>
                <SearchableSelect
                  placeholder="Select product to add..."
                  options={productOptions}
                  value={inputProduct}
                  onChange={handleInputProductChange}
                />
              </div>
              <div className="w-24">
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">Qty</label>
                <Input
                  type="number"
                  min="1"
                  value={inputQty || ''}
                  onChange={e => setInputQty(Number(e.target.value))}
                  className="h-9 text-xs font-mono bg-white"
                />
              </div>
              <div className="w-28">
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">Unit Rate (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={inputPrice || ''}
                  onChange={e => setInputPrice(Number(e.target.value))}
                  className="h-9 text-xs font-mono bg-white"
                />
              </div>
              <Button type="button" onClick={handleAddNewItem} disabled={!inputProduct} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-4 rounded-xl">
                + Add Item
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table className="min-w-full text-left text-xs text-zinc-700">
                <TableHeader className="bg-zinc-50/80 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <TableRow className="border-b border-zinc-100">
                    <TableHead className="px-4 py-3">Order #</TableHead>
                    <TableHead className="px-4 py-3">Product Description</TableHead>
                    <TableHead className="px-4 py-3 text-right">Rate (₹)</TableHead>
                    <TableHead className="px-4 py-3 text-center">Ordered</TableHead>
                    <TableHead className="px-4 py-3 text-center">Dispatched</TableHead>
                    <TableHead className="px-4 py-3 text-center">Remaining</TableHead>
                    <TableHead className="px-4 py-3 text-center w-36">Dispatch Qty</TableHead>
                    <TableHead className="px-4 py-3 w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-zinc-100">
                  {items.map((item) => (
                    <TableRow key={item.id} className={item.isNew ? "bg-amber-50/40" : ""}>
                      <TableCell className="px-4 py-3 font-mono text-xs font-bold text-zinc-800">
                        {item.orderNumber}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="font-bold text-xs text-zinc-900">{item.productLabel}</span>
                        {item.isNew && (
                          <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase">
                            Manual
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right font-mono text-xs">
                        ₹{Number(item.unitPrice).toFixed(2)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center font-mono text-zinc-600">{item.isNew ? '—' : item.orderedQty}</TableCell>
                      <TableCell className="px-4 py-3 text-center font-mono text-zinc-600">{item.isNew ? '—' : item.dispatchedQty}</TableCell>
                      <TableCell className="px-4 py-3 text-center font-mono font-bold text-amber-700">{item.isNew ? '—' : item.remainingQty}</TableCell>
                      <TableCell className="px-4 py-3">
                        <Input
                          type="number"
                          min="0"
                          max={item.isNew ? undefined : item.remainingQty}
                          className="text-center font-mono font-bold text-xs h-8 bg-white border-zinc-200"
                          value={item.dispatchQuantity === 0 ? '' : item.dispatchQuantity}
                          onChange={(e) => handleDispatchQtyChange(item.id, Number(e.target.value))}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {item.isNew && (
                          <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-600 hover:text-red-700 text-xs font-bold">
                            ✕
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="px-4 py-6 text-center text-zinc-400 italic">
                        Select sales orders above or add manual items to generate dispatch manifest.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="px-6 py-4 border-t border-zinc-200/80 bg-zinc-50/50 flex justify-end">
              <Button
                type="submit"
                disabled={submitting || items.length === 0}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition-all"
              >
                {submitting ? 'Generating Manifest...' : 'Create Dispatch Note & Print'}
              </Button>
            </div>
          </Card>
        )}
      </form>

      {/* Quick Transporter Create Modal */}
      <QuickTransporterModal
        open={quickTransporterModalOpen}
        onOpenChange={setQuickTransporterModalOpen}
        onTransporterCreated={(newTrp) => {
          setTransportersList(prev => [newTrp, ...prev]);
          setTransporterName(newTrp.name);
          if (newTrp.vehicleNumber) setVehicleNumber(newTrp.vehicleNumber);
          if (newTrp.transporterId) setEwayBillNumber(newTrp.transporterId);
        }}
      />
    </div>
  );
}

export default function CreateDispatchPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <CreateDispatchForm />
    </Suspense>
  );
}
