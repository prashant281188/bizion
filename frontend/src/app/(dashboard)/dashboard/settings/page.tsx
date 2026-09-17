'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { API_ROUTES, INDIAN_STATES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { orgSettingsSchema, type OrgSettingsInput } from '@/schemas/org.schema';
import { ZodError } from 'zod';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  Receipt, 
  MapPin, 
  Landmark, 
  CalendarDays, 
  Store, 
  Save, 
  Loader2, 
  ExternalLink,
  Copy,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Info
} from 'lucide-react';
import { LogoUploader } from './_components/logo-uploader';

const GST_SCHEMES = [
  { value: 'regular', label: 'Regular Scheme' },
  { value: 'composition', label: 'Composition Scheme' },
  { value: 'unregistered', label: 'Unregistered' },
  { value: 'consumer', label: 'Consumer' },
  { value: 'sez', label: 'Special Economic Zone (SEZ)' },
  { value: 'deemed_export', label: 'Deemed Export' },
];

const SETTINGS_SECTIONS = [
  { id: 'profile', label: 'General & Profile', icon: Building2, desc: 'Company branding & contact details' },
  { id: 'tax', label: 'Tax & Compliance', icon: Receipt, desc: 'GSTIN, PAN, TAN & legal registration' },
  { id: 'address', label: 'Registered Address', icon: MapPin, desc: 'HQ physical address & state logic' },
  { id: 'banking', label: 'Invoicing & Banking', icon: Landmark, desc: 'Bank accounts, UPI & payment terms' },
  { id: 'financial_years', label: 'Financial Years & Series', icon: CalendarDays, desc: 'Prefix numbering & active year' },
  { id: 'storefront', label: 'B2B Storefront', icon: Store, desc: 'Public catalog URL & promo banners' },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: paymentTermsData } = useQuery({
    queryKey: ['paymentTermsForSettings'],
    queryFn: async () => {
      const res = await api.get('/masters/payment-terms?limit=500');
      return res.data.data as { id: string; name: string }[];
    },
    staleTime: 60000,
  });
  const paymentTerms = paymentTermsData || [];

  // Form State
  const [formData, setFormData] = useState<OrgSettingsInput>({
    name: '',
    slug: '',
    legalName: '',
    email: '',
    phone: '',
    website: '',
    logoUrl: '',
    gstin: '',
    gstRegistrationType: 'regular',
    pan: '',
    tan: '',
    cin: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateCode: '',
    stateName: '',
    pincode: '',
    country: 'India',
    fyStartMonth: 4,
    defaultCurrency: 'INR',
    settings: {
      invoicePrefix: 'INV-',
      nextInvoiceNumber: 1,
      invoiceTerms: '',
      invoiceNotes: '',
      bankName: '',
      bankBranch: '',
      bankAccountNumber: '',
      bankIfscCode: '',
      upiId: '',
      storefrontCarousel: [],
      financialYears: [],
      invoiceCustomFields: [],
      storefront: {
        tagline: '',
        announcementBar: '',
        showAnnouncementBar: false,
        exploreButtonText: 'Explore Catalog',
        exploreButtonUrl: '',
        requestQuoteButtonText: 'Request Quotation',
        requestQuoteButtonUrl: '',
        aboutBadge: '',
        aboutTitle: '',
        aboutDescription: '',
        aboutParagraph1: '',
        aboutParagraph2: '',
        contactBadge: '',
        contactTitle: '',
        contactDescription: '',
        footerDescription: '',
        trustBadges: [],
      },
    },
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get(API_ROUTES.ORGANIZATION.ME);
      const data = res.data.data;

      setFormData({
        name: data.name || '',
        slug: data.slug || '',
        legalName: data.legalName || '',
        email: data.email || '',
        phone: data.phone || '',
        website: data.website || '',
        logoUrl: data.logoUrl || '',
        gstin: data.gstin || '',
        gstRegistrationType: data.gstRegistrationType || 'regular',
        pan: data.pan || '',
        tan: data.tan || '',
        cin: data.cin || '',
        addressLine1: data.addressLine1 || '',
        addressLine2: data.addressLine2 || '',
        city: data.city || '',
        stateCode: data.stateCode || '',
        stateName: data.stateName || '',
        pincode: data.pincode || '',
        country: data.country || 'India',
        fyStartMonth: data.fyStartMonth || 4,
        defaultCurrency: data.defaultCurrency || 'INR',
        settings: {
          invoicePrefix: data.settings?.invoicePrefix || 'INV-',
          nextInvoiceNumber: Number(data.settings?.nextInvoiceNumber) || 1,
          invoiceTerms: data.settings?.invoiceTerms || '',
          invoiceNotes: data.settings?.invoiceNotes || '',
          bankName: data.settings?.bankName || '',
          bankBranch: data.settings?.bankBranch || '',
          bankAccountNumber: data.settings?.bankAccountNumber || '',
          bankIfscCode: data.settings?.bankIfscCode || '',
          upiId: data.settings?.upiId || '',
          defaultPaymentTermId: data.settings?.defaultPaymentTermId || '',
          storefrontCarousel: data.settings?.storefrontCarousel || [],
          financialYears: data.settings?.financialYears || [],
          invoiceCustomFields: data.settings?.invoiceCustomFields || [],
          storefront: data.settings?.storefront || {
            tagline: '',
            announcementBar: '',
            showAnnouncementBar: false,
            exploreButtonText: 'Explore Catalog',
            requestQuoteButtonText: 'Request Quotation',
            aboutBadge: '',
            aboutTitle: '',
            aboutDescription: '',
            aboutParagraph1: '',
            aboutParagraph2: '',
            contactBadge: '',
            contactTitle: '',
            contactDescription: '',
            footerDescription: '',
          },
        },
      });
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load organization settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name.startsWith('settings.storefront.')) {
      const field = name.replace('settings.storefront.', '');
      setFormData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          storefront: {
            ...(prev.settings?.storefront || {}),
            [field]: value,
          },
        },
      }));
    } else if (name.startsWith('settings.')) {
      const settingField = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          [settingField]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

    if (formErrors[name]) {
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const selectedState = INDIAN_STATES.find((s) => s.code === code);
    
    setFormData((prev) => ({
      ...prev,
      stateCode: code,
      stateName: selectedState ? selectedState.name : '',
    }));

    if (formErrors.stateCode) {
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy.stateCode;
        return copy;
      });
    }
  };

  const handleAddCustomField = () => {
    const currentFields = formData.settings?.invoiceCustomFields || [];
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        invoiceCustomFields: [
          ...currentFields,
          {
            id: `cf_${Date.now()}`,
            label: '',
            type: 'text',
            required: false,
            showOnPrint: true,
          }
        ]
      }
    }));
  };

  const handleRemoveCustomField = (idx: number) => {
    const currentFields = formData.settings?.invoiceCustomFields || [];
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        invoiceCustomFields: currentFields.filter((_, i) => i !== idx)
      }
    }));
  };

  const handleCustomFieldChange = (idx: number, field: string, value: any) => {
    const currentFields = [...(formData.settings?.invoiceCustomFields || [])];
    currentFields[idx] = { ...currentFields[idx], [field]: value };
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        invoiceCustomFields: currentFields
      }
    }));
  };

  const handleAddFY = () => {
    const currentFYs = formData.settings?.financialYears || [];
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        financialYears: [
          ...currentFYs,
          { 
            label: '2026-27', 
            isActive: currentFYs.length === 0, 
            prefixes: {
              sales_invoice: 'INV/2026-27/',
              purchase_invoice: 'PI/2026-27/',
              credit_note: 'CN/2026-27/',
              debit_note: 'DN/2026-27/',
              inbound: 'REC/2026-27/',
              outbound: 'PAY/2026-27/'
            } 
          }
        ]
      }
    }));
  };

  const handleRemoveFY = (idx: number) => {
    const currentFYs = formData.settings?.financialYears || [];
    const updatedFYs = currentFYs.filter((_, i) => i !== idx);
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        financialYears: updatedFYs
      }
    }));
  };

  const handleFYFieldChange = (idx: number, field: string, val: any) => {
    const currentFYs = formData.settings?.financialYears || [];
    const updatedFYs = currentFYs.map((fy, i) => {
      if (i === idx) {
        let updatedFy = { ...fy, [field]: val };
        if (field === 'label' && fy.label) {
          const oldLabel = fy.label;
          const newLabel = val;
          if (oldLabel && newLabel && fy.prefixes) {
            const updatedPrefixes: Record<string, string> = {};
            for (const [key, prefix] of Object.entries(fy.prefixes)) {
              updatedPrefixes[key] = (prefix as string).replace(oldLabel, newLabel);
            }
            updatedFy.prefixes = updatedPrefixes;
          }
        }
        return updatedFy;
      }
      return fy;
    });

    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        financialYears: updatedFYs
      }
    }));
  };

  const handleFYPrefixChange = (fyIdx: number, docType: string, val: string) => {
    const currentFYs = formData.settings?.financialYears || [];
    const updatedFYs = currentFYs.map((fy, i) => {
      if (i === fyIdx) {
        return {
          ...fy,
          prefixes: {
            ...fy.prefixes,
            [docType]: val
          }
        };
      }
      return fy;
    });

    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        financialYears: updatedFYs
      }
    }));
  };

  const handleAddSlide = () => {
    const currentSlides = formData.settings?.storefrontCarousel || [];
    if (currentSlides.length >= 5) {
      toast.error('You can add up to 5 slides maximum');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        storefrontCarousel: [
          ...currentSlides,
          { badge: 'Featured Collection', title: 'New Seasonal Arrivals', desc: 'Explore our latest wholesale catalog.' }
        ]
      }
    }));
  };

  const handleRemoveSlide = (idx: number) => {
    const currentSlides = formData.settings?.storefrontCarousel || [];
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        storefrontCarousel: currentSlides.filter((_, i) => i !== idx)
      }
    }));
  };

  const handleSlideFieldChange = (idx: number, field: string, val: string) => {
    const currentSlides = formData.settings?.storefrontCarousel || [];
    const updatedSlides = currentSlides.map((s, i) => i === idx ? { ...s, [field]: val } : s);
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        storefrontCarousel: updatedSlides
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setErrorMsg(null);
    setSuccessMsg(null);
    setSaving(true);

    try {
      const validatedData = orgSettingsSchema.parse(formData);

      const cleanData = Object.entries(validatedData).reduce((acc, [key, val]) => {
        if (key === 'name' || key === 'defaultCurrency' || key === 'fyStartMonth' || key === 'settings') {
          acc[key] = val;
        } else if (val === '') {
          acc[key] = null;
        } else {
          acc[key] = val;
        }
        return acc;
      }, {} as any);

      const res = await api.put(API_ROUTES.ORGANIZATION.ME, cleanData);
      setSuccessMsg('Organization settings updated successfully!');
      toast.success('Settings saved successfully');
    } catch (err: any) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {};
        err.issues.forEach((issue) => {
          const path = issue.path.join('.');
          errors[path] = issue.message;
        });
        setFormErrors(errors);
        setErrorMsg('Please fix the validation errors before saving.');
        toast.error('Validation errors found. Check the form.');
      } else {
        setErrorMsg(err.response?.data?.message || 'Failed to update organization settings');
        toast.error('Failed to update settings');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="md:col-span-3 h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-amber-600" />
            Organization Settings
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Configure legal identity, tax registrations, invoice templates, banking channels, and B2B storefront.
          </p>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-6 rounded-xl shadow-sm flex items-center gap-2 self-start sm:self-auto"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-white" />
              Save All Settings
            </>
          )}
        </Button>
      </div>

      {successMsg && <Alert variant="success">{successMsg}</Alert>}
      {errorMsg && <Alert variant="destructive">{errorMsg}</Alert>}

      {/* Settings Layout */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mobile & Tablet Navigation (< lg screens) */}
        <div className="block lg:hidden space-y-3">
          {/* 1. Mobile Native Select Picker */}
          <div className="sm:hidden">
            <Select
              label="Select Settings Section"
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              options={SETTINGS_SECTIONS.map((s) => ({ value: s.id, label: s.label }))}
              className="h-10 text-xs font-semibold bg-white border-amber-300 rounded-xl"
            />
          </div>

          {/* 2. Tablet / Medium Horizontal Scrolling Tabs */}
          <div className="hidden sm:flex lg:hidden overflow-x-auto gap-2 pb-1 scrollbar-none">
            {SETTINGS_SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                    isActive
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-white text-zinc-600 border-zinc-200/80 hover:bg-zinc-50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop 2-Column Grid (lg+ screens) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Desktop Navigation Sidebar */}
          <div className="hidden lg:block lg:col-span-4 space-y-3 sticky top-6">
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-2 shadow-2xs space-y-1">
              {SETTINGS_SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSection(sec.id)}
                    className={`w-full text-left p-3 rounded-xl flex items-start gap-3 transition-all ${
                      isActive
                        ? 'bg-amber-500/10 text-amber-950 font-bold border border-amber-300/80 shadow-2xs'
                        : 'text-zinc-600 hover:bg-zinc-50 border border-transparent font-medium'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isActive ? 'text-amber-600' : 'text-zinc-400'}`} />
                    <div className="overflow-hidden">
                      <div className="text-xs leading-none mb-1">{sec.label}</div>
                      <div className="text-[11px] text-zinc-400 font-normal truncate">{sec.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Help Card */}
            <div className="p-4 rounded-2xl border border-zinc-200/60 bg-zinc-50/70 text-xs space-y-2">
              <div className="font-bold text-zinc-800 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-600" />
                State &amp; GST Rule
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Ensure your <strong>GSTIN</strong> state code matches the <strong>Registered State</strong>. Bizion automatically splits CGST + SGST for intrastate orders and IGST for interstate orders.
              </p>
            </div>
          </div>

        {/* Active Settings Panel */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-6">
            {/* SECTION 1: Profile & General */}
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <div className="border-b border-zinc-100 pb-3">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Company Identity &amp; Branding</h3>
                  <p className="text-xs text-zinc-500">Legal branding displayed on all documents and public URLs.</p>
                </div>

                <LogoUploader
                  value={formData.logoUrl || ''}
                  onChange={(url) => setFormData((prev) => ({ ...prev, logoUrl: url }))}
                  businessName={formData.name}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Trade / Brand Name *"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    error={formErrors.name}
                    required
                    className="h-9 text-xs"
                  />
                  <Input
                    label="Legal Entity Name"
                    name="legalName"
                    value={formData.legalName || ''}
                    onChange={handleChange}
                    error={formErrors.legalName}
                    placeholder="e.g., Acme Retail Pvt Ltd"
                    className="h-9 text-xs"
                  />
                  <Input
                    label="Official Contact Email"
                    name="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    error={formErrors.email}
                    className="h-9 text-xs"
                  />
                  <Input
                    label="Contact Phone / Mobile"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleChange}
                    error={formErrors.phone}
                    className="h-9 text-xs"
                  />
                  <Input
                    label="Official Website URL"
                    name="website"
                    type="url"
                    value={formData.website || ''}
                    onChange={handleChange}
                    error={formErrors.website}
                    placeholder="https://acmeretail.com"
                    className="h-9 text-xs md:col-span-2"
                  />
                </div>
              </div>
            )}

            {/* SECTION 2: Tax & Compliance */}
            {activeSection === 'tax' && (
              <div className="space-y-6">
                <div className="border-b border-zinc-100 pb-3">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Taxation &amp; Statutory Identifiers</h3>
                  <p className="text-xs text-zinc-500">Official government registration IDs for GST and Direct Tax.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="GSTIN Number (Indian GST) *"
                    name="gstin"
                    value={formData.gstin || ''}
                    onChange={handleChange}
                    error={formErrors.gstin}
                    placeholder="e.g., 07AAAAA1111A1Z1"
                    className="h-9 text-xs uppercase font-mono"
                  />
                  <Select
                    label="GST Registration Type"
                    name="gstRegistrationType"
                    value={formData.gstRegistrationType || 'regular'}
                    onChange={handleChange}
                    error={formErrors.gstRegistrationType}
                    options={GST_SCHEMES}
                    className="h-9 text-xs"
                  />
                  <Input
                    label="PAN Number (Income Tax)"
                    name="pan"
                    value={formData.pan || ''}
                    onChange={handleChange}
                    error={formErrors.pan}
                    placeholder="e.g., AAAAA1111A"
                    className="h-9 text-xs uppercase font-mono"
                  />
                  <Input
                    label="TAN Number (TDS Account)"
                    name="tan"
                    value={formData.tan || ''}
                    onChange={handleChange}
                    error={formErrors.tan}
                    placeholder="e.g., DELA12345B"
                    className="h-9 text-xs uppercase font-mono"
                  />
                  <Input
                    label="Corporate Identity Number (CIN)"
                    name="cin"
                    value={formData.cin || ''}
                    onChange={handleChange}
                    error={formErrors.cin}
                    placeholder="e.g., U12345DL2026PTC123456"
                    className="h-9 text-xs uppercase font-mono md:col-span-2"
                    maxLength={21}
                  />
                </div>
              </div>
            )}

            {/* SECTION 3: Address */}
            {activeSection === 'address' && (
              <div className="space-y-6">
                <div className="border-b border-zinc-100 pb-3">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Registered Headquarters Address</h3>
                  <p className="text-xs text-zinc-500">Dispatch origin and registered business premises.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Address Line 1 *"
                    name="addressLine1"
                    value={formData.addressLine1 || ''}
                    onChange={handleChange}
                    error={formErrors.addressLine1}
                    placeholder="Building, Suite, Street"
                    className="h-9 text-xs md:col-span-2"
                  />
                  <Input
                    label="Address Line 2"
                    name="addressLine2"
                    value={formData.addressLine2 || ''}
                    onChange={handleChange}
                    error={formErrors.addressLine2}
                    placeholder="Landmark, Area"
                    className="h-9 text-xs md:col-span-2"
                  />
                  <Input
                    label="City / Town"
                    name="city"
                    value={formData.city || ''}
                    onChange={handleChange}
                    error={formErrors.city}
                    className="h-9 text-xs"
                  />
                  <Select
                    label="State / Union Territory *"
                    name="stateCode"
                    value={formData.stateCode || ''}
                    onChange={handleStateChange}
                    error={formErrors.stateCode}
                    options={[
                      { value: '', label: 'Select State...' },
                      ...INDIAN_STATES.map((s) => ({ value: s.code, label: `${s.name} (${s.code})` }))
                    ]}
                    className="h-9 text-xs"
                  />
                  <Input
                    label="Pincode (6 digits) *"
                    name="pincode"
                    value={formData.pincode || ''}
                    onChange={handleChange}
                    error={formErrors.pincode}
                    placeholder="110001"
                    maxLength={6}
                    className="h-9 text-xs font-mono"
                  />
                  <Input
                    label="Country"
                    name="country"
                    value={formData.country || 'India'}
                    onChange={handleChange}
                    disabled
                    className="h-9 text-xs bg-zinc-50"
                  />
                </div>
              </div>
            )}

            {/* SECTION 4: Invoicing & Banking */}
            {activeSection === 'banking' && (
              <div className="space-y-6">
                <div className="border-b border-zinc-100 pb-3">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Bank Settlement &amp; Invoice Terms</h3>
                  <p className="text-xs text-zinc-500">Bank account details printed on tax invoices and payment vouchers.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Bank Name"
                    name="settings.bankName"
                    value={formData.settings?.bankName || ''}
                    onChange={handleChange}
                    placeholder="e.g., HDFC Bank"
                    className="h-9 text-xs"
                  />
                  <Input
                    label="Branch Name"
                    name="settings.bankBranch"
                    value={formData.settings?.bankBranch || ''}
                    onChange={handleChange}
                    placeholder="e.g., Connaught Place"
                    className="h-9 text-xs"
                  />
                  <Input
                    label="Bank Account Number"
                    name="settings.bankAccountNumber"
                    value={formData.settings?.bankAccountNumber || ''}
                    onChange={handleChange}
                    placeholder="50200012345678"
                    className="h-9 text-xs font-mono"
                  />
                  <Input
                    label="IFSC Code (11 digits)"
                    name="settings.bankIfscCode"
                    value={formData.settings?.bankIfscCode || ''}
                    onChange={handleChange}
                    placeholder="HDFC0001234"
                    maxLength={11}
                    className="h-9 text-xs uppercase font-mono"
                  />
                  <Input
                    label="UPI ID / VPA (for QR codes)"
                    name="settings.upiId"
                    value={formData.settings?.upiId || ''}
                    onChange={handleChange}
                    placeholder="company@hdfcbank"
                    className="h-9 text-xs md:col-span-2"
                  />
                  <Select
                    label="Default Payment Terms"
                    name="settings.defaultPaymentTermId"
                    value={formData.settings?.defaultPaymentTermId || ''}
                    onChange={handleChange}
                    options={[
                      { value: '', label: 'Due On Receipt (Immediate)' },
                      ...paymentTerms.map((t) => ({ value: t.id, label: t.name }))
                    ]}
                    className="h-9 text-xs md:col-span-2"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-zinc-100">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Standard Invoice Terms &amp; Conditions</label>
                    <Textarea
                      name="settings.invoiceTerms"
                      value={formData.settings?.invoiceTerms || ''}
                      onChange={handleChange}
                      rows={3}
                      placeholder="1. Goods once sold will not be taken back.&#10;2. Interest @ 18% p.a. will be charged for delayed payment."
                      className="text-xs resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Default Invoice Footer Notes</label>
                    <Textarea
                      name="settings.invoiceNotes"
                      value={formData.settings?.invoiceNotes || ''}
                      onChange={handleChange}
                      rows={2}
                      placeholder="Thank you for your business!"
                      className="text-xs resize-none"
                    />
                  </div>
                </div>

                {/* Custom Fields for Invoicing */}
                <div className="space-y-3 pt-4 border-t border-zinc-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Custom Invoice Fields</h4>
                      <p className="text-[11px] text-zinc-500">Add dynamic custom fields (PO Ref, Project Code, Broker, etc.) to your invoices.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddCustomField}
                      className="text-xs h-7 rounded-lg bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Custom Field
                    </Button>
                  </div>

                  {(formData.settings?.invoiceCustomFields || []).length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-zinc-200 text-center text-xs text-zinc-400 bg-zinc-50/50">
                      No custom fields added yet. Click &quot;Add Custom Field&quot; to configure extra attributes on your invoices.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {(formData.settings?.invoiceCustomFields || []).map((cf: any, idx: number) => (
                        <div key={cf.id || idx} className="p-3 rounded-xl border border-zinc-200 bg-zinc-50/60 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 w-full">
                            <div className="sm:col-span-6">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Field Label</label>
                              <Input
                                value={cf.label || ''}
                                onChange={(e) => handleCustomFieldChange(idx, 'label', e.target.value)}
                                placeholder="e.g., Purchase Order Ref, Broker Name"
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Input Type</label>
                              <select
                                value={cf.type || 'text'}
                                onChange={(e) => handleCustomFieldChange(idx, 'type', e.target.value)}
                                className="w-full h-8 px-2 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                              >
                                <option value="text">Text (Single Line)</option>
                                <option value="number">Numeric / Amount</option>
                                <option value="date">Date</option>
                              </select>
                            </div>
                            <div className="sm:col-span-3 flex items-center gap-3 pt-4 sm:pt-4">
                              <label className="flex items-center gap-1.5 text-xs text-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!cf.showOnPrint}
                                  onChange={(e) => handleCustomFieldChange(idx, 'showOnPrint', e.target.checked)}
                                  className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                                />
                                Print on Bill
                              </label>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveCustomField(idx)}
                            className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg self-end sm:self-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 5: Financial Years & Series */}
            {activeSection === 'financial_years' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Financial Years &amp; Document Series</h3>
                    <p className="text-xs text-zinc-500">Configure separate sequence numbering prefixes per financial year.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddFY}
                    className="text-xs h-8 font-semibold rounded-xl bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Financial Year
                  </Button>
                </div>

                {/* Financial Years List */}
                <div className="space-y-4">
                  {(formData.settings?.financialYears || []).length === 0 ? (
                    <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                      <CalendarDays className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                      <div className="text-xs font-bold text-zinc-700">No Custom Financial Years Configured</div>
                      <p className="text-[11px] text-zinc-400 mt-1 max-w-sm mx-auto">
                        Invoices will use the default prefix. Add a Financial Year (e.g. 2026-27) to enable automated year-specific prefixes.
                      </p>
                      <Button
                        type="button"
                        onClick={handleAddFY}
                        className="mt-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 rounded-xl"
                      >
                        Create Financial Year
                      </Button>
                    </div>
                  ) : (
                    (formData.settings?.financialYears || []).map((fy: any, idx: number) => (
                      <div key={idx} className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-zinc-200/60 pb-2">
                          <div className="flex items-center gap-2">
                            <Input
                              value={fy.label || ''}
                              onChange={(e) => handleFYFieldChange(idx, 'label', e.target.value)}
                              placeholder="2026-27"
                              className="h-8 text-xs font-bold w-32 bg-white font-mono"
                            />
                            {fy.isActive ? (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] border-emerald-300">Active Year</Badge>
                            ) : (
                              <Badge className="bg-zinc-100 text-zinc-600 text-[10px]">Archived</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleFYFieldChange(idx, 'isActive', !fy.isActive)}
                              className="h-7 text-[11px] text-zinc-600 hover:text-black"
                            >
                              {fy.isActive ? 'Mark Inactive' : 'Set as Active'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFY(idx)}
                              className="h-7 text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Prefixes Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                          {[
                            { key: 'sales_invoice', label: 'Sales Invoice' },
                            { key: 'purchase_invoice', label: 'Purchase Invoice' },
                            { key: 'credit_note', label: 'Credit Note' },
                            { key: 'debit_note', label: 'Debit Note' },
                            { key: 'inbound', label: 'Payment Receipt' },
                            { key: 'outbound', label: 'Payment Voucher' },
                          ].map((doc) => (
                            <div key={doc.key}>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">{doc.label}</label>
                              <Input
                                value={fy.prefixes?.[doc.key] || ''}
                                onChange={(e) => handleFYPrefixChange(idx, doc.key, e.target.value)}
                                placeholder={`INV/${fy.label}/`}
                                className="h-8 text-xs font-mono bg-white"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* SECTION 6: Storefront Branding & Content */}
            {activeSection === 'storefront' && (
              <div className="space-y-8">
                {/* Header & URL Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Public Storefront &amp; Website CMS</h3>
                    <p className="text-xs text-zinc-500">Customize text, hero banners, about page, contact info, and footer for your online catalog.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (formData.slug) {
                          navigator.clipboard.writeText(`${window.location.origin}/${formData.slug}`);
                          toast.success('Storefront URL copied to clipboard');
                        }
                      }}
                      className="h-8 text-xs bg-white"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy URL
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (formData.slug) {
                          window.open(`/${formData.slug}`, '_blank');
                        }
                      }}
                      className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      View Live Store
                    </Button>
                  </div>
                </div>

                {/* 1. Global Header & Announcement Bar */}
                <div className="space-y-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Top Navigation &amp; Announcement Bar</h4>
                      <p className="text-[11px] text-zinc-500">Header tagline and top alert banner displayed across all pages.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Header Sub-Tagline"
                      name="settings.storefront.tagline"
                      value={formData.settings?.storefront?.tagline || ''}
                      onChange={handleChange}
                      placeholder="e.g., Luxury Architectural & Furniture Fittings"
                      className="h-8 text-xs bg-white"
                    />
                    <Input
                      label="Announcement Bar Text"
                      name="settings.storefront.announcementBar"
                      value={formData.settings?.storefront?.announcementBar || ''}
                      onChange={handleChange}
                      placeholder="e.g., ✨ Special 10% Trade Discount for bulk architect orders this month!"
                      className="h-8 text-xs bg-white"
                    />
                    <div className="md:col-span-2 flex items-center gap-2 pt-1">
                      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData.settings?.storefront?.showAnnouncementBar}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              settings: {
                                ...prev.settings,
                                storefront: {
                                  ...(prev.settings?.storefront || {}),
                                  showAnnouncementBar: e.target.checked,
                                },
                              },
                            }))
                          }
                          className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                        />
                        Enable Announcement Bar on Storefront
                      </label>
                    </div>
                  </div>
                </div>

                {/* 2. Hero Carousel Banners */}
                <div className="space-y-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Homepage Hero Carousel Banners</h4>
                      <p className="text-[11px] text-zinc-500">Promotional slides on your homepage (up to 5 slides).</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddSlide}
                      className="text-xs h-7.5 rounded-xl bg-white font-semibold border-zinc-300"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Banner Slide
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {(formData.settings?.storefrontCarousel || []).map((slide: any, index: number) => (
                      <div key={index} className="p-4 rounded-xl border border-zinc-200 bg-white space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Slide #{index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSlide(index)}
                            className="text-red-600 hover:text-red-700 text-xs h-7 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Remove
                          </Button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <Input
                            label="Badge / Tag (e.g. Exclusive Collection)"
                            value={slide.badge || ''}
                            onChange={(e) => handleSlideFieldChange(index, 'badge', e.target.value)}
                            className="h-8 text-xs"
                          />
                          <Input
                            label="Headline Title *"
                            value={slide.title || ''}
                            onChange={(e) => handleSlideFieldChange(index, 'title', e.target.value)}
                            required
                            placeholder="e.g., Explore Premium Hardware"
                            className="h-8 text-xs font-semibold"
                          />
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Slide Subtitle / Description</label>
                            <Textarea
                              value={slide.desc || ''}
                              onChange={(e) => handleSlideFieldChange(index, 'desc', e.target.value)}
                              rows={2}
                              placeholder="Brief summary of this featured banner"
                              className="text-xs resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Call To Action Button Labels & URLs */}
                <div className="space-y-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Call to Action (CTA) Buttons &amp; Links</h4>
                    <p className="text-[11px] text-zinc-500">Customize labels and custom redirect URLs (e.g. `/my-org/products`, external link, WhatsApp link, or custom form).</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Input
                        label="Primary CTA (Explore) Label"
                        name="settings.storefront.exploreButtonText"
                        value={formData.settings?.storefront?.exploreButtonText || 'Explore Catalog'}
                        onChange={handleChange}
                        placeholder="Explore Catalog"
                        className="h-8 text-xs bg-white"
                      />
                      <Input
                        label="Primary CTA Redirect URL (Optional)"
                        name="settings.storefront.exploreButtonUrl"
                        value={formData.settings?.storefront?.exploreButtonUrl || ''}
                        onChange={handleChange}
                        placeholder="Default: /[slug]/products"
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Input
                        label="Secondary CTA (Quote / Contact) Label"
                        name="settings.storefront.requestQuoteButtonText"
                        value={formData.settings?.storefront?.requestQuoteButtonText || 'Request Quotation'}
                        onChange={handleChange}
                        placeholder="Request Quotation"
                        className="h-8 text-xs bg-white"
                      />
                      <Input
                        label="Secondary CTA Redirect URL (Optional)"
                        name="settings.storefront.requestQuoteButtonUrl"
                        value={formData.settings?.storefront?.requestQuoteButtonUrl || ''}
                        onChange={handleChange}
                        placeholder="Default: /[slug]/contact"
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. About Us Page Content */}
                <div className="space-y-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">About Us Page Content</h4>
                    <p className="text-[11px] text-zinc-500">Headings, story paragraphs, and corporate overview displayed on `/[slug]/about`.</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="About Badge Label"
                      name="settings.storefront.aboutBadge"
                      value={formData.settings?.storefront?.aboutBadge || ''}
                      onChange={handleChange}
                      placeholder="e.g., Hardware & Fittings Authority"
                      className="h-8 text-xs bg-white"
                    />
                    <Input
                      label="Main Section Headline"
                      name="settings.storefront.aboutTitle"
                      value={formData.settings?.storefront?.aboutTitle || ''}
                      onChange={handleChange}
                      placeholder="e.g., Precision engineering meets architectural luxury"
                      className="h-8 text-xs bg-white font-semibold"
                    />
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Hero Subtitle Summary</label>
                      <Textarea
                        name="settings.storefront.aboutDescription"
                        value={formData.settings?.storefront?.aboutDescription || ''}
                        onChange={handleChange}
                        rows={2}
                        placeholder="Brief summary below the main page title"
                        className="text-xs bg-white resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Story Paragraph 1</label>
                      <Textarea
                        name="settings.storefront.aboutParagraph1"
                        value={formData.settings?.storefront?.aboutParagraph1 || ''}
                        onChange={handleChange}
                        rows={3}
                        placeholder="First descriptive paragraph about company history and curation..."
                        className="text-xs bg-white resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Story Paragraph 2</label>
                      <Textarea
                        name="settings.storefront.aboutParagraph2"
                        value={formData.settings?.storefront?.aboutParagraph2 || ''}
                        onChange={handleChange}
                        rows={3}
                        placeholder="Second paragraph about real-time stock, invoicing, delivery..."
                        className="text-xs bg-white resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Contact Page & Footer Content */}
                <div className="space-y-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Contact Page &amp; Footer Branding</h4>
                    <p className="text-[11px] text-zinc-500">Contact headlines and custom footer description text.</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Contact Badge Label"
                      name="settings.storefront.contactBadge"
                      value={formData.settings?.storefront?.contactBadge || ''}
                      onChange={handleChange}
                      placeholder="e.g., Direct Inquiries"
                      className="h-8 text-xs bg-white"
                    />
                    <Input
                      label="Contact Page Main Heading"
                      name="settings.storefront.contactTitle"
                      value={formData.settings?.storefront?.contactTitle || ''}
                      onChange={handleChange}
                      placeholder="e.g., Contact Showroom & Support"
                      className="h-8 text-xs bg-white font-semibold"
                    />
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Contact Sub-Heading</label>
                      <Textarea
                        name="settings.storefront.contactDescription"
                        value={formData.settings?.storefront?.contactDescription || ''}
                        onChange={handleChange}
                        rows={2}
                        placeholder="e.g., Request architect quotations, product specification sheets, or bulk rate pricing."
                        className="text-xs bg-white resize-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Custom Footer Sub-Description</label>
                      <Textarea
                        name="settings.storefront.footerDescription"
                        value={formData.settings?.storefront?.footerDescription || ''}
                        onChange={handleChange}
                        rows={2}
                        placeholder="Short footer tagline shown under organization name."
                        className="text-xs bg-white resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Save Bar inside card */}
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-zinc-100">
              <span className="text-[11px] text-zinc-400">
                All changes saved to organization profile.
              </span>
              <Button
                type="submit"
                disabled={saving}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-6 rounded-xl shadow-sm flex items-center gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
        </div>
      </form>
    </div>
  );
}
