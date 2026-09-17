'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import type { Product } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { DataTable, type TableHeader as DataTableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Drawer } from '@/components/ui/drawer';
import { History, Eye, Edit, Trash2, Package, Tag, Layers, AlertTriangle, Plus, Search, DollarSign } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useCategories, useBrands } from '@/hooks/useMasters';
import dynamic from 'next/dynamic';

const BulkImportModal = dynamic(() => import('@/components/products/bulk-import-modal').then(mod => mod.BulkImportModal), { ssr: false });

interface FlatRow {
  id: string;
  variantId?: string;
  name: string;
  variantName?: string;
  categoryName?: string;
  brandName?: string;
  hsnCode?: string;
  type: Product['type'];
  sku: string;
  barcode: string;
  sellingPrice: string;
  stockQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  status: Product['status'];
  hasVariants: boolean;
  uomCode?: string;
  costPrice: string;
  mrp: string;
  rawProduct: Product;
  rawVariant?: any;
}

export default function ProductsPage() {
  const router = useRouter();
  const [showPurchasePrice, setShowPurchasePrice] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  const tableHeaders: DataTableHeader[] = [
    { key: 'name', label: 'Product & Catalog Info', sortable: true },
    { key: 'type', label: 'Type', className: 'hidden md:table-cell' },
    { key: 'sku', label: 'SKU & Barcode', sortable: true, className: 'hidden md:table-cell' },
    ...(showPurchasePrice ? [{ key: 'costPrice', label: 'Purchase Price', sortable: true }] : []),
    { key: 'sellingPrice', label: 'Selling Price', sortable: true },
    { key: 'mrp', label: 'MRP', sortable: true },
    { key: 'stockQuantity', label: 'Inventory Stock' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', align: 'right' },
  ];

  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();

  // Filters State
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  const [localError, setLocalError] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const { data: productsData, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['products', { search: debouncedSearch, categoryId: selectedCategory, brandId: selectedBrand, type: selectedType, status: selectedStatus, sortBy, sortOrder, page, limit }],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        limit,
        sortBy,
        sortOrder,
        flattenVariants: true,
      };
      if (debouncedSearch) params.q = debouncedSearch;
      if (selectedCategory) params.categoryId = selectedCategory;
      if (selectedBrand) params.brandId = selectedBrand;
      if (selectedType) params.type = selectedType;
      if (selectedStatus) params.status = selectedStatus;

      const res = await api.get('/products', { params });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const productsList = productsData?.data || [];
  const displayError = localError || (queryError ? (queryError as any).response?.data?.message || 'Failed to retrieve product list' : null);

  const stats = useMemo(() => {
    const totalCount = productsData?.pagination?.total || productsList.length;
    const inStock = productsList.filter((p: any) => p.trackInventory && Number(p.stockQuantity) > 0).length;
    const lowStock = productsList.filter((p: any) => p.trackInventory && Number(p.stockQuantity) <= (p.lowStockThreshold || 5)).length;
    const valuation = productsList.reduce((sum: number, p: any) => sum + (Number(p.sellingPrice || 0) * (p.stockQuantity || 0)), 0);
    return { totalCount, inStock, lowStock, valuation };
  }, [productsList, productsData]);

  // Details Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { user } = useAuth();
  const roleHierarchy: Record<string, number> = {
    viewer: 0,
    agent: 1,
    accountant: 2,
    manager: 3,
    admin: 4,
    owner: 5,
  };
  const userRoleLevel = user?.role ? roleHierarchy[user.role] || 0 : 0;
  const canCreate = userRoleLevel >= 3;
  const canEdit = userRoleLevel >= 3;
  const canDelete = userRoleLevel >= 3;

  // Price History states
  const [historyVariant, setHistoryVariant] = useState<any>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  const [deleteConfirmProductId, setDeleteConfirmProductId] = useState<string | null>(null);

  const handleViewPriceHistory = async (entity: any, isVariant: boolean = true) => {
    setHistoryVariant({ ...entity, _isVariant: isVariant });
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const endpoint = isVariant 
        ? `/products/variants/${entity.id}/price-history`
        : `/products/${entity.id}/price-history`;
      const res = await api.get(endpoint);
      setPriceHistory(res.data.data);
    } catch (err) {
      console.error('Error fetching price history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const promptDeleteProduct = (id: string) => {
    setDeleteConfirmProductId(id);
  };

  const executeDeleteProduct = async () => {
    if (!deleteConfirmProductId) return;

    try {
      setLocalError(null);
      await api.delete(`/products/${deleteConfirmProductId}`);
      setDeleteConfirmProductId(null);
      refetch();
    } catch (err: any) {
      setLocalError(err.response?.data?.message || 'Failed to delete product');
    }
  };

  const handleOpenDetails = async (p: Product) => {
    try {
      setDetailsLoading(true);
      setLocalError(null);
      const res = await api.get(`/products/${p.id}`);
      setSelectedProduct(res.data.data);
      setDetailsOpen(true);
    } catch (err: any) {
      setLocalError(err.response?.data?.message || 'Failed to retrieve product details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const paginatedRows = productsList;
  const totalPages = productsData?.pagination?.totalPages || 1;
  const total = productsData?.pagination?.total || 0;

  return (
    <PageContainer className="max-w-full space-y-6">
      <PageHeader
        title="Product Directory Workspace"
        subtitle="Manage your entire multi-tenant catalog, inventory tracking, pricing, and variants."
      >
        {canCreate && (
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setIsBulkImportOpen(true)}
              className="border-zinc-200 text-xs font-semibold bg-zinc-50"
            >
              <Package className="w-4 h-4 mr-2 text-zinc-500" />
              Bulk Import
            </Button>
            <Link href="/dashboard/products/new">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add New Product
              </Button>
            </Link>
          </div>
        )}
      </PageHeader>

      {displayError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700 flex justify-between items-center font-medium">
          <span>{displayError}</span>
          <Button variant="ghost" className="text-red-700 hover:text-red-800 font-bold h-auto p-1" onClick={() => setLocalError(null)}>✕</Button>
        </div>
      )}

      {/* Catalog KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Catalog Products</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-900">{stats.totalCount}</span>
            <Package className="w-5 h-5 text-zinc-400" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">In-Stock SKUs</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-700">{stats.inStock}</span>
            <Layers className="w-5 h-5 text-emerald-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Low Stock Deficits</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-red-600">{stats.lowStock}</span>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Stock Valuation</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-amber-900">{formatCurrency(stats.valuation)}</span>
            <DollarSign className="w-5 h-5 text-amber-600" />
          </div>
        </Card>
      </div>

      {/* Filter Control Bar */}
      <Card className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-200/80 space-y-3">
        <div className="grid gap-3 md:grid-cols-12 items-center">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <Input
              placeholder="Search product name, SKU, or barcode..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl w-full"
            />
          </div>

          <div className="md:col-span-2">
            <Select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Categories', value: '' },
                ...categories.map((c: any) => ({ label: c.name, value: c.id }))
              ]}
              className="h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl font-medium"
            />
          </div>

          <div className="md:col-span-2">
            <Select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Brands', value: '' },
                ...brands.map((b: any) => ({ label: b.name, value: b.id }))
              ]}
              className="h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl font-medium"
            />
          </div>

          <div className="md:col-span-2">
            <Select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Types', value: '' },
                { label: 'Goods', value: 'goods' },
                { label: 'Services', value: 'services' }
              ]}
              className="h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl font-medium"
            />
          </div>

          <div className="md:col-span-2">
            <Select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { label: 'All Statuses', value: '' },
                { label: 'Active', value: 'active' },
                { label: 'Draft', value: 'draft' },
                { label: 'Inactive', value: 'inactive' },
                { label: 'Archived', value: 'archived' }
              ]}
              className="h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl font-medium"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
          <label className="flex items-center space-x-2 text-xs text-zinc-600 font-semibold cursor-pointer">
            <Checkbox checked={showPurchasePrice} onCheckedChange={(val) => setShowPurchasePrice(!!val)} />
            <span>Include Purchase / Cost Price Column</span>
          </label>
        </div>
      </Card>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
        <DataTable
          headers={tableHeaders}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          isLoading={(queryLoading || detailsLoading) && productsList.length === 0}
          isEmpty={productsList.length === 0}
          emptyMessage="No products found matching active search criteria."
        >
          {paginatedRows.map((row: any) => (
            <TableRow 
              key={row.variantId ? `${row.id}-${row.variantId}` : row.id} 
              className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 group cursor-pointer"
              onDoubleClick={() => {
                if (canEdit) {
                  router.push(`/dashboard/products/${row.id}/edit`);
                } else {
                  handleOpenDetails(row.rawProduct);
                }
              }}
            >
              <TableCell className="px-4 py-3.5">
                <span className="font-bold text-xs text-zinc-900 group-hover:text-amber-600 transition-colors block">
                  {row.variantName || row.name}
                </span>
                <div className="hidden md:flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                  {row.categoryName && <span className="bg-zinc-100 px-1.5 py-0.5 rounded font-medium">{row.categoryName}</span>}
                  {row.brandName && <span>Brand: {row.brandName}</span>}
                  {row.hsnCode && <span className="font-mono text-zinc-400">HSN: {row.hsnCode}</span>}
                </div>
              </TableCell>

              <TableCell className="px-4 py-3.5 capitalize text-xs hidden md:table-cell">
                {row.type === 'goods' ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">Goods</span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded-md">Services</span>
                )}
              </TableCell>

              <TableCell className="px-4 py-3.5 font-mono text-xs hidden md:table-cell">
                <div className="text-zinc-900 font-bold">{row.sku || '—'}</div>
                {row.barcode && <div className="text-zinc-400 text-[10px]">{row.barcode}</div>}
              </TableCell>

              {showPurchasePrice && (
                <TableCell className="px-4 py-3.5 font-mono text-xs font-semibold text-zinc-700">
                  {formatCurrency(Number(row.costPrice))}
                </TableCell>
              )}

              <TableCell className="px-4 py-3.5 font-mono text-xs font-bold text-zinc-900">
                {formatCurrency(Number(row.sellingPrice))}
              </TableCell>

              <TableCell className="px-4 py-3.5 font-mono text-xs font-semibold text-zinc-500">
                {formatCurrency(Number(row.mrp))}
              </TableCell>

              <TableCell className="px-4 py-3.5">
                {!row.trackInventory ? (
                  <span className="text-zinc-400 text-xs italic">Untracked</span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold font-mono text-xs ${Number(row.stockQuantity) <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {row.stockQuantity}
                    </span>
                    {row.uomCode && <span className="text-[10px] text-zinc-400 font-medium">{row.uomCode}</span>}
                  </div>
                )}
              </TableCell>

              <TableCell className="px-4 py-3.5">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                  row.status === 'active'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : row.status === 'draft'
                    ? 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                  <span className="capitalize">{row.status}</span>
                </span>
              </TableCell>

              <TableCell className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg hover:bg-zinc-100"
                  onClick={() => handleViewPriceHistory(row.hasVariants ? row.rawVariant : row.rawProduct, row.hasVariants)}
                  title="Price History"
                >
                  <History className="w-3.5 h-3.5 text-zinc-500" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-zinc-100" onClick={() => handleOpenDetails(row.rawProduct)} title="View Details">
                  <Eye className="w-3.5 h-3.5 text-zinc-500" />
                </Button>
                {canEdit && (
                  <Link href={`/dashboard/products/${row.id}/edit`}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-zinc-100" title="Edit Product">
                      <Edit className="w-3.5 h-3.5 text-zinc-500" />
                    </Button>
                  </Link>
                )}
                {canDelete && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-red-50 hover:text-red-600" onClick={() => promptDeleteProduct(row.id)} title="Delete Product">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </div>

      {/* Pagination Controls */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
      />

      {/* Slide-out Overlay for Product Details */}
      <Drawer
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title={selectedProduct?.name || ''}
        subtitle={selectedProduct ? `Product ID: ${selectedProduct.id}` : ''}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetailsOpen(false)}>Close</Button>
            {canEdit && selectedProduct && (
              <Link href={`/dashboard/products/${selectedProduct.id}/edit`}>
                <Button>Edit Product</Button>
              </Link>
            )}
          </>
        }
      >
        {selectedProduct && (
          <div className="space-y-6">
            {/* General details grid */}
            <div className="grid grid-cols-2 gap-4 text-sm bg-zinc-50 p-4 rounded-xl border border-zinc-200">
              <div>
                <span className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider">Category</span>
                <span className="text-zinc-900 mt-0.5 block">{selectedProduct.category?.name || '-'}</span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider">Brand</span>
                <span className="text-zinc-900 mt-0.5 block">{selectedProduct.brand?.name || '-'}</span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider">Tax Configuration</span>
                <span className="text-zinc-900 mt-0.5 block">
                  {selectedProduct.taxRate?.name || 'Tax Free'} ({selectedProduct.taxRate?.ratePercentage || '0'}%)
                </span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider">Unit of Measurement</span>
                <span className="text-zinc-900 mt-0.5 block">{selectedProduct.uom?.name || '-'} ({selectedProduct.uom?.code})</span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider">HSN / SAC Code</span>
                <span className="text-zinc-900 mt-0.5 block">
                  {selectedProduct.hsnCode ? `${selectedProduct.hsnCode.code} — ${selectedProduct.hsnCode.description?.substring(0, 50)}` : '-'}
                </span>
              </div>
              {!selectedProduct.hasVariants && (
                <>
                  {selectedProduct.purchaseMode === 'list' && (
                    <div>
                      <span className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider">List Price</span>
                      <span className="text-zinc-900 mt-0.5 block">{formatCurrency(Number(selectedProduct.listPrice))}</span>
                    </div>
                  )}
                  <div>
                    <span className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider">Cost Price</span>
                    <span className="text-zinc-900 mt-0.5 block">{formatCurrency(Number(selectedProduct.valuationCost || selectedProduct.costPrice || 0))}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider">Selling Price</span>
                    <span className="text-zinc-900 mt-0.5 block">{formatCurrency(Number(selectedProduct.sellingPrice || 0))}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">MRP</span>
                    <span className="text-zinc-900 mt-0.5 block">{formatCurrency(Number(selectedProduct.mrp))}</span>
                  </div>
                </>
              )}
            </div>

            {/* Description */}
            {selectedProduct.description && (
              <div className="space-y-1">
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Description</span>
                <p className="text-zinc-700 text-sm leading-relaxed">{selectedProduct.description}</p>
              </div>
            )}

            {/* Images */}
            {selectedProduct.images && selectedProduct.images.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Gallery</span>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {selectedProduct.images.map((img: any) => (
                    <div key={img.id} className="relative h-20 w-20 rounded-lg border border-zinc-200 bg-zinc-50 overflow-hidden shrink-0">
                      <img src={img.url} alt={img.altText || 'Product Image'} className="h-full w-full object-cover" />
                      {img.isPrimary && (
                        <span className="absolute bottom-0 right-0 left-0 bg-amber-600/80 text-[8px] font-bold text-white text-center py-0.5">
                          Primary
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Variants Matrix */}
            <div className="space-y-3">
              <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider block">
                Variant Matrix ({selectedProduct.variants?.length || 0} combinations)
              </span>
              
              {selectedProduct.variants && selectedProduct.variants.length > 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden text-xs">
                  <Table className="min-w-full text-left text-sm text-zinc-600">
                    <TableHeader className="bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                      <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                        <TableHead className="px-4 py-3">Variant Name</TableHead>
                        <TableHead className="px-4 py-3">SKU</TableHead>
                        {selectedProduct.purchaseMode === 'list' && <TableHead className="px-4 py-3 text-right">List Price</TableHead>}
                        <TableHead className="px-4 py-3 text-right">Cost Price</TableHead>
                        <TableHead className="px-4 py-3 text-right">Selling Price</TableHead>
                        <TableHead className="px-4 py-3 text-right">MRP</TableHead>
                        <TableHead className="px-4 py-3 text-center">Packing</TableHead>
                        <TableHead className="px-4 py-3 text-center">Stock</TableHead>
                        <TableHead className="px-4 py-3 text-center">Status</TableHead>
                        <TableHead className="px-4 py-3 text-center">Price History</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-zinc-100">
                      {selectedProduct.variants.map((v: any) => (
                        <TableRow key={v.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                          <TableCell className="px-4 py-3 font-medium text-zinc-700">{v.name}</TableCell>
                          <TableCell className="px-4 py-3">{v.sku || '-'}</TableCell>
                          {selectedProduct.purchaseMode === 'list' && <TableCell className="px-4 py-3 text-right font-medium text-zinc-600">{formatCurrency(Number(v.listPrice || 0))}</TableCell>}
                          <TableCell className="px-4 py-3 text-right font-medium text-zinc-600">{formatCurrency(Number(v.valuationCost || v.costPrice || 0))}</TableCell>
                          <TableCell className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(v.sellingPrice || 0))}</TableCell>
                          <TableCell className="px-4 py-3 text-right font-semibold text-rose-400">{formatCurrency(Number(v.mrp))}</TableCell>
                          <TableCell className="px-4 py-3 text-center text-zinc-600">{v.defaultPacking || '-'}</TableCell>
                          <TableCell className="px-4 py-3 text-center font-mono">
                            {!selectedProduct.trackInventory ? (
                              <span className="text-zinc-500">Un-tracked</span>
                            ) : (
                              <span className={v.stockQuantity === 0 ? 'text-red-500 font-bold' : 'text-green-500 font-bold'}>
                                {v.stockQuantity}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            {v.isActive ? (
                              <span className="text-amber-700">Active</span>
                            ) : (
                              <span className="text-zinc-700">Inactive</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            <Button variant="ghost"
                              onClick={() => handleViewPriceHistory(v, true)}
                              className="text-xs text-amber-700 hover:text-amber-800 font-medium underline"
                            >
                              View Logs
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                  <p className="text-xs text-zinc-400 italic">No combinations configured. Product sold as single entity.</p>
                  <Button variant="ghost"
                    onClick={() => handleViewPriceHistory(selectedProduct, false)}
                    className="text-xs text-amber-700 hover:text-amber-800 font-medium underline"
                  >
                    View Price Logs
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Price History Modal */}
      {showHistoryModal && historyVariant && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-800">Price Log Timeline</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {historyVariant._isVariant ? 'Variant:' : 'Product:'} <span className="font-semibold text-amber-700">{historyVariant.name}</span> {historyVariant.sku ? `(${historyVariant.sku})` : ''}
                </p>
              </div>
              <Button variant="ghost"
                onClick={() => {
                  setShowHistoryModal(false);
                  setPriceHistory([]);
                }}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100/50 hover:text-zinc-800 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>

            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="space-y-4 w-full"><Skeleton className="h-10 w-full" /><Skeleton className="h-[400px] w-full" /></div>
                <span className="text-xs text-zinc-400">Loading pricing history logs...</span>
              </div>
            ) : priceHistory.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                No price modifications recorded.
              </div>
            ) : (
              <div className="relative border-l border-zinc-200 ml-4 pl-6 space-y-6">
                {priceHistory.map((item, idx) => (
                  <div key={item.id} className="relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-amber-500 bg-white flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-zinc-200 hover:border-zinc-700/80 transition-colors space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                          Log #{priceHistory.length - idx} {idx === 0 && <Badge className="ml-2 bg-amber-500/10 text-amber-700 border border-amber-500/20 text-[9px] uppercase px-1.5 py-0">Active</Badge>}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div className="bg-zinc-50 p-2 rounded border border-zinc-200">
                          <div className="text-[10px] uppercase text-zinc-400 font-semibold mt-1">Cost</div>
                          <div className="text-xs font-mono font-bold text-zinc-700 mt-0.5">{formatCurrency(Number(item.valuationCost))}</div>
                        </div>
                        <div className="bg-zinc-50 p-2 rounded border border-zinc-200">
                          <div className="text-[10px] text-zinc-500 font-semibold uppercase">Base Price</div>
                          <div className="text-xs font-mono font-bold text-zinc-700 mt-0.5">{formatCurrency(Number(item.basePrice))}</div>
                        </div>
                        <div className="bg-zinc-50 p-2 rounded border border-zinc-200">
                          <div className="text-[10px] uppercase text-zinc-400 font-semibold mt-1">Selling</div>
                          <div className="text-xs font-mono font-bold text-amber-700 mt-0.5">{formatCurrency(Number(item.mrp))}</div>
                        </div>
                        <div className="bg-zinc-50 p-2 rounded border border-zinc-200">
                          <div className="text-[10px] text-rose-500/80 font-semibold uppercase">MRP</div>
                          <div className="text-xs font-mono font-bold text-rose-400 mt-0.5">{formatCurrency(Number(item.mrp))}</div>
                        </div>
                      </div>

                      {item.user && (
                        <div className="text-[11px] text-zinc-500 flex items-center justify-end space-x-1.5 pt-1 border-t border-zinc-900">
                          <span>Changed by:</span>
                          <span className="font-semibold text-zinc-400">{item.user.firstName} {item.user.lastName || ''} ({item.user.email})</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-zinc-200">
              <Button
                onClick={() => {
                  setShowHistoryModal(false);
                  setPriceHistory([]);
                }}
              >
                Close Logs
              </Button>
            </div>
          </div>
        </div>
      )}

      {isBulkImportOpen && (
        <BulkImportModal 
          onClose={() => setIsBulkImportOpen(false)}
          onSuccess={() => refetch()}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirmProductId}
        onClose={() => setDeleteConfirmProductId(null)}
        onConfirm={executeDeleteProduct}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </PageContainer>
  );
}
