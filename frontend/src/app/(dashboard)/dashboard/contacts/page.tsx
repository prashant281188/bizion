'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { API_ROUTES, INDIAN_STATES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Contact, ContactGroup, Product } from '@/types';
import { createContactSchema, type CreateContactFormData } from '@/schemas/contact.schema';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { QuickTransporterModal } from '@/components/ui/quick-transporter-modal';
import { ZodError } from 'zod';
import { formatCurrency } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { SearchFilterBar } from '@/components/ui/search-filter-bar';
import { DataTable, type TableHeader } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Drawer } from '@/components/ui/drawer';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { BulkImportModal } from '@/components/contacts/bulk-import-modal';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, Building2, DollarSign, Search, Plus, Upload, Edit3, ChevronRight } from 'lucide-react';

const CONTACT_TYPES = [
  { value: 'customer', label: 'Customer' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'both', label: 'Both (Customer & Vendor)' },
];

const GST_SCHEMES = [
  { value: 'regular', label: 'Regular' },
  { value: 'composition', label: 'Composition' },
  { value: 'unregistered', label: 'Unregistered' },
  { value: 'consumer', label: 'Consumer' },
  { value: 'sez', label: 'SEZ' },
  { value: 'deemed_export', label: 'Deemed Export' },
];

