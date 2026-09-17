'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, numberToWordsIndian } from '@/lib/utils';
import { Printer, Edit, ArrowLeft, Building2, User, CreditCard, Wallet, Landmark } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { RecordPaymentModal } from '@/components/payments/record-payment-modal';
import { ApplyCreditModal } from '@/components/payments/apply-credit-modal';

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [applyCreditOpen, setApplyCreditOpen] = useState(false);
  const [creditAllocations, setCreditAllocations] = useState<any[]>([]);

  const fetchCreditAllocations = async (invoiceId: string) => {
    try {
      const res = await api.get(`/credit-notes/invoice-allocations/${invoiceId}`);
      setCreditAllocations(res.data.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (id) {
      fetchInvoice();
      fetchCreditAllocations(id);
    }
  }, [id]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/invoices/${id}`);
      setInvoice(res.data.data);
    } catch (err) {
      toast.error('Failed to fetch invoice details');
    } finally {
      setLoading(false);
    }
  };

  const { data: orgData } = useQuery({
    queryKey: ['org-settings-for-invoice'],
    queryFn: async () => {
      const res = await api.get('/organizations/me');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: contactsData } = useQuery({
    queryKey: ['masters-contacts-limit-100'],
    queryFn: async () => {
      const res = await api.get('/contacts?limit=100');
      return res.data;
    },
  });

  const { data: bankAccountsData } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: async () => {
      const res = await api.get('/payments/bank-accounts');
      return res.data;
    },
  });

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto">
        <div className="h-8 w-48 bg-zinc-200 rounded mb-6 animate-pulse"></div>
        <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 h-96 animate-pulse" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6 text-center text-zinc-500">
        Invoice not found
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'draft': return 'bg-zinc-100 text-zinc-700 border-zinc-300';
      case 'approved': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-zinc-50 text-zinc-700 border-zinc-200';
    }
  };

  const sellerName = orgData?.legalName || orgData?.name || 'Your Company Name';
  const sellerAddressLine1 = orgData?.addressLine1 || '';
  const sellerAddressLine2 = orgData?.addressLine2 || '';
  const sellerCity = orgData?.city || '';
  const sellerState = orgData?.stateName || orgData?.stateCode || '';
  const sellerPincode = orgData?.pincode || '';
  const sellerGstin = orgData?.gstin || '';
  const sellerPhone = orgData?.phone || '';
  const sellerLogo = orgData?.logoUrl || '';

  const bankName = orgData?.settings?.bankName || '';
  const bankBranch = orgData?.settings?.bankBranch || '';
  const bankAccNo = orgData?.settings?.bankAccountNumber || '';
  const bankIfsc = orgData?.settings?.bankIfscCode || '';
  const upiId = orgData?.settings?.upiId || '';

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 flex flex-wrap items-center gap-3">
            {invoice.documentType === 'sales_invoice' ? 'Tax Invoice' : 
             invoice.documentType === 'purchase_invoice' ? 'Purchase Invoice' : 
             invoice.documentType.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
            <Badge variant="outline" className={`capitalize px-3 py-1 whitespace-nowrap ${getStatusColor(invoice.status)}`}>
              {invoice.status}
            </Badge>
          </h2>
          <p className="text-zinc-500 mt-1 font-mono">
            {invoice.invoiceNumber}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button variant="outline" onClick={() => router.back()} className="flex-1 sm:flex-none h-9">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button variant="outline" onClick={handlePrint} className="flex-1 sm:flex-none h-9 bg-white hover:bg-zinc-50 text-zinc-700">
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          {invoice.status !== 'cancelled' && (
            <Button onClick={() => router.push(`/dashboard/invoices/${id}/edit`)} className="flex-1 sm:flex-none h-9 bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200 shadow-sm">
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
          )}
          {Number(invoice.balanceDue) > 0 && invoice.status !== 'cancelled' && invoice.status !== 'draft' && invoice.status !== 'paid' && (
            <Button onClick={() => setRecordPaymentOpen(true)} className="flex-1 sm:flex-none h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
              <CreditCard className="mr-2 h-4 w-4" /> Record Payment
            </Button>
          )}
          {/* Apply Credit Note */}
          {Number(invoice.balanceDue) > 0 && invoice.status !== 'cancelled' && invoice.status !== 'draft' && invoice.status !== 'paid'
            && (invoice.documentType === 'sales_invoice' || invoice.documentType === 'debit_note') && (
            <Button onClick={() => setApplyCreditOpen(true)} variant="outline" className="flex-1 sm:flex-none h-9 bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 shadow-sm">
              <Wallet className="mr-2 h-4 w-4" /> Apply Credit Note
            </Button>
          )}
        </div>
      </div>

      <RecordPaymentModal 
        isOpen={recordPaymentOpen}
        onClose={() => setRecordPaymentOpen(false)}
        onSuccess={() => {
          setRecordPaymentOpen(false);
          fetchInvoice();
          fetchCreditAllocations(id);
        }}
        contacts={contactsData?.data || []}
        accounts={bankAccountsData?.data || []}
        initialContactId={invoice.contactId}
        initialInvoiceId={invoice.id}
        initialAmount={Number(invoice.balanceDue)}
      />

      <ApplyCreditModal
        isOpen={applyCreditOpen}
        onClose={() => setApplyCreditOpen(false)}
        onSuccess={() => {
          setApplyCreditOpen(false);
          fetchInvoice();
          fetchCreditAllocations(id);
        }}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        contactId={invoice.contactId}
        invoiceBalanceDue={Number(invoice.balanceDue)}
      />

      {/* Printable GST Tax Invoice Document */}
      <div className="bg-white rounded-xl shadow-lg border border-zinc-300 print:border-none print:shadow-none print:rounded-none printable-invoice text-zinc-900 font-sans">
        <table className="w-full border-collapse">
          {/* REPEATING HEADER */}
          <thead className="print-header-repeat">
            <tr>
              <th className="p-0 font-normal text-left">
                <div className="p-6 sm:p-8 pb-3 space-y-3">
                  {/* Top Bar: Legal Identity & Document Type */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-zinc-900 pb-3">
                    <div className="space-y-1 max-w-lg">
                      {sellerLogo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sellerLogo} alt={sellerName} className="h-10 max-w-[180px] object-contain mb-1" />
                      )}
                      <h2 className="text-lg font-black tracking-tight text-zinc-950 uppercase">{sellerName}</h2>
                      <div className="text-[11px] text-zinc-600 space-y-0.5 leading-snug">
                        {sellerAddressLine1 && <p>{sellerAddressLine1}{sellerAddressLine2 ? `, ${sellerAddressLine2}` : ''}</p>}
                        {(sellerCity || sellerState || sellerPincode) && (
                          <p>{[sellerCity, sellerState].filter(Boolean).join(', ')}{sellerPincode ? ` - ${sellerPincode}` : ''}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 pt-0.5 text-zinc-800 font-medium">
                          {sellerGstin && <span><strong>GSTIN:</strong> <span className="font-mono">{sellerGstin}</span></span>}
                          {sellerPhone && <span><strong>Ph:</strong> {sellerPhone}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-left sm:text-right space-y-1.5 self-stretch sm:self-auto flex flex-col justify-between items-start sm:items-end">
                      <span className="px-2.5 py-1 bg-zinc-900 text-white font-extrabold text-xs uppercase tracking-wider rounded">
                        {invoice.documentType === 'sales_invoice' ? 'TAX INVOICE' : 
                         invoice.documentType === 'purchase_invoice' ? 'PURCHASE INVOICE' : 
                         invoice.documentType.replace('_', ' ').toUpperCase()}
                      </span>
                      <div className="text-base font-black font-mono text-zinc-950">
                        #{invoice.invoiceNumber}
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] bg-zinc-50 border border-zinc-200 p-2 rounded-lg text-left">
                        <span className="text-zinc-500">Date:</span>
                        <span className="font-mono font-bold text-zinc-950 text-right">{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>
                        {invoice.dueDate && (
                          <>
                            <span className="text-zinc-500">Due:</span>
                            <span className="font-mono font-bold text-zinc-950 text-right">{new Date(invoice.dueDate).toLocaleDateString('en-IN')}</span>
                          </>
                        )}
                        {invoice.placeOfSupplyCode && (
                          <>
                            <span className="text-zinc-500">POS:</span>
                            <span className="font-mono font-bold text-zinc-950 text-right">{invoice.placeOfSupplyCode}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Billed To & Shipped To Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-zinc-300 rounded-lg p-3 bg-zinc-50/40 text-xs">
                    <div className="space-y-0.5 sm:border-r sm:border-zinc-200 sm:pr-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">Billed To (Customer):</div>
                      <div className="font-bold text-zinc-950 text-sm">{invoice.contact?.companyName || invoice.contact?.displayName || 'Direct Customer'}</div>
                      {invoice.contact?.displayName && invoice.contact?.companyName && (
                        <div className="text-zinc-500 text-[11px]">Attn: {invoice.contact.displayName}</div>
                      )}
                      {invoice.billingAddress ? (
                        <div className="text-zinc-600 text-[11px] leading-tight pt-0.5">
                          <p>{invoice.billingAddress.addressLine1} {invoice.billingAddress.addressLine2}</p>
                          <p>{[invoice.billingAddress.city, invoice.billingAddress.state].filter(Boolean).join(', ')}{invoice.billingAddress.pincode ? ` - ${invoice.billingAddress.pincode}` : ''}</p>
                          {invoice.billingAddress.gstin && (
                            <p className="font-bold font-mono text-zinc-900 pt-0.5">GSTIN: {invoice.billingAddress.gstin}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-zinc-400 italic text-[11px]">No address provided</p>
                      )}
                    </div>

                    <div className="space-y-0.5 sm:pl-2 text-[11px]">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">Shipped To / Transport:</div>
                      {invoice.shippingAddress ? (
                        <div className="text-zinc-600 leading-tight">
                          <div className="font-semibold text-zinc-900">{invoice.shippingAddress.addressLine1}</div>
                          <p>{[invoice.shippingAddress.city, invoice.shippingAddress.state].filter(Boolean).join(', ')}{invoice.shippingAddress.pincode ? ` - ${invoice.shippingAddress.pincode}` : ''}</p>
                        </div>
                      ) : (
                        <p className="text-zinc-500">Same as Billed Address</p>
                      )}
                      <div className="pt-1 space-y-0.5 text-zinc-700 font-mono text-[10.5px]">
                        {invoice.transporter && (
                          <div className="font-sans font-medium text-zinc-900">
                            <strong>Transporter:</strong> {invoice.transporter.name} {invoice.transporter.transporterId ? `(ID: ${invoice.transporter.transporterId})` : ''}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-x-3">
                          {invoice.ewayBillNumber && <span><strong>E-Way:</strong> {invoice.ewayBillNumber}</span>}
                          {invoice.vehicleNumber && <span><strong>Veh No:</strong> {invoice.vehicleNumber}</span>}
                          {invoice.transportMode && <span><strong>Mode:</strong> {invoice.transportMode}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Custom Fields (Printed if configured showOnPrint) */}
                  {invoice.customFields && orgData?.settings?.invoiceCustomFields && (
                    (() => {
                      const printableFields = (orgData.settings.invoiceCustomFields as any[]).filter(
                        (cf) => cf.showOnPrint !== false && invoice.customFields[cf.id]
                      );
                      if (printableFields.length === 0) return null;
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-zinc-200 rounded-lg p-2.5 bg-zinc-50/20 text-xs mt-2">
                          {printableFields.map((cf) => (
                            <div key={cf.id} className="space-y-0.5">
                              <span className="text-[10px] uppercase font-bold text-zinc-500 block">{cf.label}:</span>
                              <span className="font-semibold text-zinc-900">{String(invoice.customFields[cf.id])}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </div>
              </th>
            </tr>
          </thead>

          {/* LINE ITEMS BODY */}
          <tbody>
            <tr>
              <td className="p-0">
                <div className="px-6 sm:px-8 pb-6 space-y-4">
                  {/* Items Table */}
                  <div className="rounded-lg border border-zinc-300 overflow-hidden">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-zinc-100 text-zinc-900 border-b border-zinc-300 font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-2 px-2.5 w-8 text-center border-r border-zinc-200">#</th>
                          <th className="py-2 px-3 border-r border-zinc-200">Item Description</th>
                          <th className="py-2 px-2.5 w-16 text-center border-r border-zinc-200">HSN</th>
                          <th className="py-2 px-2.5 w-14 text-right border-r border-zinc-200">Qty</th>
                          <th className="py-2 px-3 w-24 text-right border-r border-zinc-200">Rate (₹)</th>
                          <th className="py-2 px-2.5 w-16 text-right border-r border-zinc-200">Disc.</th>
                          <th className="py-2 px-3 w-24 text-right">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 text-zinc-800">
                        {(() => {
                          let runningTotal = 0;
                          return (invoice.lineItems || []).map((item: any, idx: number) => {
                            const lineTotal = Number(item.totalAmount || 0);
                            runningTotal += lineTotal;
                            const isPageBreakCandidate = (idx + 1) % 15 === 0 && idx + 1 < (invoice.lineItems || []).length;

                            return (
                              <React.Fragment key={item.id || idx}>
                                <tr className="hover:bg-zinc-50/50">
                                  <td className="py-2 px-2.5 text-center text-zinc-400 font-mono border-r border-zinc-200">{idx + 1}</td>
                                  <td className="py-2 px-3 border-r border-zinc-200">
                                    <span className="font-semibold text-zinc-950 block">{item.description}</span>
                                  </td>
                                  <td className="py-2 px-2.5 text-center font-mono text-zinc-600 border-r border-zinc-200">{item.hsnCode || '—'}</td>
                                  <td className="py-2 px-2.5 text-right font-bold text-zinc-950 font-mono border-r border-zinc-200">{item.quantity}</td>
                                  <td className="py-2 px-3 text-right font-mono text-zinc-800 border-r border-zinc-200">
                                    {Number(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-mono text-zinc-600 border-r border-zinc-200">
                                    {Number(item.discountValue || 0) > 0 ? `${item.discountValue}${item.discountType === 'percentage' ? '%' : ''}` : '—'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold font-mono text-zinc-950">
                                    {lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>

                                {isPageBreakCandidate && (
                                  <>
                                    <tr className="bg-amber-50/90 font-bold border-y border-amber-300 print:break-after-page">
                                      <td colSpan={6} className="py-1.5 px-3 text-right text-amber-900 uppercase text-[10px] tracking-wider">
                                        Subtotal Carried Forward (C/F):
                                      </td>
                                      <td className="py-1.5 px-3 text-right font-mono text-amber-950 font-black">
                                        ₹{runningTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                    <tr className="bg-zinc-100/90 font-bold border-b border-zinc-300">
                                      <td colSpan={6} className="py-1.5 px-3 text-right text-zinc-700 uppercase text-[10px] tracking-wider">
                                        Subtotal Brought Forward (B/F):
                                      </td>
                                      <td className="py-1.5 px-3 text-right font-mono text-zinc-950 font-black">
                                        ₹{runningTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  </>
                                )}
                              </React.Fragment>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Amount In Words Banner */}
                  <div className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/70 text-xs flex items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-500 uppercase text-[10px] tracking-wider flex-shrink-0">Amount in Words:</span>
                    <span className="font-bold text-zinc-950 italic text-right">{numberToWordsIndian(Number(invoice.totalAmount || 0))}</span>
                  </div>

                  {/* Summary & Settlement Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1 items-start printable-block">
                    {/* Left 7 Cols: Bank Details & Terms */}
                    <div className="md:col-span-7 space-y-3">
                      {(bankName || bankAccNo || upiId) && (
                        <div className="p-3 rounded-lg border border-zinc-300 bg-zinc-50/80 text-xs space-y-1.5">
                          <div className="font-extrabold uppercase tracking-wider text-[10px] text-zinc-700 flex items-center gap-1.5 border-b border-zinc-200 pb-1">
                            <Landmark className="w-3.5 h-3.5 text-amber-600" />
                            Bank Account &amp; Wire Settlement
                          </div>
                          <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-zinc-700 text-[11px]">
                            {bankName && (
                              <>
                                <span className="text-zinc-500">Bank:</span>
                                <span className="col-span-2 font-bold text-zinc-950">{bankName} {bankBranch && `(${bankBranch})`}</span>
                              </>
                            )}
                            {bankAccNo && (
                              <>
                                <span className="text-zinc-500">A/C No:</span>
                                <span className="col-span-2 font-mono font-extrabold text-zinc-950">{bankAccNo}</span>
                              </>
                            )}
                            {bankIfsc && (
                              <>
                                <span className="text-zinc-500">IFSC:</span>
                                <span className="col-span-2 font-mono font-bold text-zinc-950">{bankIfsc}</span>
                              </>
                            )}
                            {upiId && (
                              <>
                                <span className="text-zinc-500">UPI VPA:</span>
                                <span className="col-span-2 font-mono font-semibold text-amber-800">{upiId}</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {invoice.termsAndConditions && (
                        <div className="space-y-0.5 text-[11px]">
                          <span className="font-bold text-zinc-500 uppercase text-[10px] tracking-wider">Terms &amp; Conditions:</span>
                          <p className="text-zinc-600 whitespace-pre-wrap leading-relaxed">{invoice.termsAndConditions}</p>
                        </div>
                      )}
                    </div>

                    {/* Right 5 Cols: Calculations & Authorization */}
                    <div className="md:col-span-5 space-y-3">
                      <div className="p-3.5 rounded-lg border border-zinc-300 bg-zinc-50/60 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-600">Subtotal:</span>
                          <span className="font-mono font-semibold text-zinc-900">{formatCurrency(invoice.subtotal)}</span>
                        </div>

                        {Number(invoice.discountAmount || 0) > 0 && (
                          <div className="flex justify-between items-center text-red-600">
                            <span>Discount:</span>
                            <span className="font-mono font-semibold">-{formatCurrency(invoice.discountAmount)}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-1 border-t border-zinc-200">
                          <span className="text-zinc-600 font-medium">Taxable Value:</span>
                          <span className="font-mono font-semibold text-zinc-900">{formatCurrency(invoice.taxableAmount)}</span>
                        </div>

                        {Number(invoice.cgstAmount || 0) > 0 && (
                          <div className="flex justify-between items-center text-zinc-600 text-[11px]">
                            <span>CGST:</span>
                            <span className="font-mono">{formatCurrency(invoice.cgstAmount)}</span>
                          </div>
                        )}
                        {Number(invoice.sgstAmount || 0) > 0 && (
                          <div className="flex justify-between items-center text-zinc-600 text-[11px]">
                            <span>SGST:</span>
                            <span className="font-mono">{formatCurrency(invoice.sgstAmount)}</span>
                          </div>
                        )}
                        {Number(invoice.igstAmount || 0) > 0 && (
                          <div className="flex justify-between items-center text-zinc-600 text-[11px]">
                            <span>IGST:</span>
                            <span className="font-mono">{formatCurrency(invoice.igstAmount)}</span>
                          </div>
                        )}

                        {Number(invoice.roundOff || 0) !== 0 && (
                          <div className="flex justify-between items-center text-zinc-500 pt-1 border-t border-zinc-200 text-[11px]">
                            <span>Round Off:</span>
                            <span className="font-mono">{formatCurrency(invoice.roundOff)}</span>
                          </div>
                        )}

                        {/* Grand Total */}
                        <div className="flex justify-between items-center pt-2 border-t-2 border-zinc-900 text-sm">
                          <span className="font-black text-zinc-950 uppercase">Grand Total:</span>
                          <span className="font-black font-mono text-base text-zinc-950">{formatCurrency(invoice.totalAmount)}</span>
                        </div>

                        {Number(invoice.amountPaid || 0) > 0 && (
                          <div className="flex justify-between items-center text-xs text-emerald-700 font-semibold pt-0.5">
                            <span>Amount Paid:</span>
                            <span className="font-mono">{formatCurrency(invoice.amountPaid)}</span>
                          </div>
                        )}

                        {Number(invoice.balanceDue || 0) > 0 && Number(invoice.amountPaid || 0) > 0 && (
                          <div className="flex justify-between items-center text-xs text-red-600 font-bold bg-red-50 p-1.5 rounded mt-1">
                            <span>Balance Due:</span>
                            <span className="font-mono">{formatCurrency(invoice.balanceDue)}</span>
                          </div>
                        )}
                      </div>

                      {/* Authorized Signatory Box */}
                      <div className="p-3 border border-dashed border-zinc-300 rounded-lg text-center space-y-6 bg-white">
                        <div className="text-[10px] font-bold text-zinc-600 uppercase">For {sellerName}</div>
                        <div className="border-t border-zinc-200 pt-1 text-[10px] text-zinc-400 font-medium">Authorized Signatory</div>
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
