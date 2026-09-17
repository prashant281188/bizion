'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import React, { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  approved: 'bg-blue-100 text-blue-700',
  shipped: 'bg-amber-100 text-amber-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function DispatchPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dispatch, setDispatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  
  const resolvedParams = use(params);

  useEffect(() => {
    const fetchDispatch = async () => {
      try {
        const res = await api.get(`/dispatches/${resolvedParams.id}`);
        setDispatch(res.data?.data);
      } catch (err) {
        toast.error('Failed to load dispatch details');
      } finally {
        setLoading(false);
      }
    };
    fetchDispatch();
  }, [resolvedParams.id]);

  useEffect(() => {
    if (dispatch && searchParams.get('print') === 'true') {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [dispatch, searchParams]);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 100);
  };

  if (loading) {
    return <div className="p-6 animate-pulse"><div className="h-10 bg-zinc-100 rounded-lg w-1/3 mb-6" /></div>;
  }

  if (!dispatch) {
    return <div className="p-6 text-center text-zinc-500">Dispatch not found.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Actions - hidden when printing */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>&larr; Back</Button>
          <h1 className="text-2xl font-bold text-zinc-900">Dispatch #{dispatch.dispatchNumber}</h1>
          <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${STATUS_BADGE[dispatch.status] || STATUS_BADGE.draft}`}>
            {dispatch.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {dispatch.invoiceId && (
            <Button variant="outline" onClick={() => router.push(`/dashboard/invoices/${dispatch.invoiceId}/edit`)} className="border-amber-200 text-amber-700 hover:bg-amber-50">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Invoice
            </Button>
          )}
          <Button onClick={handlePrint} className="bg-amber-600 hover:bg-amber-700 text-white">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Challan
          </Button>
        </div>
      </div>

      {/* Printable Area */}
      <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 border overflow-hidden">
        <CardContent className="p-8 print:p-0">
        <div className="flex justify-between items-start border-b border-zinc-200 pb-6 mb-6">
          <div>
            <h2 className="text-3xl font-bold text-amber-700 mb-1">DELIVERY CHALLAN</h2>
            <p className="text-zinc-500 font-medium">No: {dispatch.dispatchNumber}</p>
            <p className="text-zinc-500 text-sm">Date: {new Date(dispatch.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <h3 className="font-semibold text-zinc-900 text-lg">Ship To</h3>
            <p className="text-zinc-700 font-medium mt-1">{dispatch.contactName}</p>
            {dispatch.contactPhone && <p className="text-zinc-600 text-sm">{dispatch.contactPhone}</p>}
            {dispatch.contactEmail && <p className="text-zinc-600 text-sm">{dispatch.contactEmail}</p>}
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Related Orders</h4>
          <p className="text-zinc-900 font-medium">{dispatch.orderNumbers || 'Standalone Dispatch'}</p>
        </div>

        <Table className="min-w-full text-left text-sm text-zinc-600">
          <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
            <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
              <TableHead className="px-4 py-3 font-semibold">Order #</TableHead>
              <TableHead className="px-4 py-3 font-semibold">Item Description</TableHead>
              <TableHead className="px-4 py-3 font-semibold">SKU</TableHead>
              <TableHead className="px-4 py-3 font-semibold text-right">Rate</TableHead>
              <TableHead className="px-4 py-3 font-semibold text-center">Dispatch Qty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-zinc-100">
            {dispatch.items?.map((item: any, idx: number) => (
              <TableRow key={idx} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                <TableCell className="px-4 py-3 font-mono text-xs font-bold text-zinc-900">
                  {item.orderNumber || (dispatch.orderNumber ? dispatch.orderNumber : '—')}
                </TableCell>
                <TableCell className="px-4 py-3 font-medium text-zinc-900">
                  {item.variantName || item.productName}
                </TableCell>
                <TableCell className="px-4 py-3 text-zinc-500 text-xs">{item.sku || 'N/A'}</TableCell>
                <TableCell className="px-4 py-3 text-right text-zinc-600">₹{Number(item.unitPrice).toFixed(2)}</TableCell>
                <TableCell className="px-4 py-3 text-center font-semibold text-zinc-900">{item.quantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex justify-between items-end mt-12 pt-12 border-t border-zinc-200">
          <div className="text-sm text-zinc-500">
            <p>Subject to terms and conditions.</p>
            <p>Goods once sold cannot be returned.</p>
          </div>
          <div className="text-center w-48">
            <div className="border-b border-zinc-400 pb-8 mb-2"></div>
            <p className="text-sm font-medium text-zinc-700">Authorized Signatory</p>
          </div>
        </div>
        </CardContent>
      </Card>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A5; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}} />
    </div>
  );
}
