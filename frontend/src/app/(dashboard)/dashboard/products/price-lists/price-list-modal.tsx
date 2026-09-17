"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";

interface PriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  priceList?: any;
}

export function PriceListModal({ isOpen, onClose, priceList }: PriceListModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("sales");
  const [currency, setCurrency] = useState("INR");
  const [description, setDescription] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    if (priceList) {
      setName(priceList.name || "");
      setType(priceList.type || "sales");
      setCurrency(priceList.currency || "INR");
      setDescription(priceList.description || "");
    } else {
      setName("");
      setType("sales");
      setCurrency("INR");
      setDescription("");
    }
  }, [priceList, isOpen]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (priceList?.id) {
        return api.put(`/pricing/lists/${priceList.id}`, data);
      }
      return api.post('/pricing/lists', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-lists"] });
      toast.success(`Price list ${priceList ? "updated" : "created"} successfully`);
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to save price list");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    mutation.mutate({ name, type, currency, description });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6 shadow-xl border border-zinc-200/80">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-zinc-900">{priceList ? "Edit Price List Master" : "Create Price List Master"}</DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            {priceList ? "Update price list tier rules and details." : "Add a new price list master to manage custom pricing tiers."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Price List Name *</label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Retail, Wholesale Tier 1"
              required
              className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">List Type</label>
              <Select value={type} onChange={(e) => setType(e.target.value)} className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl">
                <option value="sales">Sales (Customer)</option>
                <option value="purchase">Purchase (Vendor)</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Currency Code</label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="INR"
                className="h-9 text-xs font-mono uppercase bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Description / Notes</label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Applicable for South region distributors"
              className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
            />
          </div>

          <DialogFooter className="pt-3 border-t border-zinc-100 flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending} className="text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 rounded-xl shadow-sm">
              {mutation.isPending ? "Saving..." : priceList ? "Update Price List" : "Save Price List"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
