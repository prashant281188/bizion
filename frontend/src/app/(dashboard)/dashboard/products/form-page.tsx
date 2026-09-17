'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/types';
import { createProductSchema } from '@/schemas/product.schema';
import { ZodError } from 'zod';
import { BasicInfoTab } from './_components/tabs/basic-info-tab';
import { PricingInventoryTab } from './_components/tabs/pricing-inventory-tab';
import { SpecificationsTab } from './_components/tabs/specifications-tab';
import { VariantsTab } from './_components/tabs/variants-tab';
import { ImagesTab } from './_components/tabs/images-tab';
import { SeoTab } from './_components/tabs/seo-tab';
import { QuickCategoryModal, QuickBrandModal, QuickSupplierModal } from './_components/tabs/quick-modals';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategories, useBrands, useUoms, useTaxRates, useHsnCodes, useAttributes, useContacts } from '@/hooks/useMasters';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface FormPageProps {
  initialProduct?: Product | null;
  isEdit?: boolean;
  isModal?: boolean;
  onSuccess?: (product: any) => void;
  onCancel?: () => void;
  initialName?: string;
}

export default function ProductFormPage({ 
  initialProduct, 
  isEdit = false,
  isModal = false,
  onSuccess,
  onCancel,
  initialName = '',
}: FormPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'basic' | 'pricing' | 'specifications' | 'variants' | 'seo' | 'images'>('basic');
  
  // Masters Data
  const { data: bootstrapData, isLoading: isLoadingBootstrap } = useQuery({
    queryKey: ['masters-bootstrap'],
    queryFn: async () => {
      const res = await api.get('/masters/bootstrap');
      return res.data?.data || {};
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const categories = bootstrapData?.categories?.data || [];
  const brands = bootstrapData?.brands?.data || [];
  const units = bootstrapData?.units?.data || [];
  const taxRates = bootstrapData?.taxRates?.data || [];
  const hsnCodes = bootstrapData?.hsnCodes?.data || [];

  const { data: existingAttributes = [], isLoading: isLoadingAttrs } = useAttributes();
  const { data: allContacts = [], isLoading: isLoadingContacts } = useContacts('all');
  
  const suppliers = useMemo(() => allContacts.filter((c: any) => c.type === 'vendor' || c.type === 'both'), [allContacts]);

  // Loading states
  const loadingMasters = isLoadingBootstrap || isLoadingAttrs || isLoadingContacts;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Quick Category / Brand modal states
  const [isQuickCategoryModalOpen, setIsQuickCategoryModalOpen] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState('');
  const [quickCategoryParentId, setQuickCategoryParentId] = useState('');
  const [quickCategoryDescription, setQuickCategoryDescription] = useState('');
  const [quickCategorySaving, setQuickCategorySaving] = useState(false);
  const [quickCategoryError, setQuickCategoryError] = useState<string | null>(null);

  const [isQuickBrandModalOpen, setIsQuickBrandModalOpen] = useState(false);
  const [quickBrandName, setQuickBrandName] = useState('');
  const [quickBrandDescription, setQuickBrandDescription] = useState('');
  const [quickBrandSaving, setQuickBrandSaving] = useState(false);
  const [quickBrandError, setQuickBrandError] = useState<string | null>(null);

  // --- Form Fields State ---
  const [name, setName] = useState('');
  const [type, setType] = useState<'goods' | 'services'>('goods');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [uomId, setUomId] = useState('');
  const [taxRateId, setTaxRateId] = useState('');
  const [hsnCodeId, setHsnCodeId] = useState('');
  const [preferredSupplierId, setPreferredSupplierId] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'draft' | 'archived'>('active');

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Pricing & Inventory (Non-Variant)
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [basePrice, setBasePrice] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [costPrice, setCostPrice] = useState('0');
  const [purchaseMode, setPurchaseMode] = useState<'direct' | 'list'>('direct');
  const [discountPct, setDiscountPct] = useState('0');
  const [salesDiscountPct, setSalesDiscountPct] = useState('');
  const [marginPct, setMarginPct] = useState('');
  const [listPrice, setListPrice] = useState('0');
  const [mrp, setMrp] = useState('0');
  const [mrpMultiplier, setMrpMultiplier] = useState<'1x' | '2x' | '3x' | 'listPrice' | 'custom'>('2x');
  const [trackInventory, setTrackInventory] = useState(true);
  const [defaultPacking, setDefaultPacking] = useState('');
  const [boxQuantity, setBoxQuantity] = useState('1');
  const [openingBoxes, setOpeningBoxes] = useState('');
  const [openingLoose, setOpeningLoose] = useState('');

  const computedStockQuantity = ((parseInt(openingBoxes, 10) || 0) * (parseInt(boxQuantity, 10) || 1)) + (parseInt(openingLoose, 10) || 0);

  // Variants Flag & Attribute Builder
  const [hasVariants, setHasVariants] = useState(false);
  
  interface BuilderAttr {
    name: string;
    valuesStr: string; // e.g. "S, M, L"
  }
  const [attributesList, setAttributesList] = useState<BuilderAttr[]>([
    { name: '', valuesStr: '' }
  ]);

  // Compiled Variants list
  interface FormVariant {
    id?: string;
    clientKey?: string; // transient key to link images before database UUID generation
    name: string;
    sku: string;
    barcode?: string;
    categoryId?: string | null;
    attributes: Record<string, string>;
    basePrice: string;
    sellingPrice: string;
    costPrice: string;
    mrp: string;
    listPrice: string;
    purchaseMode?: 'direct' | 'list' | null;
    discountPct?: string;
    marginPct?: string;
    salesDiscountPct?: string;
    overridePricing?: boolean;
    defaultPacking: string;
    boxQuantity: string;
    openingBoxes: string;
    openingLoose: string;
    stockQuantity: number;
    lowStockThreshold: number;
    isActive: boolean;
    imageUrl?: string; // variant-specific image URL
  }
  const [variants, setVariants] = useState<FormVariant[]>([]);
  const [productAttributes, setProductAttributes] = useState<{ key: string; value: string }[]>([]);

  // File uploading states
  const [uploading, setUploading] = useState(false);
  const [uploadingVariantIdx, setUploadingVariantIdx] = useState<number | null>(null);


  // SEO Metadata & Tags
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Image Gallery Input
  interface FormImage {
    id?: string;
    url: string;
    altText: string;
    isPrimary: boolean;
    sortOrder: number;
  }
  const [images, setImages] = useState<FormImage[]>([]);
  // Quick Modal States
  const [isQuickSupplierModalOpen, setIsQuickSupplierModalOpen] = useState(false);
  const [quickSupplierDisplayName, setQuickSupplierDisplayName] = useState('');
  const [quickSupplierCompanyName, setQuickSupplierCompanyName] = useState('');
  const [quickSupplierContactPerson, setQuickSupplierContactPerson] = useState('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState('');
  const [quickSupplierEmail, setQuickSupplierEmail] = useState('');
  const [quickSupplierGstin, setQuickSupplierGstin] = useState('');
  const [quickSupplierError, setQuickSupplierError] = useState<string | null>(null);
  const [quickSupplierSaving, setQuickSupplierSaving] = useState(false);
  useEffect(() => {
    if (!isEdit && !loadingMasters) {
      if (!uomId && units.length > 0) {
        const defaultUnit = units.find((u: any) => u.isDefault);
        if (defaultUnit) setUomId(defaultUnit.id);
      }
      if (!taxRateId && taxRates.length > 0) {
        const defaultRate = taxRates.find((r: any) => r.isDefault);
        if (defaultRate) setTaxRateId(defaultRate.id);
      }
    }
  }, [isEdit, loadingMasters, units, taxRates, uomId, taxRateId]);

  // --- Populate Initial Data on Edit ---
  useEffect(() => {
    if (isEdit && initialProduct) {
      setName(initialProduct.name);
      setType(initialProduct.type);
      setCategoryId(initialProduct.categoryId || '');
      setBrandId(initialProduct.brandId || '');
      setUomId(initialProduct.uomId || '');
      setTaxRateId(initialProduct.taxRateId || '');
      setHsnCodeId(initialProduct.hsnCodeId || '');
      setPreferredSupplierId((initialProduct as any).preferredSupplierId || '');
      setStatus(initialProduct.status || 'active');
      setDescription(initialProduct.description || '');
      setShortDescription(initialProduct.shortDescription || '');
      setStatus(initialProduct.status);

      // Pricing (Non-variant base pricing)
      setSku(initialProduct.sku || '');
      setBarcode(initialProduct.barcode || '');
      
      const pMode = initialProduct.purchaseMode || 'direct';
      const lp = Number(initialProduct.listPrice || 0);
      const disc = Number(initialProduct.discountPct || 0);
      let cost = Number(initialProduct.valuationCost || 0);
      if (pMode === 'list') {
        cost = lp * (1 - disc / 100);
      }
      const marg = Number(initialProduct.marginPct || 0);
      const rawSp = cost * (1 + marg / 100);
      const sp = Math.round(rawSp * 2) / 2; // round to nearest 0.5

      setBasePrice(sp.toFixed(2));
      setSellingPrice(sp.toFixed(2));
      setCostPrice(cost.toFixed(2));
      setPurchaseMode(pMode);
      setDiscountPct(initialProduct.discountPct != null ? Number(initialProduct.discountPct).toString() : '');
      setSalesDiscountPct(initialProduct.salesDiscountPct != null && Number(initialProduct.salesDiscountPct) > 0 ? Number(initialProduct.salesDiscountPct).toString() : '');
      setMarginPct(initialProduct.marginPct != null ? Number(initialProduct.marginPct).toString() : '');
      setListPrice(lp.toString());
      setMrp(Number(initialProduct.mrp || 0).toString());
      setMrpMultiplier('custom');
      setTrackInventory(initialProduct.trackInventory);
      setDefaultPacking(initialProduct.defaultPacking || '');
      const initBoxQty = initialProduct.boxQuantity ? String(initialProduct.boxQuantity) : '1';
      setBoxQuantity(initBoxQty);
      
      const stQty = initialProduct.openingQuantity || 0;
      if (stQty > 0) {
        setOpeningBoxes(Math.floor(stQty / parseInt(initBoxQty, 10)).toString());
        setOpeningLoose((stQty % parseInt(initBoxQty, 10)).toString());
      } else {
        setOpeningBoxes('');
        setOpeningLoose('');
      }

      // Variants
      setHasVariants(initialProduct.hasVariants);
      if (initialProduct.variants && initialProduct.variants.length > 0) {
        setVariants(
          initialProduct.variants.map((v) => {
            const vMode = v.purchaseMode || initialProduct.purchaseMode || 'direct';
            const vLp = v.listPrice != null ? Number(v.listPrice) : Number(initialProduct.listPrice || 0);
            const vDisc = v.discountPct != null ? Number(v.discountPct) : Number(initialProduct.discountPct || 0);
            let vCost = Number(v.valuationCost || initialProduct.valuationCost || 0);
            if (vMode === 'list') {
              vCost = vLp * (1 - vDisc / 100);
            }
            const vMarg = v.marginPct != null ? Number(v.marginPct) : Number(initialProduct.marginPct || 0);
            const rawVSp = vCost * (1 + vMarg / 100);
            const vSp = Math.round(rawVSp * 2) / 2; // round to nearest 0.5

            return {
              id: v.id,
              clientKey: v.id, // map clientKey to id for existing database entries
              name: v.name,
              sku: v.sku || '',
              barcode: v.barcode || '',
              attributes: v.attributes || {},
              categoryId: v.categoryId || null,
              basePrice: vSp.toString(),
              sellingPrice: vSp.toString(),
              costPrice: vCost.toFixed(2),
              mrp: Number(v.mrp || 0).toString(),
              listPrice: v.listPrice != null ? Number(v.listPrice).toString() : '',
              purchaseMode: vMode,
              discountPct: v.discountPct != null ? Number(v.discountPct).toString() : '',
              salesDiscountPct: v.salesDiscountPct != null && Number(v.salesDiscountPct) > 0 ? Number(v.salesDiscountPct).toString() : '',
              marginPct: v.marginPct != null ? Number(v.marginPct).toString() : '',
              overridePricing: false,
              defaultPacking: v.defaultPacking || '',
              boxQuantity: v.boxQuantity ? String(v.boxQuantity) : '1',
              openingBoxes: v.openingQuantity ? Math.floor(v.openingQuantity / (v.boxQuantity || 1)).toString() : '',
              openingLoose: v.openingQuantity ? (v.openingQuantity % (v.boxQuantity || 1)).toString() : '',
              stockQuantity: v.stockQuantity,
              lowStockThreshold: v.lowStockThreshold,
              isActive: v.isActive,
              imageUrl: initialProduct.images?.find((img) => img.variantId === v.id)?.url || undefined,
            };
          })
        );

        // Populate attribute list template as well from existing variations if possible
        const attrs: Record<string, Set<string>> = {};
        initialProduct.variants.forEach((v) => {
          Object.entries(v.attributes || {}).forEach(([key, val]) => {
            if (!attrs[key]) attrs[key] = new Set();
            attrs[key].add(val.toString());
          });
        });
        const template = Object.entries(attrs).map(([key, valSet]) => ({
          name: key,
          valuesStr: Array.from(valSet).join(', ')
        }));
        if (template.length > 0) setAttributesList(template);
      }

      // SEO
      setMetaTitle(initialProduct.metaTitle || '');
      setMetaDescription(initialProduct.metaDescription || '');
      setTagsInput((initialProduct.tags || []).join(', '));

      // Product Attributes (Specifications)
      if (initialProduct.attributes) {
        setProductAttributes(
          Object.entries(initialProduct.attributes).map(([key, value]) => ({
            key,
            value: String(value),
          }))
        );
      } else {
        setProductAttributes([]);
      }

      // Images (Filter out variant-specific images from main gallery)
      if (initialProduct.images) {
        setImages(
          initialProduct.images
            .filter((img) => !img.variantId)
            .map((img) => ({
              id: img.id,
              url: img.url,
              altText: img.altText || '',
              isPrimary: img.isPrimary,
              sortOrder: img.sortOrder,
            }))
        );
      }
    } else if (!isEdit && initialName) {
      setName(initialName);
    }
  }, [initialProduct, isEdit, initialName]);

  // Keep variant prices in sync when product-wide pricing settings change
  useEffect(() => {
    if (!hasVariants || variants.length === 0) return;
    const parentDisc = parseFloat(discountPct) || 0;
    const parentMarg = parseFloat(marginPct) || 0;

    setVariants((prev) =>
      prev.map((v) => {
        const isOverridden = !!v.overridePricing;
        const mode = isOverridden ? (v.purchaseMode || 'direct') : purchaseMode;
        const disc = isOverridden ? (parseFloat(v.discountPct || '0') || 0) : parentDisc;
        const marg = isOverridden ? (parseFloat(v.marginPct || '0') || 0) : parentMarg;

        let cost = parseFloat(v.costPrice) || 0;
        const lp = parseFloat(v.listPrice) || 0;

        if (mode === 'list') {
          cost = lp * (1 - disc / 100);
        }
        const rawSell = cost * (1 + marg / 100);
        const sell = Math.round(rawSell * 2) / 2;

        let newMrp = parseFloat(v.mrp) || 0;
        if (mrpMultiplier === '1x') newMrp = sell * 1;
        else if (mrpMultiplier === '2x') newMrp = sell * 2;
        else if (mrpMultiplier === '3x') newMrp = sell * 3;
        else if (mrpMultiplier === 'listPrice') newMrp = parseFloat(v.listPrice) || parseFloat(listPrice) || 0;

        return {
          ...v,
          costPrice: cost.toFixed(2),
          sellingPrice: sell.toFixed(2),
          basePrice: sell.toFixed(2),
          mrp: newMrp.toFixed(2),
        };
      })
    );
  }, [discountPct, marginPct, purchaseMode, mrpMultiplier, hasVariants, listPrice]);

  // --- Attribute Add/Remove ---
  const handleAddAttribute = () => {
    const newIdx = attributesList.length;
    setAttributesList([...attributesList, { name: '', valuesStr: '' }]);
    setTimeout(() => {
      document.getElementById(`attr-name-${newIdx}`)?.focus();
    }, 50);
  };

  const handleRemoveAttribute = (idx: number) => {
    const next = [...attributesList];
    next.splice(idx, 1);
    setAttributesList(next);
  };

  const handleAttributeChange = (idx: number, field: keyof BuilderAttr, val: string) => {
    const next = [...attributesList];
    
    if (field === 'name') {
      const titleVal = val
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .replace(/\b\w/g, (char) => char.toUpperCase());
        
      // Ensure no case-insensitive duplicates
      const isDuplicate = next.some((attr, i) => i !== idx && attr.name.trim().toLowerCase() === titleVal.trim().toLowerCase());
      if (isDuplicate && titleVal !== '') {
        return;
      }
      next[idx][field] = titleVal;
    } else {
      next[idx][field] = val;
    }
    
    setAttributesList(next);
  };

  // --- Combinations Generator (Cartesian Product) ---
  const generateCombinations = () => {
    // 1. Process attribute lists with automatic deduplication
    const map = new Map<string, { name: string; values: Set<string> }>();

    attributesList.forEach((attr) => {
      const key = attr.name.trim().toLowerCase();
      if (!key) return;

      const vals = attr.valuesStr
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      if (map.has(key)) {
        const existing = map.get(key)!;
        vals.forEach((v) => existing.values.add(v));
      } else {
        map.set(key, {
          name: attr.name.trim(),
          values: new Set(vals),
        });
      }
    });

    const cleanAttrs = Array.from(map.values()).map((item) => ({
      name: item.name,
      values: Array.from(item.values),
      valuesStr: Array.from(item.values).join(',') + (item.values.size > 0 ? ',' : ''),
    })).filter((item) => item.values.length > 0);

    // Sync state to remove duplicate rows visually
    const updatedList = Array.from(map.values()).map((item) => ({
      name: item.name,
      valuesStr: Array.from(item.values).join(',') + (item.values.size > 0 ? ',' : ''),
    }));
    if (updatedList.length > 0) {
      setAttributesList(updatedList);
    }

    if (cleanAttrs.length === 0) {
      toast.warning('Please fill out at least one attribute with values (e.g. Size: 4 inch, 6 inch).');
      return;
    }

    // 2. Cartesian Product calculator helper
    const cartesian = (arr: any[][]): any[][] => {
      return arr.reduce(
        (a, b) => a.flatMap((d) => b.map((e) => [d, e].flat())),
        [[]]
      );
    };

    const attributeValuesLists = cleanAttrs.map((a) =>
      a.values.map((v) => ({ key: a.name, val: v }))
    );
    const combos = cartesian(attributeValuesLists);

    // 3. Compile new Variant rows
    const generated: FormVariant[] = combos.map((comboList: any[]) => {
      // Build attribute mapping dictionary
      const comboAttrs: Record<string, string> = {};
      comboList.forEach((item) => {
        comboAttrs[item.key] = item.val;
      });

      // Name string format: "Product Name - AttrVal1, AttrVal2"
      const variantNameDetails = comboList.map((item) => item.val).join(', ');
      const variantName = `${name || 'Product'} - ${variantNameDetails}`;
      
      // Auto SKU template: product name-attribute1-attribute2 (slugified and uppercase)
      const cleanBaseName = (name || 'PROD').trim().replace(/\s+/g, '-');
      // Sort comboList by attribute key name alphabetically to match backend's deterministic sorting
      const sortedCombos = [...comboList].sort((a, b) => a.key.localeCompare(b.key));
      const cleanVals = sortedCombos.map((item: any) => item.val.trim().replace(/\s+/g, '-'));
      const autoSku = [cleanBaseName, ...cleanVals]
        .join('-')
        .replace(/[^a-zA-Z0-9-_]/g, '')
        .replace(/-+/g, '-')
        .toUpperCase();

      // Check if variant combination already exists in loaded list to retain its details (in case of updates)
      const existing = variants.find((curr) => {
        return Object.entries(comboAttrs).every(([k, val]) => curr.attributes[k] === val);
      });

      if (existing) {
        return {
          ...existing,
          name: variantName, // refresh name in case product name changed
        };
      }

      return {
        clientKey: `v-${Math.random().toString(36).substring(2, 9)}`,
        name: variantName,
        sku: autoSku,
        barcode: '',
        attributes: comboAttrs,
        basePrice: basePrice || '0',
        sellingPrice: sellingPrice || '0',
        costPrice: costPrice || '0',
        mrp: sellingPrice || '0',
        listPrice: listPrice || '0',
        purchaseMode: null,
        discountPct: '',
        marginPct: '',
        overridePricing: false,
        defaultPacking: '',
        boxQuantity: '1',
        openingBoxes: '',
        openingLoose: '',
        stockQuantity: 0,
        lowStockThreshold: 10,
        isActive: true,
      };
    });

    setVariants(generated);
    toast.success(`Generated ${generated.length} variant combination(s)`);
  };

  // --- Inline Variant Changes ---
  const handleVariantChange = (idx: number, field: keyof FormVariant, val: any) => {
    const next = [...variants];
    next[idx] = {
      ...next[idx],
      [field]: val,
    };
    setVariants(next);
  };

  const handleRemoveVariant = (idx: number) => {
    const next = [...variants];
    next.splice(idx, 1);
    setVariants(next);
  };

  // --- Images Helpers ---
  const handleRemoveImage = async (idx: number) => {
    const target = images[idx];
    const next = [...images];
    next.splice(idx, 1);
    // If we deleted the primary image, set the first remaining one as primary
    if (target.isPrimary && next.length > 0) {
      next[0].isPrimary = true;
    }
    setImages(next);

    if (target.url) {
      try {
        await api.delete('/media', { params: { url: target.url } });
      } catch (err) {
        console.error('Failed to delete image from S3', err);
      }
    }
  };

  const handleSetPrimaryImage = (idx: number) => {
    setImages(
      images.map((img, i) => ({
        ...img,
        isPrimary: i === idx,
      }))
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/media/upload', formData, {
        headers: {
          'Content-Type': undefined,
        },
      });

      const { url } = response.data.data;
      const isFirst = images.length === 0;

      const nextImage: FormImage = {
        url,
        altText: name || file.name.split('.')[0] || 'Uploaded image',
        isPrimary: isFirst,
        sortOrder: images.length,
      };

      setImages([...images, nextImage]);
    } catch (err: any) {
      console.error('Upload failed', err);
      toast.error(err.response?.data?.message || 'Failed to upload image from local computer');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleVariantImageUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingVariantIdx(idx);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/media/upload', formData, {
        headers: {
          'Content-Type': undefined,
        },
      });

      const { url } = response.data.data;

      const next = [...variants];
      next[idx] = {
        ...next[idx],
        imageUrl: url,
      };
      setVariants(next);
    } catch (err: any) {
      console.error('Variant upload failed', err);
      toast.error(err.response?.data?.message || 'Failed to upload variant image');
    } finally {
      setUploadingVariantIdx(null);
      e.target.value = '';
    }
  };

  const handleRemoveVariantImage = async (idx: number) => {
    const next = [...variants];
    const url = next[idx].imageUrl;
    delete next[idx].imageUrl;
    setVariants(next);

    if (url) {
      try {
        await api.delete('/media', { params: { url } });
      } catch (err) {
        console.error('Failed to delete variant image from S3', err);
      }
    }
  };

  const openQuickCategoryModal = () => {
    setQuickCategoryName('');
    setQuickCategoryParentId('');
    setQuickCategoryDescription('');
    setQuickCategoryError(null);
    setIsQuickCategoryModalOpen(true);
  };

  const openQuickBrandModal = () => {
    setQuickBrandName('');
    setQuickBrandDescription('');
    setQuickBrandError(null);
    setIsQuickBrandModalOpen(true);
  };

  const handleQuickCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickCategoryError(null);
    setQuickCategorySaving(true);

    try {
      const payload = {
        name: quickCategoryName,
        parentId: quickCategoryParentId || null,
        description: quickCategoryDescription || null,
      };

      const res = await api.post('/masters/categories', payload);
      toast.success('Category created successfully');
      queryClient.invalidateQueries({ queryKey: ['masters', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['masters-categories'] });
      queryClient.invalidateQueries({ queryKey: ['masters-categories-all'] });
      setCategoryId(res.data.data.id);
      setIsQuickCategoryModalOpen(false);
    } catch (err: any) {
      setQuickCategoryError(err.response?.data?.message || 'Failed to create category');
    } finally {
      setQuickCategorySaving(false);
    }
  };

  const handleQuickBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickBrandError(null);
    setQuickBrandSaving(true);

    try {
      const payload = {
        name: quickBrandName,
        description: quickBrandDescription || null,
      };

      const res = await api.post('/masters/brands', payload);
      toast.success('Brand created successfully');
      queryClient.invalidateQueries({ queryKey: ['masters', 'brands'] });
      queryClient.invalidateQueries({ queryKey: ['masters-brands'] });
      setBrandId(res.data.data.id);
      setIsQuickBrandModalOpen(false);
    } catch (err: any) {
      setQuickBrandError(err.response?.data?.message || 'Failed to create brand');
    } finally {
      setQuickBrandSaving(false);
    }
  };

  const openQuickSupplierModal = () => {
    setQuickSupplierDisplayName('');
    setQuickSupplierCompanyName('');
    setQuickSupplierContactPerson('');
    setQuickSupplierPhone('');
    setQuickSupplierEmail('');
    setQuickSupplierGstin('');
    setQuickSupplierError(null);
    setIsQuickSupplierModalOpen(true);
  };

  const handleQuickSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickSupplierError(null);
    setQuickSupplierSaving(true);

    try {
      const payload = {
        displayName: quickSupplierDisplayName,
        companyName: quickSupplierCompanyName || null,
        contactPerson: quickSupplierContactPerson || null,
        phone: quickSupplierPhone || null,
        email: quickSupplierEmail || null,
        gstin: quickSupplierGstin || null,
        type: 'vendor',
      };

      const res = await api.post('/contacts', payload);
      toast.success('Supplier created successfully');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setPreferredSupplierId(res.data.data.id);
      setIsQuickSupplierModalOpen(false);
    } catch (err: any) {
      setQuickSupplierError(err.response?.data?.message || 'Failed to create supplier');
    } finally {
      setQuickSupplierSaving(false);
    }
  };

  // --- Form Submission ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFormErrors({});
    setSubmitting(true);

    // Process Tags
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Prep Payload
    const payload: Record<string, any> = {
      name,
      type,
      categoryId: categoryId || null,
      brandId: brandId || null,
      uomId: uomId || null,
      taxRateId: taxRateId || null,
      hsnCodeId: hsnCodeId || null,
      preferredSupplierId: preferredSupplierId || null,
      description: description || null,
      shortDescription: shortDescription || null,
      status,
      isTaxable: !!taxRateId,
      defaultPacking: defaultPacking || null,
      boxQuantity: parseInt(boxQuantity, 10) || 1,
      trackInventory,
      hasVariants,
      purchaseMode,
      discountPct: parseFloat(discountPct) || 0,
      salesDiscountPct: parseFloat(salesDiscountPct) || 0,
      marginPct: parseFloat(marginPct) || 0,
      listPrice: parseFloat(listPrice) || 0,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      tags,
      // Specifications attributes mapping
      attributes: (() => {
        const attrsObj: Record<string, string> = {};
        productAttributes.forEach((attr) => {
          if (attr.key.trim() && attr.value.trim()) {
            attrsObj[attr.key.trim()] = attr.value.trim();
          }
        });
        return attrsObj;
      })(),
      // Variants
      variants: hasVariants
        ? variants.map((v) => ({
            id: v.id,
            clientKey: v.clientKey,
            name: v.name,
            sku: v.sku || null,
            barcode: v.barcode || null,
            categoryId: v.categoryId || null,
            attributes: v.attributes,
            basePrice: parseFloat(v.basePrice) || 0,
            sellingPrice: parseFloat(v.sellingPrice) || 0,
            costPrice: parseFloat(v.costPrice) || 0,
            mrp: parseFloat(v.mrp) || 0,
            listPrice: parseFloat(v.listPrice) || 0,
            purchaseMode: v.overridePricing ? v.purchaseMode : null,
            discountPct: v.overridePricing && v.discountPct !== undefined && v.discountPct !== '' ? parseFloat(v.discountPct) : null,
            salesDiscountPct: v.overridePricing && v.salesDiscountPct !== undefined && v.salesDiscountPct !== '' ? parseFloat(v.salesDiscountPct) : null,
            marginPct: v.overridePricing && v.marginPct !== undefined && v.marginPct !== '' ? parseFloat(v.marginPct) : null,
            defaultPacking: v.defaultPacking || null,
            boxQuantity: parseInt(v.boxQuantity, 10) || 1,
            stockQuantity: ((parseInt(v.openingBoxes, 10) || 0) * (parseInt(v.boxQuantity, 10) || 1)) + (parseInt(v.openingLoose, 10) || 0),
            lowStockThreshold: v.lowStockThreshold,
            isActive: v.isActive,
          }))
        : [],
      // Images (Combine global gallery images + variant-specific images)
      images: [
        ...images.map((img, idx) => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.url, // default same as url
          altText: img.altText,
          isPrimary: img.isPrimary,
          sortOrder: img.sortOrder ?? idx,
          variantId: null,
          variantClientKey: null,
        })),
        ...variants
          .filter((v) => v.imageUrl)
          .map((v, idx) => ({
            url: v.imageUrl!,
            thumbnailUrl: v.imageUrl!,
            altText: `${v.name} Image`,
            isPrimary: false,
            sortOrder: images.length + idx,
            variantId: v.id || null,
            variantClientKey: v.id ? null : v.clientKey,
          })),
      ],
    };

    // If NOT using variants, pass the core pricing/SKU fields
    if (!hasVariants) {
      payload.sku = sku || null;
      payload.barcode = barcode || null;
      payload.basePrice = parseFloat(basePrice) || 0;
      payload.sellingPrice = parseFloat(sellingPrice) || 0;
      payload.costPrice = parseFloat(costPrice) || 0;
      payload.mrp = parseFloat(mrp) || 0;
      payload.stockQuantity = computedStockQuantity;
    }

    try {
      // Validate schema client-side
      createProductSchema.parse(payload);

      if (isEdit && initialProduct) {
        await api.put(`/products/${initialProduct.id}`, payload);
        toast.success('Product updated successfully');
        if (isModal && onSuccess) onSuccess(payload); // pass payload or refetch
        else router.push('/dashboard/products');
      } else {
        const createRes = await api.post('/products', payload);
        toast.success('Product created successfully');
        if (isModal && onSuccess) onSuccess(createRes.data.data);
        else router.push('/dashboard/products');
      }
    } catch (err: any) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {};
        err.issues.forEach((issue) => {
          const path = issue.path[0];
          if (path) {
            errors[path.toString()] = issue.message;
          }
        });
        setFormErrors(errors);
        
        // Switch tab to where the error likely lies
        const errKeys = Object.keys(errors);
        if (errKeys.some((k) => ['sku', 'barcode', 'basePrice', 'sellingPrice', 'costPrice'].includes(k))) {
          setActiveTab('pricing');
        } else if (errKeys.some((k) => k.startsWith('variants'))) {
          setActiveTab('variants');
        } else if (errKeys.some((k) => k.startsWith('images'))) {
          setActiveTab('images');
        } else {
          setActiveTab('basic');
        }

        toast.error('Please fix the validation errors in the form.');
      } else {
        const msg = err.response?.data?.message || 'Something went wrong while saving the product';
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMasters) {
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {isEdit ? 'Modify Product Specifications' : 'Onboard New Product'}
            </h1>
            {name.trim() && (
              <span className="text-xs font-bold text-amber-800 bg-amber-100/80 border border-amber-300 px-3 py-1 rounded-full truncate max-w-[300px]">
                {name}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Configure catalog itemization details, dynamic pricing matrices, variants, and SEO headers.
          </p>
        </div>
        <Button variant="ghost" type="button" onClick={() => {
          if (isModal && onCancel) onCancel();
          else router.push('/dashboard/products');
        }}>Cancel</Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <Button variant="ghost" className="text-red-700 hover:text-red-800 font-bold" onClick={() => setError(null)}>✕</Button>
        </div>
      )}

      {/* Tabs Menu Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="basic">
            Basic Information
          </TabsTrigger>
          <TabsTrigger value="pricing">
            Pricing, Inventory & Variants {hasVariants && <Badge className="ml-1 bg-amber-500/10 text-amber-600 border-amber-200/50">{variants.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="specifications">
            Specifications {productAttributes.length > 0 && <Badge className="ml-1 bg-zinc-100 text-zinc-600">{productAttributes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="images">
            Gallery Images {images.length > 0 && <Badge className="ml-1 bg-zinc-100 text-zinc-600">{images.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="seo">
            SEO Meta Headers
          </TabsTrigger>
        </TabsList>

        {/* Persistent Product Context Header across all tabs */}
        {name.trim() ? (
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-500/10 via-amber-50/60 to-white border border-amber-200/80 rounded-xl my-4 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xs font-bold text-amber-900/60 uppercase tracking-widest shrink-0">Product:</span>
              <span className="text-sm font-extrabold text-amber-950 truncate">{name}</span>
              {sku.trim() && (
                <span className="text-xs font-semibold text-zinc-500 bg-white px-2 py-0.5 rounded border border-zinc-200 shrink-0">
                  SKU: {sku}
                </span>
              )}
            </div>
            <span className="text-xs font-medium text-amber-900/70 hidden sm:inline-flex items-center gap-1 shrink-0">
              Press <kbd className="px-1.5 py-0.5 bg-white border border-amber-200 rounded font-semibold text-[10px] text-zinc-700 shadow-2xs">Ctrl + S</kbd> to save anytime
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 border border-zinc-200/60 rounded-xl my-4">
            <span className="text-xs font-medium text-zinc-400 italic">Enter product name in Basic Information to preview here</span>
            <span className="text-xs font-medium text-zinc-400 hidden sm:inline-flex items-center gap-1 shrink-0">
              Press <kbd className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded font-semibold text-[10px] text-zinc-600">Ctrl + S</kbd> to save
            </span>
          </div>
        )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {/* --- 1. Basic Info Tab --- */}
        <TabsContent value="basic">
          <BasicInfoTab
            name={name} setName={setName}
            type={type} setType={setType}
            categoryId={categoryId} setCategoryId={setCategoryId}
            brandId={brandId} setBrandId={setBrandId}
            uomId={uomId} setUomId={setUomId}
            hsnCodeId={hsnCodeId} setHsnCodeId={setHsnCodeId}
            taxRateId={taxRateId} setTaxRateId={setTaxRateId}
            status={status} setStatus={setStatus}
            shortDescription={shortDescription} setShortDescription={setShortDescription}
            description={description} setDescription={setDescription}
            categories={categories} brands={brands} units={units} hsnCodes={hsnCodes} taxRates={taxRates}
            preferredSupplierId={preferredSupplierId} setPreferredSupplierId={setPreferredSupplierId} suppliers={suppliers}
            openQuickCategoryModal={openQuickCategoryModal} openQuickBrandModal={openQuickBrandModal} openQuickSupplierModal={openQuickSupplierModal}
            setActiveTab={setActiveTab} formErrors={formErrors}
          />
        </TabsContent>

        {/* --- 2. Pricing, Inventory & Variants Tab --- */}
        <TabsContent value="pricing" className="space-y-6">
          {(() => {
            const selectedUom = units.find((u: any) => u.id === uomId);
            const uomCode = selectedUom ? selectedUom.code || selectedUom.name : '';
            const uomName = selectedUom ? selectedUom.name : '';

            return (
              <>
                <PricingInventoryTab
                  hasVariants={hasVariants} setHasVariants={setHasVariants}
                  sku={sku} setSku={setSku} barcode={barcode} setBarcode={setBarcode}
                  costPrice={costPrice} setCostPrice={setCostPrice}
                  sellingPrice={sellingPrice} setSellingPrice={setSellingPrice}
                  basePrice={basePrice} setBasePrice={setBasePrice}
                  purchaseMode={purchaseMode} setPurchaseMode={setPurchaseMode}
                  discountPct={discountPct} setDiscountPct={setDiscountPct}
                  marginPct={marginPct} setMarginPct={setMarginPct}
                  salesDiscountPct={salesDiscountPct} setSalesDiscountPct={setSalesDiscountPct}
                  listPrice={listPrice} setListPrice={setListPrice}
                  mrp={mrp} setMrp={setMrp} mrpMultiplier={mrpMultiplier} setMrpMultiplier={setMrpMultiplier}
                  defaultPacking={defaultPacking} setDefaultPacking={setDefaultPacking}
                  boxQuantity={boxQuantity} setBoxQuantity={setBoxQuantity}
                  openingBoxes={openingBoxes} setOpeningBoxes={setOpeningBoxes}
                  openingLoose={openingLoose} setOpeningLoose={setOpeningLoose}
                  computedStockQuantity={computedStockQuantity}
                  trackInventory={trackInventory} setTrackInventory={setTrackInventory}
                  setActiveTab={setActiveTab} formErrors={formErrors}
                  uomCode={uomCode} uomName={uomName}
                />

                {hasVariants && (
                  <VariantsTab
                    categories={categories}
                    hasVariants={hasVariants} setHasVariants={setHasVariants} setActiveTab={setActiveTab}
                    existingAttributes={existingAttributes} attributesList={attributesList} setAttributesList={setAttributesList}
                    handleAttributeChange={handleAttributeChange} handleRemoveAttribute={handleRemoveAttribute} handleAddAttribute={handleAddAttribute} generateCombinations={generateCombinations}
                    variants={variants as FormVariant[]} setVariants={setVariants as React.Dispatch<React.SetStateAction<FormVariant[]>>}
                    costPrice={costPrice} setCostPrice={setCostPrice}
                    sellingPrice={sellingPrice} setSellingPrice={setSellingPrice}
                    basePrice={basePrice} setBasePrice={setBasePrice}
                    purchaseMode={purchaseMode} setPurchaseMode={setPurchaseMode}
                    discountPct={discountPct} setDiscountPct={setDiscountPct}
                    marginPct={marginPct} setMarginPct={setMarginPct}
                    salesDiscountPct={salesDiscountPct} setSalesDiscountPct={setSalesDiscountPct}
                    listPrice={listPrice} setListPrice={setListPrice}
                    mrp={mrp} setMrp={setMrp}
                    mrpMultiplier={mrpMultiplier} setMrpMultiplier={setMrpMultiplier}
                    formErrors={formErrors} trackInventory={trackInventory}
                    handleRemoveVariantImage={handleRemoveVariantImage} uploadingVariantIdx={uploadingVariantIdx} handleVariantImageUpload={handleVariantImageUpload} handleVariantChange={handleVariantChange} handleRemoveVariant={handleRemoveVariant}
                    uomCode={uomCode} uomName={uomName}
                  />
                )}
              </>
            );
          })()}
        </TabsContent>

        {/* --- 3. Specifications Tab --- */}
        <TabsContent value="specifications">
          <SpecificationsTab
            productAttributes={productAttributes}
            setProductAttributes={setProductAttributes}
            hasVariants={hasVariants}
            setActiveTab={setActiveTab}
          />
        </TabsContent>

        {/* --- 4. Gallery Images Tab --- */}
        <TabsContent value="images">
          <ImagesTab
            uploading={uploading} handleFileUpload={handleFileUpload}
            images={images}
            handleSetPrimaryImage={handleSetPrimaryImage} handleRemoveImage={handleRemoveImage}
            hasVariants={hasVariants} setActiveTab={setActiveTab}
          />
        </TabsContent>

        {/* --- 5. SEO Metadata Tab --- */}
        <TabsContent value="seo">
          <SeoTab
            metaTitle={metaTitle} setMetaTitle={setMetaTitle}
            metaDescription={metaDescription} setMetaDescription={setMetaDescription}
            tagsInput={tagsInput} setTagsInput={setTagsInput}
            shortDescription={shortDescription} setShortDescription={setShortDescription}
            description={description} setDescription={setDescription}
            setActiveTab={setActiveTab}
            isEdit={isEdit}
            submitting={submitting}
            formErrors={formErrors}
            productName={name}
            categoryName={categories.find((c: any) => c.id === categoryId)?.name || ''}
            brandName={brands.find((b: any) => b.id === brandId)?.name || ''}
            uomName={units.find((u: any) => u.id === uomId)?.name || ''}
            hsnCode={hsnCodes.find((h: any) => h.id === hsnCodeId)?.code || ''}
            productAttributes={productAttributes}
          />
        </TabsContent>
      </form>
      </Tabs>

      <QuickCategoryModal
        isOpen={isQuickCategoryModalOpen}
        onClose={() => setIsQuickCategoryModalOpen(false)}
        error={quickCategoryError}
        onSubmit={handleQuickCategorySubmit}
        name={quickCategoryName} setName={setQuickCategoryName}
        parentId={quickCategoryParentId} setParentId={setQuickCategoryParentId}
        categories={categories}
        description={quickCategoryDescription} setDescription={setQuickCategoryDescription}
        saving={quickCategorySaving}
      />

      <QuickBrandModal
        isOpen={isQuickBrandModalOpen}
        onClose={() => setIsQuickBrandModalOpen(false)}
        error={quickBrandError}
        onSubmit={handleQuickBrandSubmit}
        name={quickBrandName} setName={setQuickBrandName}
        description={quickBrandDescription} setDescription={setQuickBrandDescription}
        saving={quickBrandSaving}
      />

      <QuickSupplierModal
        isOpen={isQuickSupplierModalOpen}
        onClose={() => setIsQuickSupplierModalOpen(false)}
        error={quickSupplierError}
        onSubmit={handleQuickSupplierSubmit}
        displayName={quickSupplierDisplayName} setDisplayName={setQuickSupplierDisplayName}
        companyName={quickSupplierCompanyName} setCompanyName={setQuickSupplierCompanyName}
        contactPerson={quickSupplierContactPerson} setContactPerson={setQuickSupplierContactPerson}
        phone={quickSupplierPhone} setPhone={setQuickSupplierPhone}
        email={quickSupplierEmail} setEmail={setQuickSupplierEmail}
        gstin={quickSupplierGstin} setGstin={setQuickSupplierGstin}
        saving={quickSupplierSaving}
      />


    </div>
  );
}
