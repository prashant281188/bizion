"use client";

import { useState } from "react";
import { Plus, Search, FileEdit, Trash2, Calendar, List } from "lucide-react";
import Link from 'next/link';
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
import { PriceListModal } from "./price-list-modal";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import api from '@/lib/api';

// Mock data for price lists
// MOCK_PRICE_LISTS removed

export default function PriceListsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<any>(null);
  const [deleteConfirmListId, setDeleteConfirmListId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/pricing/lists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
      toast.success('Price list deleted successfully');
    },
    onError: () => toast.error('Failed to delete price list')
  });

  const handleEdit = (list: any) => {
    setSelectedList(list);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedList(null);
    setIsModalOpen(true);
  };

  const { data: priceLists = [], isLoading } = useQuery({
    queryKey: ['price-lists'],
    queryFn: async () => {
      const res = await api.get('/pricing/lists');
      return res.data?.data || [];
    }
  });
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLists = priceLists.filter(
    (list: any) =>
      list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      list.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageContainer className="max-w-full">
      <PageHeader
        title="Price Lists"
        subtitle="Manage pricing tiers and custom price lists for different customer groups."
      >
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Create Price List
          </Button>
      </PageHeader>

      <Card className="mt-6">
        <CardContent className="p-0">
          <div className="p-4 border-b flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search price lists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                Filter
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>List Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Validity Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                      <TableCell><div className="h-10 w-48 bg-zinc-100 animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-6 w-20 bg-zinc-100 animate-pulse rounded-full" /></TableCell>
                      <TableCell><div className="h-5 w-24 bg-zinc-100 animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-5 w-32 bg-zinc-100 animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-6 w-16 bg-zinc-100 animate-pulse rounded-full" /></TableCell>
                      <TableCell><div className="h-8 w-24 bg-zinc-100 animate-pulse rounded ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredLists.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                      No price lists found.
                    </TableCell>
                  </TableRow>
                ) : (
                filteredLists.map((list: any) => (
                  <TableRow key={list.id}>
                    <TableCell>
                      <div className="font-medium text-primary">{list.name}</div>
                      <div className="text-xs text-muted-foreground">{list.id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {list.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(list.itemsCount || 0).toLocaleString()} items
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span>
                          {list.validFrom} to {list.validTo || "Indefinite"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          list.status === "Active"
                            ? "default"
                            : list.status === "Draft"
                            ? "secondary"
                            : "outline"
                        }
                        className={
                          list.status === "Active"
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : ""
                        }
                      >
                        {list.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/products/price-lists/${list.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Manage Items">
                            <List className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(list)} title="Edit Details">
                          <FileEdit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteConfirmListId(list.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PriceListModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        priceList={selectedList} 
      />
      <ConfirmDialog
        isOpen={!!deleteConfirmListId}
        onClose={() => setDeleteConfirmListId(null)}
        onConfirm={() => {
          if (deleteConfirmListId) deleteMutation.mutate(deleteConfirmListId);
          setDeleteConfirmListId(null);
        }}
        title="Delete Price List"
        description="Are you sure you want to delete this price list?"
        variant="destructive"
      />
    </PageContainer>
  );
}
