'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';

interface PriceRevision {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string | null;
  variantName: string | null;
  oldCostPrice: string;
  newCostPrice: string;
  sellingPrice: string;
  createdAt: string;
}

export default function PriceRevisionsPage() {
  const [revisions, setRevisions] = useState<PriceRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [newSellingPrices, setNewSellingPrices] = useState<Record<string, string>>({});

  const fetchRevisions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/products/price-revisions');
      setRevisions(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch price revisions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevisions();
  }, []);

  const handlePriceChange = (id: string, value: string) => {
    setNewSellingPrices(prev => ({ ...prev, [id]: value }));
  };

  const handleUpdateSellingPrice = async (revision: PriceRevision) => {
    const newPrice = newSellingPrices[revision.id];
    if (!newPrice) {
      toast.error('Please enter a valid price');
      return;
    }

    try {
      setUpdatingId(revision.id);
      
      if (revision.variantId) {
        // Update variant (Requires updating the whole product typically, let's just use the product PUT endpoint)
        const productRes = await api.get(`/products/${revision.productId}`);
        const product = productRes.data.data;
        const updatedVariants = product.variants.map((v: any) => 
           v.id === revision.variantId ? { ...v, sellingPrice: newPrice } : v
        );
        
        await api.put(`/products/${revision.productId}`, {
          ...product,
          variants: updatedVariants
        });
      } else {
        // Update product
        const productRes = await api.get(`/products/${revision.productId}`);
        const product = productRes.data.data;
        
        await api.put(`/products/${revision.productId}`, {
          ...product,
          sellingPrice: newPrice
        });
      }

      toast.success('Selling price updated successfully');
      // Remove from list or refresh
      setRevisions(prev => prev.filter(r => r.id !== revision.id));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update selling price');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-lg font-medium text-destructive">{error}</p>
        <Button onClick={fetchRevisions} variant="outline">Try Again</Button>
      </div>
    );
  }

  return (
    <PageContainer className="max-w-full space-y-6">
      <PageHeader 
        title="Purchase Price Revisions Audit" 
        subtitle="Track products whose supplier purchase costs have recently changed and update selling price markups." 
      />

      <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
        {revisions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-2">
            <p className="text-base font-bold text-zinc-900">No Pending Purchase Cost Revisions</p>
            <p className="text-xs text-zinc-500 max-w-sm">All product selling price markups are synchronized with recent purchase costs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-full text-left text-xs text-zinc-700">
              <TableHeader className="bg-zinc-50/80 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <TableRow className="border-b border-zinc-100">
                  <TableHead className="px-4 py-3.5 font-bold">Product / Variant Name</TableHead>
                  <TableHead className="px-4 py-3.5 font-bold">Revision Date</TableHead>
                  <TableHead className="px-4 py-3.5 font-bold text-right">Old Cost (₹)</TableHead>
                  <TableHead className="px-4 py-3.5 font-bold text-right">New Cost (₹)</TableHead>
                  <TableHead className="px-4 py-3.5 font-bold text-right">Current Selling Rate</TableHead>
                  <TableHead className="px-4 py-3.5 font-bold text-center w-36">New Selling Rate</TableHead>
                  <TableHead className="px-4 py-3.5 font-bold text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-zinc-100">
                {revisions.map((rev) => {
                  const oldCost = Number(rev.oldCostPrice);
                  const newCost = Number(rev.newCostPrice);
                  const isIncrease = newCost > oldCost;
                  
                  return (
                    <TableRow key={rev.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/60">
                      <TableCell className="px-4 py-3.5">
                        <span className="font-bold text-xs text-zinc-900">{rev.productName}</span>
                        {rev.variantName && <span className="text-zinc-500 text-xs ml-1">({rev.variantName})</span>}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-zinc-500 font-mono text-[11px]">
                        {formatDate(rev.createdAt)}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-right font-mono text-zinc-600">₹{oldCost.toFixed(2)}</TableCell>
                      <TableCell className="px-4 py-3.5 text-right">
                        <span className={`inline-flex items-center justify-end gap-1 font-mono font-bold text-xs ${isIncrease ? 'text-red-700' : 'text-emerald-700'}`}>
                          ₹{newCost.toFixed(2)}
                          <ArrowRight className={`h-3 w-3 ${isIncrease ? '-rotate-45 text-red-600' : 'rotate-45 text-emerald-600'}`} />
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-right font-mono font-bold text-zinc-900">₹{Number(rev.sellingPrice).toFixed(2)}</TableCell>
                      <TableCell className="px-4 py-3.5">
                        <Input 
                          type="number"
                          placeholder={rev.sellingPrice}
                          value={newSellingPrices[rev.id] || ''}
                          onChange={(e) => handlePriceChange(rev.id, e.target.value)}
                          className="w-32 h-8 text-center font-mono font-bold text-xs bg-white border-zinc-200"
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-right">
                        <Button 
                          size="sm" 
                          disabled={updatingId === rev.id || !newSellingPrices[rev.id]}
                          onClick={() => handleUpdateSellingPrice(rev)}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 px-4 rounded-xl shadow-sm"
                        >
                          {updatingId === rev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Update Rate'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