export default function ContactsDirectoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableHeaders: TableHeader[] = [
    { key: 'displayName', label: 'Display Name', sortable: true },
    { key: 'companyName', label: 'Company Name', sortable: true },
    { key: 'type', label: 'Type' },
    { key: 'gstin', label: 'GSTIN / PAN' },
    { key: 'email', label: 'Contact Info', sortable: true },
    { key: 'balance', label: 'Balance', align: 'right', sortable: true },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', align: 'right' },
  ];

  // Pagination & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [sortBy, setSortBy] = useState<string>('displayName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupSortBy, setGroupSortBy] = useState('name');
  const [groupSortOrder, setGroupSortOrder] = useState<'asc'|'desc'>('asc');

  const [localError, setLocalError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Dialog / Side Sheet State
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [viewContact, setViewContact] = useState<Contact | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [type, setType] = useState<'customer' | 'vendor' | 'both'>('customer');
  const [gstin, setGstin] = useState('');
  const [gstRegistrationType, setGstRegistrationType] = useState<string>('unregistered');
  const [pan, setPan] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [website, setWebsite] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [preferredTransporter, setPreferredTransporter] = useState('');
  const [preferredTransporterId, setPreferredTransporterId] = useState('');
  const [contactGroupId, setContactGroupId] = useState('');
  const [contactGroup, setContactGroup] = useState('');
  const [weeklyOff, setWeeklyOff] = useState('');
  const [visitFrequency, setVisitFrequency] = useState('monthly');
  const [preferredVisitWeek, setPreferredVisitWeek] = useState('any');
  const [notes, setNotes] = useState('');
  const [paymentTermId, setPaymentTermId] = useState('');
  const [defaultTaxRateId, setDefaultTaxRateId] = useState('');
  const [salesPriceListId, setSalesPriceListId] = useState('');
  const [purchasePriceListId, setPurchasePriceListId] = useState('');

  // Transporter Select Options
  const [transportersList, setTransportersList] = useState<any[]>([]);
  const [quickTransporterModalOpen, setQuickTransporterModalOpen] = useState(false);

  useEffect(() => {
    api.get('/transporters')
      .then(res => setTransportersList(res.data?.data || []))
      .catch(() => {
        setTransportersList([
          { id: '1', name: 'VRL Logistics Ltd', transporterId: '27AAAAA0000A1Z5' },
          { id: '2', name: 'TCI Freight Services', transporterId: '27BBBBB1111B1Z2' },
        ]);
      });
  }, []);

  const transporterOptions = useMemo(() => transportersList.map(t => ({
    value: t.id,
    label: t.name,
    sublabel: t.transporterId ? `GST ID: ${t.transporterId}` : t.vehicleNumber ? `Vehicle: ${t.vehicleNumber}` : undefined,
  })), [transportersList]);

  // Weekly Off Options
  const WEEKLY_OFF_OPTIONS = [
    { value: '', label: 'None (Operating Daily)' },
    { value: 'Sunday', label: 'Sunday' },
    { value: 'Monday', label: 'Monday' },
    { value: 'Tuesday', label: 'Tuesday' },
    { value: 'Wednesday', label: 'Wednesday' },
    { value: 'Thursday', label: 'Thursday' },
    { value: 'Friday', label: 'Friday' },
    { value: 'Saturday', label: 'Saturday' },
  ];

  // Visit Frequency Options
  const VISIT_FREQUENCY_OPTIONS = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'fortnightly', label: 'Fortnightly (Every 2 Weeks)' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'on_demand', label: 'On-Demand / As Needed' },
  ];

  // Preferred Visit Week Options
  const PREFERRED_VISIT_WEEK_OPTIONS = [
    { value: 'any', label: 'Any Week (Flexible)' },
    { value: '1st_week', label: '1st Week of Month (Days 1–7)' },
    { value: '2nd_week', label: '2nd Week of Month (Days 8–14)' },
    { value: '3rd_week', label: '3rd Week of Month (Days 15–21)' },
    { value: '4th_week', label: '4th Week of Month (Days 22–28)' },
    { value: 'last_week', label: 'Last Week of Month' },
  ];
  
  // Addresses Array Form State
  const [addresses, setAddresses] = useState<any[]>([]);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openAddModal();
    }
  }, [searchParams]);

  // Custom Pricing State
  const [customPricesPage, setCustomPricesPage] = useState(1);
  const [customPricesSortBy, setCustomPricesSortBy] = useState('createdAt');
  const [customPricesSortOrder, setCustomPricesSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [customPriceVal, setCustomPriceVal] = useState('');
  const [addingCustomPrice, setAddingCustomPrice] = useState(false);
  const [quickGroupModalOpen, setQuickGroupModalOpen] = useState(false);
  const [quickGroupName, setQuickGroupName] = useState('');
  const [isCreatingQuickGroup, setIsCreatingQuickGroup] = useState(false);
  const [deactivateConfirmContactId, setDeactivateConfirmContactId] = useState<string | null>(null);
  const [activateConfirmContactId, setActivateConfirmContactId] = useState<string | null>(null);
  const [deleteConfirmCustomPriceId, setDeleteConfirmCustomPriceId] = useState<string | null>(null);

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
  const canCreate = userRoleLevel >= 1; // agent or above
  const canEdit = userRoleLevel >= 1; // agent or above
  const canDelete = userRoleLevel >= 3; // manager or above

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return <span className="ml-1.5 text-zinc-500">↕</span>;
    return sortOrder === 'asc' ? <span className="ml-1.5 text-amber-700">▲</span> : <span className="ml-1.5 text-amber-700">▼</span>;
  };

  const { data: contactsData, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['contacts', { page, searchQuery, typeFilter, statusFilter, sortBy, sortOrder, selectedGroupId }],
    queryFn: async () => {
      let url = `${API_ROUTES.CONTACTS.BASE}?page=${page}&limit=10&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
      if (typeFilter) url += `&type=${typeFilter}`;
      if (statusFilter && statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (selectedGroupId) url += `&contactGroupId=${selectedGroupId}`;
      const res = await api.get(url);
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const contacts = contactsData?.data || [];
  const totalPages = Math.ceil((contactsData?.pagination?.total || 0) / (contactsData?.pagination?.limit || 10)) || 1;
  const displayError = localError || (queryError ? (queryError as any).response?.data?.message || 'Failed to fetch contacts directory' : null);

  const { data: mastersData, refetch: refetchMasters } = useQuery({
    queryKey: ['masters'],
    queryFn: async () => {
      const [ptRes, trRes, cgRes] = await Promise.all([
        api.get('/masters/payment-terms?limit=500'),
        api.get('/masters/tax-rates?limit=500'),
        api.get('/masters/contact-groups?limit=1000'),
      ]);
      return {
        paymentTerms: ptRes.data.data,
        taxRates: trRes.data.data,
        contactGroups: cgRes.data.data,
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const paymentTerms: any[] = mastersData?.paymentTerms || [];
  const taxRates: any[] = mastersData?.taxRates || [];
  const contactGroups: any[] = mastersData?.contactGroups || [];

  const { data: orgData } = useQuery({
    queryKey: ['orgSettings'],
    queryFn: async () => {
      const res = await api.get(API_ROUTES.ORGANIZATION.ME);
      return res.data.data;
    },
    staleTime: 60000,
  });
  const defaultPaymentTermId: string =
    orgData?.settings?.defaultPaymentTermId ||
    paymentTerms.find((pt: any) => pt.isDefault)?.id ||
    '';

  // Refetch latest contact groups whenever modal opens
  useEffect(() => {
    if (modalOpen) {
      refetchMasters();
    }
  }, [modalOpen, refetchMasters]);

  const { data: sidebarGroupsData, refetch: refetchSidebar } = useQuery({
    queryKey: ['contactGroupsSidebar', groupSortBy, groupSortOrder],
    queryFn: async () => {
      const res = await api.get(`/masters/contact-groups?withBalances=true&limit=1000&sortBy=${groupSortBy}&sortOrder=${groupSortOrder}`);
      return res.data.data;
    }
  });
  
  const sidebarGroups = sidebarGroupsData || [];

  const { data: allProductsData } = useQuery({
    queryKey: ['allProducts'],
    queryFn: async () => {
      const res = await api.get('/products?limit=250');
      return res.data.data || [];
    },
    enabled: !!viewContact,
  });
  const allProducts: any[] = allProductsData || [];
  
  const selectedProduct = allProducts.find((p: any) => p.id === selectedProductId);
  const selectedProductVariants: any[] = selectedProduct?.variants || [];

  const { data: customPricesResponse, isLoading: customPricesLoading } = useQuery({
    queryKey: ['customPrices', viewContact?.id, customPricesPage, customPricesSortBy, customPricesSortOrder],
    queryFn: async () => {
      if (!viewContact) return null;
      const res = await api.get(`/contacts/${viewContact.id}/prices?page=${customPricesPage}&limit=5&sortBy=${customPricesSortBy}&sortOrder=${customPricesSortOrder}`);
      return res.data;
    },
    enabled: !!viewContact,
    placeholderData: (prev) => prev,
  });
  
  const customPrices: any[] = customPricesResponse?.data || [];
  const totalCustomPricesPages = customPricesResponse?.pagination?.totalPages || 1;

  const handleCustomPricesSort = (field: string) => {
    if (!viewContact) return;
    let newOrder: 'asc' | 'desc' = 'asc';
    if (customPricesSortBy === field) {
      newOrder = customPricesSortOrder === 'asc' ? 'desc' : 'asc';
    }
    setCustomPricesSortBy(field);
    setCustomPricesSortOrder(newOrder);
    setCustomPricesPage(1);
  };

  const renderCustomPricesSortIcon = (field: string) => {
    if (customPricesSortBy !== field) return <span className="ml-1.5 text-zinc-500">↕</span>;
    return customPricesSortOrder === 'asc' ? <span className="ml-1.5 text-amber-500">▲</span> : <span className="ml-1.5 text-amber-500">▼</span>;
  };

  useEffect(() => {
    if (viewContact) {
      setCustomPricesPage(1);
      setCustomPricesSortBy('createdAt');
      setCustomPricesSortOrder('desc');
    }
  }, [viewContact]);

  const handleAddCustomPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewContact) return;
    if (!selectedProductId) {
      toast.warning('Please select a product');
      return;
    }
    if (!customPriceVal || parseFloat(customPriceVal) <= 0) {
      toast.warning('Please enter a valid price override');
      return;
    }

    try {
      setAddingCustomPrice(true);
      await api.post(`/contacts/${viewContact.id}/prices`, {
        productId: selectedProductId,
        variantId: selectedVariantId || null,
        customPrice: parseFloat(customPriceVal),
      });
      setSelectedProductId('');
      setSelectedVariantId('');
      setCustomPriceVal('');
      setCustomPricesPage(1);
      queryClient.invalidateQueries({ queryKey: ['customPrices', viewContact.id] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add custom price override');
    } finally {
      setAddingCustomPrice(false);
    }
  };

  const handleQuickCreateGroup = async () => {
    if (!quickGroupName.trim()) {
      toast.error('Group name is required');
      return;
    }
    try {
      setIsCreatingQuickGroup(true);
      const res = await api.post('/masters/contact-groups', {
        name: quickGroupName.trim(),
        isActive: true,
      });
      toast.success('Contact group created successfully');
      setQuickGroupName('');
      setQuickGroupModalOpen(false);
      
      // Use direct refetch to guarantee the active component queries update instantly
      await Promise.all([
        refetchMasters(),
        refetchSidebar()
      ]);
      queryClient.invalidateQueries({ queryKey: ['masters-contact-groups'] });
      
      // Set the newly created group ID
      if (res.data?.data?.id) {
        setContactGroupId(res.data.data.id);
        setContactGroup(res.data.data.name);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    } finally {
      setIsCreatingQuickGroup(false);
    }
  };

  const promptDeleteCustomPrice = (priceId: string) => {
    setDeleteConfirmCustomPriceId(priceId);
  };

  const executeDeleteCustomPrice = async () => {
    if (!viewContact || !deleteConfirmCustomPriceId) return;

    try {
      await api.delete(`/contacts/${viewContact.id}/prices/${deleteConfirmCustomPriceId}`);
      // If we delete the last item on the page, go to previous page
      const newPage = customPrices.length === 1 && customPricesPage > 1 ? customPricesPage - 1 : customPricesPage;
      setCustomPricesPage(newPage);
      queryClient.invalidateQueries({ queryKey: ['customPrices', viewContact.id] });
      setDeleteConfirmCustomPriceId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete custom price override');
    }
  };

  const openAddModal = () => {
    setEditingContact(null);
    setDisplayName('');
    setCompanyName('');
    setContactPerson('');
    setType('customer');
    setGstin('');
    setGstRegistrationType('unregistered');
    setPan('');
    setEmail('');
    setPhone('');
    setMobile('');
    setWebsite('');
    setCreditLimit('0');
    setOpeningBalance('0');
    setPaymentTermId(defaultPaymentTermId);
    setDefaultTaxRateId('');
    setContactGroupId('');
    setContactGroup('');
    setWeeklyOff('');
    setVisitFrequency('monthly');
    setPreferredVisitWeek('any');
    setPreferredTransporterId('');
    setPreferredTransporter('');
    setNotes('');
    setAddresses([
      {
        label: 'Office',
        addressLine1: '',
        addressLine2: '',
        city: '',
        stateCode: '',
        stateName: '',
        pincode: '',
        country: 'India',
        isBillingDefault: true,
        isShippingDefault: true,
      }
    ]);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (c: Contact) => {
    setEditingContact(c);
    setDisplayName(c.displayName);
    setCompanyName(c.companyName || '');
    setContactPerson(c.contactPerson || '');
    setType(c.type);
    setGstin(c.gstin || '');
    setGstRegistrationType(c.gstRegistrationType || 'unregistered');
    setPan(c.pan || '');
    setEmail(c.email || '');
    setPhone(c.phone || '');
    setMobile(c.mobile || '');
    setWebsite(c.website || '');
    setCreditLimit(c.creditLimit?.toString() || '0');
    setOpeningBalance(c.openingBalance?.toString() || '0');
    setPaymentTermId(c.paymentTermId || '');
    setDefaultTaxRateId(c.defaultTaxRateId || '');
    setContactGroupId(c.contactGroupId || '');
    setContactGroup(c.contactGroup || '');
    setWeeklyOff(c.weeklyOff || '');
    setVisitFrequency(c.visitFrequency || 'monthly');
    setPreferredVisitWeek(c.preferredVisitWeek || 'any');
    const savedTrpVal = c.preferredTransporterId || c.preferredTransporter || '';
    const matchedTrp = transportersList.find(t => t.id === savedTrpVal || t.name === savedTrpVal);
    setPreferredTransporterId(matchedTrp ? matchedTrp.id : savedTrpVal);
    setNotes(c.notes || '');
    setAddresses(c.addresses && c.addresses.length > 0 ? c.addresses.map(a => ({
      id: a.id,
      label: a.label,
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2 || '',
      city: a.city,
      stateCode: a.stateCode,
      stateName: a.stateName,
      pincode: a.pincode,
      country: a.country || 'India',
      isBillingDefault: a.isBillingDefault,
      isShippingDefault: a.isShippingDefault,
    })) : [
      {
        label: 'Main',
        addressLine1: '',
        addressLine2: '',
        city: '',
        stateCode: '',
        stateName: '',
        pincode: '',
        country: 'India',
        isBillingDefault: true,
        isShippingDefault: true,
      }
    ]);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleAddAddressField = () => {
    setAddresses(prev => [
      ...prev,
      {
        label: prev.length === 1 ? 'Shipping' : 'Warehouse',
        addressLine1: '',
        addressLine2: '',
        city: '',
        stateCode: '',
        stateName: '',
        pincode: '',
        country: 'India',
        isBillingDefault: false,
        isShippingDefault: false,
      }
    ]);
  };

  const handleRemoveAddressField = (index: number) => {
    setAddresses(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAddressChange = (index: number, field: string, value: any) => {
    setAddresses(prev => {
      const updatedList = prev.map((addr, i) => {
        if (i !== index) return addr;
        const updated = { ...addr };
        if (field === 'stateCode') {
          const stateObj = INDIAN_STATES.find(s => s.code === value);
          updated.stateCode = value;
          updated.stateName = stateObj ? stateObj.name : '';
        } else {
          updated[field] = value;
        }
        return updated;
      });

      return updatedList.map((addr, i) => {
        if (field === 'isBillingDefault' && value === true) {
          return { ...addr, isBillingDefault: i === index };
        }
        if (field === 'isShippingDefault' && value === true) {
          return { ...addr, isShippingDefault: i === index };
        }
        return addr;
      });
    });
  };

  const promptDeactivate = (contactId: string) => {
    setDeactivateConfirmContactId(contactId);
  };

  const executeDeactivate = async () => {
    if (!deactivateConfirmContactId) return;
    try {
      setLocalError(null);
      await api.patch(`${API_ROUTES.CONTACTS.BASE}/${deactivateConfirmContactId}/status`, { isActive: false });
      toast.success('Contact deactivated successfully');
      setDeactivateConfirmContactId(null);
      if (viewContact?.id === deactivateConfirmContactId) {
        setViewContact(prev => prev ? { ...prev, isActive: false } : null);
      }
      refetch();
    } catch (err: any) {
      setLocalError(err.response?.data?.message || 'Failed to deactivate contact');
    }
  };

  const promptActivate = (contactId: string) => {
    setActivateConfirmContactId(contactId);
  };

  const executeActivate = async () => {
    if (!activateConfirmContactId) return;
    try {
      setLocalError(null);
      await api.patch(`${API_ROUTES.CONTACTS.BASE}/${activateConfirmContactId}/status`, { isActive: true });
      toast.success('Contact activated successfully');
      setActivateConfirmContactId(null);
      if (viewContact?.id === activateConfirmContactId) {
        setViewContact(prev => prev ? { ...prev, isActive: true } : null);
      }
      refetch();
    } catch (err: any) {
      setLocalError(err.response?.data?.message || 'Failed to activate contact');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    // Filter out address rows that are completely empty / untouched
    const cleanAddresses = addresses
      .filter((addr) => {
        if (addr.id) return true; // Keep existing addresses
        return !!(
          addr.addressLine1?.trim() ||
          addr.city?.trim() ||
          addr.stateCode ||
          addr.pincode?.trim()
        );
      })
      .map((addr) => ({
        id: addr.id,
        label: addr.label || 'Main',
        addressLine1: addr.addressLine1 || '',
        addressLine2: addr.addressLine2 || null,
        city: addr.city || '',
        stateCode: addr.stateCode || '',
        stateName: addr.stateName || '',
        pincode: addr.pincode || '',
        country: addr.country || 'India',
        isBillingDefault: !!addr.isBillingDefault,
        isShippingDefault: !!addr.isShippingDefault,
      }));

    const payload: CreateContactFormData = {
      type,
      displayName,
      tags: [],
      companyName: companyName || null,
      contactPerson: contactPerson || null,
      gstin: gstin || null,
      gstRegistrationType: gstRegistrationType as any,
      pan: pan || null,
      email: email || null,
      phone: phone || null,
      mobile: mobile || null,
      website: website || null,
      creditLimit: parseFloat(creditLimit) || 0,
      openingBalance: parseFloat(openingBalance) || 0,
      paymentTermId: paymentTermId || null,
      defaultTaxRateId: defaultTaxRateId || null,
      contactGroupId: contactGroupId || null,
      contactGroup: contactGroup || null,
      weeklyOff: weeklyOff || null,
      visitFrequency: visitFrequency || 'monthly',
      preferredVisitWeek: preferredVisitWeek || 'any',
      preferredTransporterId: preferredTransporterId || null,
      notes: notes || null,
      addresses: cleanAddresses,
    };

    try {
      // Validate schema
      createContactSchema.parse(payload);

      if (editingContact) {
        await api.put(`${API_ROUTES.CONTACTS.BASE}/${editingContact.id}`, payload);
      } else {
        await api.post(API_ROUTES.CONTACTS.BASE, payload);
      }

      setModalOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['masters-contacts-limit-100'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: any) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {};
        err.issues.forEach(issue => {
          const path = issue.path.join('.');
          errors[path] = issue.message;
        });
        setFormErrors(errors);
      } else {
        toast.error(err.response?.data?.message || 'Failed to save contact profile');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Contacts Directory Workspace"
        subtitle="Manage B2B customer accounts, material suppliers, and service vendors with ease."
      >
        {canCreate && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setBulkImportOpen(true)} className="border-zinc-200 hover:bg-zinc-50 text-xs font-semibold">
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Bulk Import CSV
            </Button>
            <Button onClick={openAddModal} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add New Contact
            </Button>
          </div>
        )}
      </PageHeader>

      {/* Main Content Area */}
      <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden flex flex-col md:flex-row min-h-[72vh]">
        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-zinc-200/80 bg-zinc-50/40">
          <div className="px-4 py-3.5 border-b border-zinc-200/80 bg-zinc-100/60 font-bold text-xs uppercase tracking-wider text-zinc-700 flex justify-between items-center">
            <span>Contact Groups</span>
            <div className="flex gap-2">
              <button onClick={() => { setGroupSortBy('name'); setGroupSortOrder(o=>o==='asc'?'desc':'asc') }} className="text-[11px] font-semibold text-zinc-500 hover:text-amber-700">
                Name {groupSortBy==='name'?(groupSortOrder==='asc'?'▲':'▼'):'↕'}
              </button>
              <button onClick={() => { setGroupSortBy('balance'); setGroupSortOrder(o=>o==='asc'?'desc':'asc') }} className="text-[11px] font-semibold text-zinc-500 hover:text-amber-700">
                Bal {groupSortBy==='balance'?(groupSortOrder==='asc'?'▲':'▼'):'↕'}
              </button>
            </div>
          </div>

          <div className="flex flex-col max-h-[600px] overflow-y-auto divide-y divide-zinc-100">
            <button
              className={`px-4 py-3 text-xs text-left flex justify-between items-center transition-all ${
                !selectedGroupId ? 'bg-amber-500/10 text-amber-900 font-bold border-l-4 border-amber-600' : 'hover:bg-zinc-100/80 text-zinc-700 font-medium'
              }`}
              onClick={() => { setSelectedGroupId(null); setPage(1); }}
            >
              <span>All Directory Contacts</span>
            </button>

            {sidebarGroups.map((g: any) => (
              <button
                key={g.id}
                className={`px-4 py-3 text-xs text-left flex justify-between items-center transition-all ${
                  selectedGroupId === g.id ? 'bg-amber-500/10 text-amber-900 font-bold border-l-4 border-amber-600' : 'hover:bg-zinc-100/80 text-zinc-700 font-medium'
                }`}
                onClick={() => { setSelectedGroupId(g.id); setPage(1); }}
              >
                <span className="truncate mr-2">{g.name}</span>
                <span className={`font-mono text-[11px] whitespace-nowrap ${Number(g.balance) > 0 ? 'text-amber-700 font-bold' : 'text-zinc-400'}`}>
                  {formatCurrency(Number(g.balance) || 0)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main List */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Filter Bar */}
          <SearchFilterBar className="border-0 shadow-none rounded-none border-b border-zinc-200/80 p-4 bg-white">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Search contacts by name, company, email, phone, or GSTIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl w-full"
              />
            </div>
            <div className="w-full md:w-40">
              <Select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                options={[
                  { value: '', label: 'All Types' },
                  { value: 'customer', label: 'Customers' },
                  { value: 'vendor', label: 'Vendors' },
                  { value: 'both', label: 'Customer & Vendor' },
                ]}
                className="h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl font-medium"
              />
            </div>
            <div className="w-full md:w-36">
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active Only' },
                  { value: 'inactive', label: 'Deactivated' },
                ]}
                className="h-[36px] text-xs bg-zinc-50 border-zinc-200 rounded-xl font-medium"
              />
            </div>
          </SearchFilterBar>

          {displayError && (
            <Alert variant="destructive" className="m-4">
              <span>{displayError}</span>
            </Alert>
          )}

          <DataTable
            className="border-0 shadow-none rounded-none flex-1"
            headers={tableHeaders}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            isLoading={queryLoading && contacts.length === 0}
            isEmpty={contacts.length === 0}
            emptyMessage="No customers or suppliers found matching the criteria."
          >
            {(contacts as Contact[]).map((contact: Contact) => (
              <TableRow
                key={contact.id}
                onClick={() => router.push(`/dashboard/analytics/customers?customerId=${contact.id}`)}
                className={`transition-colors cursor-pointer group border-b border-zinc-100 ${
                  contact.isActive
                    ? 'hover:bg-zinc-50/80'
                    : 'bg-zinc-100/60 hover:bg-zinc-100 opacity-75 border-l-4 border-l-rose-400'
                }`}
              >
                <TableCell className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setViewContact(contact); }}
                      className={`text-left font-bold text-xs p-0 h-auto transition-colors ${
                        contact.isActive
                          ? 'text-amber-900 group-hover:text-amber-600'
                          : 'text-zinc-500 line-through decoration-zinc-400'
                      }`}
                    >
                      {contact.displayName}
                    </Button>
                    {!contact.isActive && (
                      <Badge variant="outline" className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 bg-rose-50 text-rose-700 border-rose-200">
                        Deactivated
                      </Badge>
                    )}
                    {contact.groupName && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-zinc-100 border-zinc-200 text-zinc-600">
                        {contact.groupName}
                      </Badge>
                    )}
                  </div>
                  {contact.contactPerson && (
                    <span className="block text-[11px] text-zinc-500 mt-0.5">
                      Attn: {contact.contactPerson}
                    </span>
                  )}
                </TableCell>
                <TableCell className={`px-4 py-3.5 text-xs font-medium ${contact.isActive ? 'text-zinc-700' : 'text-zinc-400'}`}>
                  {contact.companyName || '—'}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      !contact.isActive
                        ? 'bg-zinc-100 text-zinc-400 border-zinc-200'
                        : contact.type === 'customer'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : contact.type === 'vendor'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : 'bg-purple-50 text-purple-800 border-purple-200'
                    }`}
                  >
                    {contact.type}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-3.5 font-mono text-xs text-zinc-500">
                  {contact.gstin ? (
                    <span className={`block font-bold ${contact.isActive ? 'text-zinc-800' : 'text-zinc-500'}`}>{contact.gstin}</span>
                  ) : contact.pan ? (
                    <span className="block">PAN: {contact.pan}</span>
                  ) : (
                    <span className="text-zinc-400">Unregistered</span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-xs">
                  <span className={`block font-medium ${contact.isActive ? 'text-zinc-800' : 'text-zinc-500'}`}>{contact.phone || contact.mobile || '—'}</span>
                  {contact.email && <span className="block text-zinc-400 mt-0.5 font-mono text-[11px]">{contact.email}</span>}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-right font-mono text-xs">
                  <span className={`font-bold ${!contact.isActive ? 'text-zinc-400' : Number((contact as any).balance) > 0 ? 'text-amber-700' : 'text-zinc-600'}`}>
                    {formatCurrency(Number((contact as any).balance) || 0)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  {contact.isActive ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  ) : (
                    <Badge variant="outline" className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border-rose-200 px-2 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      Deactivated
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setViewContact(contact); }}
                      className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:bg-amber-50 h-7 px-2"
                    >
                      View
                    </Button>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); openEditModal(contact); }}
                        className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 h-7 px-2"
                      >
                        Edit
                      </Button>
                    )}
                    {canDelete && (
                      contact.isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); promptDeactivate(contact.id); }}
                          className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); promptActivate(contact.id); }}
                          className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 h-7 px-2.5 rounded-lg"
                        >
                          Activate
                        </Button>
                      )
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>

          <div className="p-4 border-t border-zinc-200/80 bg-white">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={contactsData?.pagination?.total}
              onPageChange={setPage}
            />
          </div>
        </div>
      </Card>

      {/* SIDE SHEET: VIEW DETAILS */}
      <Drawer
        isOpen={!!viewContact}
        onClose={() => setViewContact(null)}
        title="Contact Profile"
        size="lg"
      >
        {viewContact && (
          <div className="space-y-6 py-2">
            {/* Profile Card Summary */}
            <div className="space-y-2">
              <h4 className="text-2xl font-bold text-zinc-900">{viewContact.displayName}</h4>
              {viewContact.companyName && (
                <p className="text-sm font-semibold text-amber-500 uppercase tracking-wide">{viewContact.companyName}</p>
              )}
              <div className="flex items-center gap-3">
                <span className="inline-flex rounded-full bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 text-xs font-bold text-zinc-700 uppercase">
                  {viewContact.type}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  viewContact.isActive 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${viewContact.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {viewContact.isActive ? 'Active' : 'Deactivated'}
                </span>
              </div>
            </div>

            {/* General details grid */}
            <div className="border-t border-zinc-200/60 pt-4 grid gap-4 grid-cols-2 text-xs">
              <div>
                <span className="text-slate-500 uppercase font-semibold">Email:</span>
                <p className="font-medium text-zinc-700 font-mono mt-0.5">{viewContact.email || '—'}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold">Phone:</span>
                <p className="font-medium text-zinc-700 mt-0.5">{viewContact.phone || '—'}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold">Mobile:</span>
                <p className="font-medium text-zinc-700 mt-0.5">{viewContact.mobile || '—'}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold">Website:</span>
                <p className="font-medium text-zinc-700 font-mono mt-0.5">{viewContact.website || '—'}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold">GST registration:</span>
                <p className="font-medium text-zinc-700 uppercase mt-0.5">{viewContact.gstRegistrationType || 'unregistered'}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold">GSTIN:</span>
                <p className="font-medium text-zinc-700 font-mono mt-0.5">{viewContact.gstin || '—'}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold">PAN ID:</span>
                <p className="font-medium text-zinc-700 font-mono mt-0.5">{viewContact.pan || '—'}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold">Contact group:</span>
                <p className="font-medium text-zinc-700 mt-0.5">{viewContact.groupName || viewContact.contactGroup || '—'}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold">Weekly Off Day:</span>
                <p className="font-bold text-amber-700 mt-0.5">{viewContact.weeklyOff ? viewContact.weeklyOff : 'None (Operating Daily)'}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold">Credit Limit:</span>
                <p className="font-medium text-zinc-700 font-mono mt-0.5">{formatCurrency(Number(viewContact.creditLimit))}</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold">Opening Balance:</span>
                <p className="font-medium text-zinc-700 font-mono mt-0.5">{formatCurrency(Number(viewContact.openingBalance))}</p>
              </div>
            </div>

            {/* Address lists */}
            <div className="border-t border-zinc-200/60 pt-4 space-y-3">
              <h5 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Registered Address Book</h5>
              <div className="space-y-3">
                {viewContact.addresses?.map((addr) => (
                  <div key={addr.id} className="bg-zinc-50 border border-zinc-200 p-3.5 rounded-lg space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-zinc-900 uppercase">{addr.label}</span>
                      <div className="flex gap-1.5">
                        {addr.isBillingDefault && (
                          <span className="bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 text-[9px] rounded text-amber-700 uppercase font-bold">Billing Default</span>
                        )}
                        {addr.isShippingDefault && (
                          <span className="bg-blue-500/10 border border-blue-500/25 px-1.5 py-0.5 text-[9px] rounded text-blue-700 uppercase font-bold">Shipping Default</span>
                        )}
                      </div>
                    </div>
                    <p className="text-zinc-500 leading-relaxed font-medium">
                      {addr.addressLine1}
                      {addr.addressLine2 && <span className="block">{addr.addressLine2}</span>}
                      <span className="block mt-0.5">{addr.city}, {addr.stateName} - {addr.pincode}</span>
                      <span className="block font-semibold text-[10px] text-slate-500 uppercase mt-0.5">{addr.country}</span>
                    </p>
                  </div>
                ))}
                {(!viewContact.addresses || viewContact.addresses.length === 0) && (
                  <p className="text-xs text-slate-500 italic">No addresses saved for this contact.</p>
                )}
              </div>
            </div>

            {/* Custom Pricing Rules */}
            <div className="border-t border-zinc-200/60 pt-4 space-y-4">
              <h5 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Custom Contract Pricing</h5>
              
              {/* Form to Add Custom Price */}
              {canEdit && (
                <form onSubmit={handleAddCustomPrice} className="space-y-3 bg-white/20 border border-zinc-200/60 p-3 rounded-lg text-xs">
                  <div className="font-semibold text-zinc-500 uppercase tracking-wider text-[10px]">Add Custom Price Override</div>
                  <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <SearchableSelect
                        placeholder="Search product..."
                        value={selectedProductId}
                        onChange={(val) => {
                          setSelectedProductId(val);
                          setSelectedVariantId('');
                        }}
                        options={allProducts.map((p) => ({
                          value: p.id,
                          label: p.name,
                          sku: p.sku || undefined,
                          sublabel: p.sku ? `SKU: ${p.sku}` : undefined,
                        }))}
                      />
                    </div>

                    {selectedProduct?.hasVariants && (
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                          Product Variant
                        </label>
                        <Select
                          value={selectedVariantId}
                          onChange={(e) => setSelectedVariantId(e.target.value)}
                          options={[
                            { value: '', label: 'Select variant...' },
                            ...selectedProductVariants.map((v) => ({
                              value: v.id,
                              label: `${v.name}${v.sku ? ` (${v.sku})` : ''}`
                            }))
                          ]}
                          className="w-full border-zinc-200 bg-white focus:border-amber-500"
                        />
                      </div>
                    )}

                    <div className="md:col-span-2">
                      <Input
                        label="Override Price (INR)"
                        type="number"
                        step="0.01"
                        value={customPriceVal}
                        onChange={(e) => setCustomPriceVal(e.target.value)}
                        placeholder="e.g. 95.00"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={addingCustomPrice}
                    >
                      {addingCustomPrice ? 'Saving...' : 'Add Override'}
                    </Button>
                  </div>
                </form>
              )}

              {/* List of Custom Prices */}
              <div className="space-y-2 mt-4">
                <DataTable
                  headers={[
                    { key: 'productName', label: 'Product / Variant', sortable: true },
                    { key: 'generalPrice', label: 'General Rate' },
                    { key: 'customPrice', label: 'Contract Rate', sortable: true },
                    ...(canEdit ? [{ key: 'actions', label: 'Action', align: 'right' as const }] : []),
                  ]}
                  sortBy={customPricesSortBy}
                  sortOrder={customPricesSortOrder}
                  onSort={handleCustomPricesSort}
                  isLoading={customPricesLoading}
                  isEmpty={customPrices.length === 0}
                  emptyMessage="No custom rates defined for this contact."
                >
                  {customPrices.map((cp) => {
                    const isVendor = viewContact.type === 'vendor';
                    const generalPrice = cp.variantId
                      ? (isVendor ? cp.variantCostPrice : cp.variantSellingPrice)
                      : (isVendor ? cp.productCostPrice : cp.productSellingPrice);

                    return (
                      <TableRow key={cp.id} className="hover:bg-zinc-50 transition-colors">
                        <TableCell className="px-6 py-4 font-medium text-zinc-700">
                          <div>{cp.productName}</div>
                          {cp.variantName && (
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                              {cp.variantName}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-4 font-mono text-zinc-500">
                          {formatCurrency(Number(generalPrice))}
                        </TableCell>
                        <TableCell className="px-6 py-4 font-mono text-amber-500 font-bold">
                          {formatCurrency(Number(cp.customPrice))}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => promptDeleteCustomPrice(cp.id)}
                              className="text-red-700 hover:text-red-800 hover:bg-red-400/10"
                            >
                              Delete
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </DataTable>

                <Pagination
                  currentPage={customPricesPage}
                  totalPages={totalCustomPricesPages}
                  onPageChange={(p) => {
                    setCustomPricesPage(p);
                  }}
                />
              </div>
            </div>

            {viewContact.notes && (
              <div className="border-t border-zinc-200/60 pt-4 space-y-1 text-xs">
                <span className="text-slate-500 uppercase font-semibold">Internal Notes:</span>
                <p className="bg-zinc-50 p-3 border border-slate-850 rounded text-zinc-500 leading-relaxed whitespace-pre-wrap">{viewContact.notes}</p>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* DIALOG MODAL: CREATE / EDIT */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900">
              {editingContact ? 'Edit Contact Profile' : 'Add New Customer / Supplier Contact'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 pt-2">
            {/* Contact Type Segmented Cards */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Contact Relationship Type *</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'customer', label: 'Customer', desc: 'Buyers & Clients' },
                  { value: 'vendor', label: 'Vendor / Supplier', desc: 'Sellers & Suppliers' },
                  { value: 'both', label: 'Customer & Vendor', desc: 'Dual Trade Partner' },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value as any)}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      type === t.value
                        ? 'border-amber-600 bg-amber-50/50 shadow-sm'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <span className="font-bold text-xs text-zinc-900 block">{t.label}</span>
                    <span className="text-[10px] text-zinc-500">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Section 1: Basic Identity */}
            <div className="bg-zinc-50/60 border border-zinc-200/80 p-4 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">1. Party Identity & Contacts</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Display Name / Trade Name *"
                  name="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  error={formErrors.displayName}
                  className="h-9 text-xs"
                  required
                />
                <Input
                  label="Registered Company Name"
                  name="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  error={formErrors.companyName}
                  className="h-9 text-xs"
                />
                <Input
                  label="Contact Person (Attn)"
                  name="contactPerson"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  error={formErrors.contactPerson}
                  className="h-9 text-xs"
                />
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={formErrors.email}
                  autoComplete="off"
                  className="h-9 text-xs"
                />
                <Input
                  label="Mobile Number"
                  name="mobile"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  error={formErrors.mobile}
                  className="h-9 text-xs"
                />
                <Input
                  label="Phone (Landline)"
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  error={formErrors.phone}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Section 2: GST & Tax Profile */}
            <div className="bg-zinc-50/60 border border-zinc-200/80 p-4 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">2. Tax & GST Profile</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <Select
                  label="GST Registration Scheme"
                  value={gstRegistrationType}
                  onChange={(e) => setGstRegistrationType(e.target.value)}
                  options={GST_SCHEMES}
                  className="h-9 text-xs bg-white"
                />
                <Input
                  label="GSTIN Number"
                  name="gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  error={formErrors.gstin}
                  className="h-9 text-xs uppercase font-mono"
                  placeholder="27AAAAA1111A1Z1"
                  disabled={gstRegistrationType === 'unregistered' || gstRegistrationType === 'consumer'}
                />
                <Input
                  label="PAN Number"
                  name="pan"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  error={formErrors.pan}
                  className="h-9 text-xs uppercase font-mono"
                  placeholder="AAAAA1111A"
                />
              </div>
            </div>

            {/* Section 3: Credit & Accounts */}
            <div className="bg-zinc-50/60 border border-zinc-200/80 p-4 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">3. Terms & Balances</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Opening Balance (₹)"
                  name="openingBalance"
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  error={formErrors.openingBalance}
                  className="h-9 text-xs font-mono"
                />
                <Input
                  label="Credit Limit Allocation (₹)"
                  name="creditLimit"
                  type="number"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  error={formErrors.creditLimit}
                  className="h-9 text-xs font-mono"
                />
                <Select
                  label="Default Payment Term"
                  value={paymentTermId}
                  onChange={(e) => setPaymentTermId(e.target.value)}
                  options={[
                    { value: '', label: 'Select Payment Term...' },
                    ...paymentTerms.map(pt => ({ value: pt.id, label: pt.name }))
                  ]}
                  className="h-9 text-xs bg-white"
                />
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Contact Group</label>
                    <button
                      type="button"
                      onClick={() => setQuickGroupModalOpen(true)}
                      className="text-[11px] font-bold text-amber-700 hover:text-amber-800"
                    >
                      + Quick Group
                    </button>
                  </div>
                  <SearchableSelect
                    value={contactGroupId}
                    onChange={(val) => {
                      setContactGroupId(val);
                      const selected = contactGroups.find(g => g.id === val);
                      setContactGroup(selected ? selected.name : '');
                    }}
                    options={[
                      { value: '', label: 'None' },
                      ...contactGroups.map(g => ({ value: g.id, label: g.name }))
                    ]}
                    placeholder="Search group..."
                    error={formErrors.contactGroupId}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Weekly Off Day</label>
                  <Select
                    value={weeklyOff}
                    onChange={(e) => setWeeklyOff(e.target.value)}
                    options={WEEKLY_OFF_OPTIONS}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Visit Frequency</label>
                  <Select
                    value={visitFrequency}
                    onChange={(e) => setVisitFrequency(e.target.value)}
                    options={VISIT_FREQUENCY_OPTIONS}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Preferred Visit Week (Monthly)</label>
                  <Select
                    value={preferredVisitWeek}
                    onChange={(e) => setPreferredVisitWeek(e.target.value)}
                    options={PREFERRED_VISIT_WEEK_OPTIONS}
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Preferred Transporter / Freight Agency</label>
                    <button
                      type="button"
                      onClick={() => setQuickTransporterModalOpen(true)}
                      className="text-[11px] font-bold text-amber-700 hover:text-amber-800"
                    >
                      + Quick Transporter
                    </button>
                  </div>
                  <SearchableSelect
                    placeholder="Select preferred transporter..."
                    options={transporterOptions}
                    value={preferredTransporterId}
                    onChange={setPreferredTransporterId}
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Address Registry */}
            <div className="border-t border-zinc-200/80 pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider">4. Address Book Registry</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddAddressField}
                  className="text-xs border-zinc-200"
                >
                  + Add Address Line
                </Button>
              </div>

              <div className="space-y-4">
                {addresses.map((addr, index) => (
                  <div key={index} className="bg-zinc-50/80 border border-zinc-200/80 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-700 uppercase">Address #{index + 1}</span>
                      {addresses.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAddressField(index)}
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <Input
                        label="Label"
                        value={addr.label}
                        onChange={(e) => handleAddressChange(index, 'label', e.target.value)}
                        className="h-8 text-xs"
                        required
                      />
                      <Input
                        label="Address Line 1"
                        value={addr.addressLine1}
                        onChange={(e) => handleAddressChange(index, 'addressLine1', e.target.value)}
                        className="h-8 text-xs"
                        required
                      />
                      <Input
                        label="Address Line 2"
                        value={addr.addressLine2}
                        onChange={(e) => handleAddressChange(index, 'addressLine2', e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Input
                        label="City"
                        value={addr.city}
                        onChange={(e) => handleAddressChange(index, 'city', e.target.value)}
                        className="h-8 text-xs"
                        required
                      />
                      <Select
                        label="State"
                        value={addr.stateCode}
                        onChange={(e) => handleAddressChange(index, 'stateCode', e.target.value)}
                        required
                        options={[
                          { value: '', label: 'Select State' },
                          ...INDIAN_STATES.map((s) => ({ value: s.code, label: s.name }))
                        ]}
                        className="h-8 text-xs bg-white"
                      />
                      <Input
                        label="Pincode"
                        value={addr.pincode}
                        onChange={(e) => handleAddressChange(index, 'pincode', e.target.value)}
                        maxLength={6}
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div className="flex gap-6 text-xs pt-2 border-t border-zinc-200/60">
                      <label className="flex items-center space-x-2 text-zinc-700 font-medium">
                        <input
                          type="checkbox"
                          checked={!!addr.isBillingDefault}
                          onChange={(e) => handleAddressChange(index, 'isBillingDefault', e.target.checked)}
                          className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span>Billing Default</span>
                      </label>
                      <label className="flex items-center space-x-2 text-zinc-700 font-medium">
                        <input
                          type="checkbox"
                          checked={!!addr.isShippingDefault}
                          onChange={(e) => handleAddressChange(index, 'isShippingDefault', e.target.checked)}
                          className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span>Shipping Default</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 border-t border-zinc-200/80 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition-all"
              >
                {submitting ? 'Saving Profile...' : editingContact ? 'Update Contact' : 'Save Contact'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {bulkImportOpen && (
        <BulkImportModal
          onClose={() => setBulkImportOpen(false)}
          onSuccess={() => {
            setBulkImportOpen(false);
            refetch();
          }}
        />
      )}

      {/* Quick Group Create Modal */}
      <Dialog open={quickGroupModalOpen} onOpenChange={setQuickGroupModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              label="Group Name *"
              value={quickGroupName}
              onChange={(e) => setQuickGroupName(e.target.value)}
              placeholder="e.g. VIP Customers"
              autoFocus
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickGroupModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleQuickCreateGroup}
                disabled={isCreatingQuickGroup || !quickGroupName.trim()}
              >
                {isCreatingQuickGroup ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DEACTIVATE CONTACT CONFIRMATION MODAL */}
      <ConfirmDialog
        isOpen={!!deactivateConfirmContactId}
        onClose={() => setDeactivateConfirmContactId(null)}
        onConfirm={executeDeactivate}
        title="Deactivate Contact"
        description="Are you sure you want to deactivate this contact?"
        warning="This contact will be marked as inactive and moved to the end of the directory list. You can reactivate it at any time."
        confirmText="Confirm Deactivate"
        variant="destructive"
      />

      {/* ACTIVATE CONTACT CONFIRMATION MODAL */}
      <ConfirmDialog
        isOpen={!!activateConfirmContactId}
        onClose={() => setActivateConfirmContactId(null)}
        onConfirm={executeActivate}
        title="Reactivate Contact"
        description="Are you sure you want to reactivate this contact? It will be marked as active and available across orders, dispatches, and invoices."
        confirmText="Confirm Reactivate"
        variant="default"
      />

      {/* DELETE CUSTOM PRICE CONFIRMATION MODAL */}
      <ConfirmDialog
        isOpen={!!deleteConfirmCustomPriceId}
        onClose={() => setDeleteConfirmCustomPriceId(null)}
        onConfirm={executeDeleteCustomPrice}
        title="Delete Custom Price"
        description="Are you sure you want to delete this custom price override?"
        variant="destructive"
      />
      {/* Quick Transporter Create Modal */}
      <QuickTransporterModal
        open={quickTransporterModalOpen}
        onOpenChange={setQuickTransporterModalOpen}
        onTransporterCreated={(newTrp) => {
          setTransportersList(prev => [newTrp, ...prev]);
          setPreferredTransporterId(newTrp.id);
          setPreferredTransporter(newTrp.name);
        }}
      />
    </div>
  );
}
