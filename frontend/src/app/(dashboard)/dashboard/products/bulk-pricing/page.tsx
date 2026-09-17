"use client";

import React, { useState, useMemo } from "react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Calculator, 
  Search, 
  Save, 
  RefreshCw, 
  ArrowUpRight, 
  Percent, 
  Sparkles, 
  Filter, 
  CheckSquare, 
  Square,
  AlertCircle,
  Loader2,
  Check
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

interface PriceItem {
  id: string;
  productId: string;
  variantId: string | null;
  isVariant: boolean;
  name: string;
  sku: string | null;
  barcode: string | null;
  categoryName: string;
  brandName: string;
  categoryId: string | null;
  brandId: string | null;
  valuationCost: number;
  sellingPrice: number;
  mrp: number;
  boxQuantity: number;
}

export default function BulkPriceEditorPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  // Local modified state mapping { itemKey: { valuationCost, sellingPrice, mrp } }
  const [editedPrices, setEditedPrices] = useState<Record<string, { valuationCost: number; sellingPrice: number; mrp: number }>>({});
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Batch Formula Tools
  const [costAdjustPercent, setCostAdjustPercent] = useState<string>("");
  const [sellingMarginPercent, setSellingMarginPercent] = useState<string>("25");
  const [mrpMarkupPercent, setMrpMarkupPercent] = useState<string>("50");

  // Fetch items
  const { data: items = [], isLoading, refetch } = useQuery<PriceItem[]>({
    queryKey: ["bulk-pricing-items", selectedBrandId, selectedCategoryId, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (selectedBrandId !== "all") params.set("brandId", selectedBrandId);
      if (selectedCategoryId !== "all") params.set("categoryId", selectedCategoryId);

      const res = await api.get(`/products/bulk-pricing?${params.toString()}`);
      return res.data?.data || [];
    },
  });

  // Fetch Master Brands & Categories for filter
  const { data: brands = [] } = useQuery({
    queryKey: ["masters-brands"],
    queryFn: async () => {
      const res = await api.get("/masters/brands?limit=500");
      return res.data?.data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["masters-categories"],
    queryFn: async () => {
      const res = await api.get("/masters/categories?limit=500");
      return res.data?.data || [];
    },
  });

  // Bulk Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const productUpdates: any[] = [];
      const variantUpdates: any[] = [];

      Object.entries(editedPrices).forEach(([itemId, prices]) => {
        const item = items.find((i) => i.id === itemId);
        if (!item) return;

        if (item.isVariant && item.variantId) {
          variantUpdates.push({
            id: item.variantId,
            productId: item.productId,
            valuationCost: prices.valuationCost,
            sellingPrice: prices.sellingPrice,
            mrp: prices.mrp,
          });
        } else {
          productUpdates.push({
            id: item.productId,
            valuationCost: prices.valuationCost,
            sellingPrice: prices.sellingPrice,
            mrp: prices.mrp,
          });
        }
      });

      const res = await api.patch("/products/bulk-pricing", {
        productUpdates,
        variantUpdates,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Pricing updated successfully!");
      setEditedPrices({});
      queryClient.invalidateQueries({ queryKey: ["bulk-pricing-items"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["price-revisions"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to update prices");
    },
  });

  const handlePriceChange = (id: string, field: "valuationCost" | "sellingPrice" | "mrp", value: number) => {
    const currentItem = items.find((i) => i.id === id);
    if (!currentItem) return;

    setEditedPrices((prev) => {
      const existing = prev[id] || {
        valuationCost: currentItem.valuationCost,
        sellingPrice: currentItem.sellingPrice,
        mrp: currentItem.mrp,
      };
      return {
        ...prev,
        [id]: {
          ...existing,
          [field]: Number(value) || 0,
        },
      };
    });
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === items.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(items.map((i) => i.id)));
    }
  };

  // Batch action: Apply Margin % over Purchase Cost to derive Selling Price
  const applyMarginToSelected = () => {
    const margin = Number(sellingMarginPercent);
    if (isNaN(margin)) {
      toast.error("Please enter a valid margin percentage");
      return;
    }

    const targetIds = selectedItemIds.size > 0 ? Array.from(selectedItemIds) : items.map((i) => i.id);
    if (targetIds.length === 0) {
      toast.error("No items available to apply formula");
      return;
    }

    setEditedPrices((prev) => {
      const next = { ...prev };
      targetIds.forEach((id) => {
        const item = items.find((i) => i.id === id);
        if (!item) return;

        const currentCost = next[id]?.valuationCost !== undefined ? next[id].valuationCost : item.valuationCost;
        const newSellingPrice = Math.round(currentCost * (1 + margin / 100));
        const currentMrp = next[id]?.mrp !== undefined ? next[id].mrp : item.mrp;

        next[id] = {
          valuationCost: currentCost,
          sellingPrice: newSellingPrice,
          mrp: currentMrp < newSellingPrice ? newSellingPrice : currentMrp,
        };
      });
      return next;
    });

    toast.success(`Calculated Selling Price (Cost + ${margin}%) on ${targetIds.length} item(s)!`);
  };

  // Batch action: Apply Markup % over Selling Price to derive Printed MRP
  const applyMrpMarkupToSelected = () => {
    const markup = Number(mrpMarkupPercent);
    if (isNaN(markup)) {
      toast.error("Please enter a valid MRP markup percentage");
      return;
    }

    const targetIds = selectedItemIds.size > 0 ? Array.from(selectedItemIds) : items.map((i) => i.id);
    if (targetIds.length === 0) {
      toast.error("No items available to apply formula");
      return;
    }

    setEditedPrices((prev) => {
      const next = { ...prev };
      targetIds.forEach((id) => {
        const item = items.find((i) => i.id === id);
        if (!item) return;

        const currentCost = next[id]?.valuationCost !== undefined ? next[id].valuationCost : item.valuationCost;
        const currentSelling = next[id]?.sellingPrice !== undefined ? next[id].sellingPrice : item.sellingPrice;
        const newMrp = Math.round(currentSelling * (1 + markup / 100));

        next[id] = {
          valuationCost: currentCost,
          sellingPrice: currentSelling,
          mrp: newMrp,
        };
      });
      return next;
    });

    toast.success(`Calculated Printed MRP (Selling Price + ${markup}%) on ${targetIds.length} item(s)!`);
  };

  // Batch action: Adjust Purchase Cost by % (e.g. +5% supplier hike)
  const applyCostAdjustmentToSelected = () => {
    const adj = Number(costAdjustPercent);
    if (isNaN(adj) || adj === 0) {
      toast.error("Please enter a non-zero percentage");
      return;
    }

    const targetIds = selectedItemIds.size > 0 ? Array.from(selectedItemIds) : items.map((i) => i.id);
    if (targetIds.length === 0) {
      toast.error("No items available to apply formula");
      return;
    }

    setEditedPrices((prev) => {
      const next = { ...prev };
      targetIds.forEach((id) => {
        const item = items.find((i) => i.id === id);
        if (!item) return;

        const baseCost = next[id]?.valuationCost !== undefined ? next[id].valuationCost : item.valuationCost;
        const newCost = Math.round(baseCost * (1 + adj / 100) * 100) / 100;
        const currentSelling = next[id]?.sellingPrice !== undefined ? next[id].sellingPrice : item.sellingPrice;
        const currentMrp = next[id]?.mrp !== undefined ? next[id].mrp : item.mrp;

        next[id] = {
          valuationCost: newCost,
          sellingPrice: currentSelling,
          mrp: currentMrp,
        };
      });
      return next;
    });

    toast.success(`Adjusted purchase cost by ${adj}% on ${targetIds.length} item(s)!`);
  };

  const modifiedCount = Object.keys(editedPrices).length;

  return (
    <PageContainer className="max-w-full">
      <PageHeader
        title="Bulk Price Revision Editor"
        subtitle="Quickly adjust purchase costs, selling prices, and MRP with batch formulas in 1-click."
      >
        <div className="flex items-center gap-2">
          {modifiedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditedPrices({})}
              disabled={saveMutation.isPending}
              className="text-xs rounded-xl"
            >
              Reset ({modifiedCount})
            </Button>
          )}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={modifiedCount === 0 || saveMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-xs"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            Save Changes {modifiedCount > 0 ? `(${modifiedCount})` : ""}
          </Button>
        </div>
      </PageHeader>

      {/* Formula & Batch Action Bar */}
      <Card className="mt-4 border-amber-200/80 bg-gradient-to-r from-amber-50/60 via-amber-50/20 to-white shadow-xs">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-600 text-white font-bold text-xs">
                <Percent className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Formula Tools:</span>
            </div>

            {/* Cost Adjustment */}
            <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-zinc-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-zinc-600 pl-1.5">Supplier Cost:</span>
              <Input
                type="number"
                placeholder="+5"
                value={costAdjustPercent}
                onChange={(e) => setCostAdjustPercent(e.target.value)}
                className="w-14 h-7 text-xs font-mono font-bold bg-zinc-50 border-zinc-200 rounded-lg text-center"
              />
              <span className="text-xs font-bold text-zinc-500">%</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={applyCostAdjustmentToSelected}
                className="h-7 text-xs px-2 rounded-lg font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800"
              >
                Apply Cost
              </Button>
            </div>

            {/* Selling Price / Margin */}
            <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-zinc-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-zinc-600 pl-1.5">Selling Price = Cost +</span>
              <Input
                type="number"
                placeholder="25"
                value={sellingMarginPercent}
                onChange={(e) => setSellingMarginPercent(e.target.value)}
                className="w-14 h-7 text-xs font-mono font-bold bg-zinc-50 border-zinc-200 rounded-lg text-center text-amber-900"
              />
              <span className="text-xs font-bold text-zinc-500">%</span>
              <Button
                size="sm"
                onClick={applyMarginToSelected}
                className="h-7 text-xs px-2.5 rounded-lg font-bold bg-amber-600 hover:bg-amber-700 text-white"
              >
                Set Selling Price
              </Button>
            </div>

            {/* MRP Markup */}
            <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-zinc-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-zinc-600 pl-1.5">MRP = Selling Price +</span>
              <Input
                type="number"
                placeholder="20"
                value={mrpMarkupPercent}
                onChange={(e) => setMrpMarkupPercent(e.target.value)}
                className="w-14 h-7 text-xs font-mono font-bold bg-zinc-50 border-zinc-200 rounded-lg text-center text-blue-900"
              />
              <span className="text-xs font-bold text-zinc-500">%</span>
              <Button
                size="sm"
                variant="outline"
                onClick={applyMrpMarkupToSelected}
                className="h-7 text-xs px-2.5 rounded-lg font-bold border-zinc-300 hover:bg-zinc-100 text-zinc-800"
              >
                Set MRP
              </Button>
            </div>
          </div>

          <div className="text-xs font-semibold text-zinc-500">
            {selectedItemIds.size > 0
              ? `${selectedItemIds.size} of ${items.length} items selected`
              : `Applies to all ${items.length} listed items`}
          </div>
        </CardContent>
      </Card>

      {/* Filters & Items Table */}
      <Card className="mt-4 border-zinc-200 shadow-xs">
        <CardContent className="p-0">
          <div className="p-4 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by product name, variant, or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
                />
              </div>

              {/* Brand Filter */}
              <select
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
                className="h-9 text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 text-zinc-700 font-medium focus:outline-none"
              >
                <option value="all">All Brands</option>
                {brands.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="h-9 text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 text-zinc-700 font-medium focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-9 text-xs rounded-xl"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/70">
                <TableHead className="w-10 text-center">
                  <button onClick={toggleSelectAll} className="text-zinc-600 hover:text-zinc-900">
                    {selectedItemIds.size === items.length && items.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="text-xs font-bold uppercase text-zinc-600">Product / Item Code</TableHead>
                <TableHead className="text-xs font-bold uppercase text-zinc-600">Brand / Category</TableHead>
                <TableHead className="text-xs font-bold uppercase text-zinc-600 w-36">Purchase Cost (₹)</TableHead>
                <TableHead className="text-xs font-bold uppercase text-amber-800 w-36">Selling Price (₹)</TableHead>
                <TableHead className="text-xs font-bold uppercase text-blue-800 w-36">Printed MRP (₹)</TableHead>
                <TableHead className="text-xs font-bold uppercase text-zinc-600 w-28 text-right">Margin %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    <TableCell><div className="h-4 w-4 bg-zinc-100 animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-8 w-48 bg-zinc-100 animate-pulse rounded-lg" /></TableCell>
                    <TableCell><div className="h-6 w-32 bg-zinc-100 animate-pulse rounded-lg" /></TableCell>
                    <TableCell><div className="h-8 w-28 bg-zinc-100 animate-pulse rounded-lg" /></TableCell>
                    <TableCell><div className="h-8 w-28 bg-zinc-100 animate-pulse rounded-lg" /></TableCell>
                    <TableCell><div className="h-8 w-28 bg-zinc-100 animate-pulse rounded-lg" /></TableCell>
                    <TableCell><div className="h-6 w-16 bg-zinc-100 animate-pulse rounded-lg ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-36 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <AlertCircle className="w-6 h-6 text-zinc-300" />
                      <p className="text-sm font-semibold text-zinc-600">No products found</p>
                      <p className="text-xs text-zinc-400">Try adjusting your brand/category filters or search term.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  const isEdited = !!editedPrices[item.id];
                  const currentCost = editedPrices[item.id]?.valuationCost !== undefined ? editedPrices[item.id].valuationCost : item.valuationCost;
                  const currentSelling = editedPrices[item.id]?.sellingPrice !== undefined ? editedPrices[item.id].sellingPrice : item.sellingPrice;
                  const currentMrp = editedPrices[item.id]?.mrp !== undefined ? editedPrices[item.id].mrp : item.mrp;

                  const marginPct = currentCost > 0 ? Math.round(((currentSelling - currentCost) / currentCost) * 100) : 0;

                  return (
                    <TableRow
                      key={item.id}
                      className={`transition-colors ${
                        isEdited ? "bg-amber-50/40 hover:bg-amber-50/60" : "hover:bg-zinc-50/60"
                      }`}
                    >
                      <TableCell className="text-center">
                        <button onClick={() => toggleSelectItem(item.id)}>
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-300" />
                          )}
                        </button>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 text-xs">{item.name}</span>
                          <span className="text-[10px] font-mono text-zinc-400">
                            {item.sku || "NO-SKU"} {item.isVariant ? "• Variant" : ""}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                            {item.brandName}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-medium">
                            {item.categoryName}
                          </span>
                        </div>
                      </TableCell>

                      {/* Purchase Cost Input */}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-zinc-400">₹</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={currentCost ?? 0}
                            onChange={(e) => handlePriceChange(item.id, "valuationCost", Number(e.target.value))}
                            className={`h-8 text-xs font-mono font-bold rounded-lg ${
                              editedPrices[item.id]?.valuationCost !== undefined && editedPrices[item.id].valuationCost !== item.valuationCost
                                ? "bg-amber-100/70 border-amber-400 text-amber-950 ring-1 ring-amber-400"
                                : "bg-zinc-50 border-zinc-200 text-zinc-900"
                            }`}
                          />
                        </div>
                      </TableCell>

                      {/* Selling Price Input */}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-amber-600">₹</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={currentSelling ?? 0}
                            onChange={(e) => handlePriceChange(item.id, "sellingPrice", Number(e.target.value))}
                            className={`h-8 text-xs font-mono font-bold rounded-lg ${
                              editedPrices[item.id]?.sellingPrice !== undefined && editedPrices[item.id].sellingPrice !== item.sellingPrice
                                ? "bg-amber-100/70 border-amber-400 text-amber-950 ring-1 ring-amber-400"
                                : "bg-amber-50/40 border-amber-200 text-amber-950"
                            }`}
                          />
                        </div>
                      </TableCell>

                      {/* Printed MRP Input */}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-blue-600">₹</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={currentMrp ?? 0}
                            onChange={(e) => handlePriceChange(item.id, "mrp", Number(e.target.value))}
                            className={`h-8 text-xs font-mono font-bold rounded-lg ${
                              editedPrices[item.id]?.mrp !== undefined && editedPrices[item.id].mrp !== item.mrp
                                ? "bg-blue-100/70 border-blue-400 text-blue-950 ring-1 ring-blue-400"
                                : "bg-blue-50/30 border-blue-200 text-blue-950"
                            }`}
                          />
                        </div>
                      </TableCell>

                      {/* Margin Badge */}
                      <TableCell className="text-right">
                        <span
                          className={`inline-block text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            marginPct > 0
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-red-50 text-red-800 border border-red-200"
                          }`}
                        >
                          {marginPct > 0 ? `+${marginPct}%` : `${marginPct}%`}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
