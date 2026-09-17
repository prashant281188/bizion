"use client";

import { useState } from "react";
import { Plus, Search, Tag, Trash2, Calendar, FileEdit, Sparkles, Flame, Percent } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SchemeModal } from "./scheme-modal";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import api from '@/lib/api';

const PROMO_TYPE_BADGES: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  special_offer: { label: 'Special Offer', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: Sparkles },
  clearance_sale: { label: 'Clearance Sale', bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon: Flame },
  seasonal_sale: { label: 'Seasonal Sale', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: Tag },
  flash_sale: { label: 'Flash Sale', bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800', icon: Flame },
  bulk_deal: { label: 'Bulk Deal', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', icon: Tag },
  custom: { label: 'Custom Deal', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800', icon: Tag },
};

export default function PromotionalSchemesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<any>(null);
  const [deleteConfirmSchemeId, setDeleteConfirmSchemeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: schemes = [], isLoading } = useQuery({
    queryKey: ['promotional-schemes'],
    queryFn: async () => {
      const res = await api.get('/pricing/schemes');
      return res.data?.data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/pricing/schemes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotional-schemes'] });
      toast.success('Promotional Scheme deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete scheme');
    }
  });

  const handleEdit = (scheme: any) => {
    setSelectedScheme(scheme);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedScheme(null);
    setIsModalOpen(true);
  };

  const filteredSchemes = schemes.filter(
    (scheme: any) =>
      scheme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (scheme.badgeText && scheme.badgeText.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <PageContainer className="max-w-full">
      <PageHeader
        title="Promotions & Special Offers"
        subtitle="Create and manage time-limited clearance sales, brand-wise discounts, and special product promotions."
      >
        <Button onClick={handleCreate} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs">
          <Plus className="w-4 h-4 mr-1.5" />
          Create Promotion
        </Button>
      </PageHeader>

      <Card className="mt-6 border-zinc-200 shadow-xs">
        <CardContent className="p-0">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search promotions by name or badge..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
            <div className="text-xs text-zinc-500 font-semibold">
              Total Promotions: {schemes.length}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/70">
                <TableHead className="text-xs font-bold uppercase text-zinc-600">Promotion Details</TableHead>
                <TableHead className="text-xs font-bold uppercase text-zinc-600">Type & Badge</TableHead>
                <TableHead className="text-xs font-bold uppercase text-zinc-600">Discount & Scope</TableHead>
                <TableHead className="text-xs font-bold uppercase text-zinc-600">Validity Period</TableHead>
                <TableHead className="text-xs font-bold uppercase text-zinc-600">Status</TableHead>
                <TableHead className="text-right text-xs font-bold uppercase text-zinc-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    <TableCell><div className="h-10 w-48 bg-zinc-100 animate-pulse rounded-lg" /></TableCell>
                    <TableCell><div className="h-6 w-24 bg-zinc-100 animate-pulse rounded-full" /></TableCell>
                    <TableCell><div className="h-6 w-32 bg-zinc-100 animate-pulse rounded-lg" /></TableCell>
                    <TableCell><div className="h-8 w-32 bg-zinc-100 animate-pulse rounded-lg" /></TableCell>
                    <TableCell><div className="h-6 w-16 bg-zinc-100 animate-pulse rounded-full" /></TableCell>
                    <TableCell><div className="h-8 w-16 bg-zinc-100 animate-pulse rounded-lg ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredSchemes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-40 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Sparkles className="w-8 h-8 text-zinc-300" />
                      <p className="text-sm font-semibold text-zinc-600">No promotional campaigns configured</p>
                      <p className="text-xs text-zinc-400">Click &quot;Create Promotion&quot; to launch clearance sales or brand offers.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSchemes.map((scheme: any) => {
                  const now = new Date();
                  const from = new Date(scheme.validFrom);
                  const to = new Date(scheme.validTo);
                  const isUpcoming = from > now;
                  const isExpired = to < now;
                  const isActive = !isUpcoming && !isExpired && scheme.isActive;

                  const promoMeta = PROMO_TYPE_BADGES[scheme.promoType] || PROMO_TYPE_BADGES.special_offer;
                  const Icon = promoMeta.icon;

                  // Target Scope Label
                  let scopeLabel = 'Storewide (All Products)';
                  const itemsCount = (scheme.items || []).length;
                  if (scheme.appliesTo === 'specific_brands') {
                    const brandNames = (scheme.items || []).map((i: any) => i.brand?.name).filter(Boolean);
                    scopeLabel = brandNames.length > 0 ? `Brands: ${brandNames.slice(0, 2).join(', ')}${brandNames.length > 2 ? ` (+${brandNames.length - 2})` : ''}` : `Brands (${itemsCount})`;
                  } else if (scheme.appliesTo === 'specific_categories') {
                    const catNames = (scheme.items || []).map((i: any) => i.category?.name).filter(Boolean);
                    scopeLabel = catNames.length > 0 ? `Categories: ${catNames.slice(0, 2).join(', ')}${catNames.length > 2 ? ` (+${catNames.length - 2})` : ''}` : `Categories (${itemsCount})`;
                  } else if (scheme.appliesTo === 'specific_products') {
                    const prodNames = (scheme.items || []).map((i: any) => i.product?.name).filter(Boolean);
                    scopeLabel = prodNames.length > 0 ? `Products: ${prodNames.slice(0, 2).join(', ')}${prodNames.length > 2 ? ` (+${prodNames.length - 2})` : ''}` : `Products (${itemsCount})`;
                  } else if (scheme.appliesTo === 'specific_variants') {
                    scopeLabel = `Specific Variants (${itemsCount})`;
                  }

                  return (
                    <TableRow key={scheme.id} className="hover:bg-zinc-50/60 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 text-sm">{scheme.name}</span>
                          {scheme.description && (
                            <span className="text-[11px] text-zinc-400 line-clamp-1">{scheme.description}</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${promoMeta.bg} ${promoMeta.text}`}>
                            <Icon className="w-3 h-3" />
                            {promoMeta.label}
                          </span>
                          {scheme.badgeText && (
                            <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                              Tag: {scheme.badgeText}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-extrabold text-amber-900 font-mono">
                            {scheme.discountType === 'percentage' ? `${scheme.discountValue}% OFF` : `₹${scheme.discountValue} OFF`}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-medium">
                            {scopeLabel}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col text-xs text-zinc-600">
                          <span className="flex items-center gap-1 font-medium">
                            <Calendar className="w-3 h-3 text-zinc-400" />
                            {new Date(scheme.validFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            to {new Date(scheme.validTo).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        {isExpired ? (
                          <Badge variant="outline" className="text-[10px] font-bold bg-zinc-100 text-zinc-500 border-zinc-300">
                            Expired
                          </Badge>
                        ) : isUpcoming ? (
                          <Badge variant="outline" className="text-[10px] font-bold bg-blue-50 text-blue-700 border-blue-200">
                            Scheduled
                          </Badge>
                        ) : isActive ? (
                          <Badge variant="outline" className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
                            Active Now
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-bold bg-zinc-100 text-zinc-400 border-zinc-200">
                            Disabled
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(scheme)}
                            className="h-8 w-8 text-zinc-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg"
                          >
                            <FileEdit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmSchemeId(scheme.id)}
                            className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SchemeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        scheme={selectedScheme}
      />

      <ConfirmDialog
        isOpen={!!deleteConfirmSchemeId}
        onClose={() => setDeleteConfirmSchemeId(null)}
        onConfirm={() => {
          if (deleteConfirmSchemeId) {
            deleteMutation.mutate(deleteConfirmSchemeId);
            setDeleteConfirmSchemeId(null);
          }
        }}
        title="Delete Promotional Scheme"
        description="Are you sure you want to delete this promotional scheme? This will immediately remove the discount from active sales orders and invoices."
      />
    </PageContainer>
  );
}
