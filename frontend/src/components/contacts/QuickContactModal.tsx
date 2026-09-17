'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { INDIAN_STATES } from '@/lib/constants';
import api from '@/lib/api';

// ============================================================
// QuickContactModal — Create a contact on-the-fly from any form
// ============================================================

interface QuickContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (contact: any) => void;
  defaultType?: 'customer' | 'vendor' | 'both';
  initialName?: string;
}

const TYPE_OPTIONS = [
  { value: 'customer', label: 'Customer' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'both', label: 'Customer & Vendor' },
];

const GST_REG_TYPE_OPTIONS = [
  { value: 'unregistered', label: 'Unregistered' },
  { value: 'regular', label: 'Regular' },
  { value: 'composition', label: 'Composition' },
  { value: 'overseas', label: 'Overseas' },
];

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({
  value: s.code,
  label: s.name,
}));

export function QuickContactModal({
  isOpen,
  onClose,
  onCreated,
  defaultType = 'customer',
  initialName = '',
}: QuickContactModalProps) {
  // ---- Form state ----
  const [displayName, setDisplayName] = useState(initialName);
  const [contactType, setContactType] = useState<string>(defaultType);
  const [companyName, setCompanyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [gstRegType, setGstRegType] = useState('unregistered');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Address fields
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [pincode, setPincode] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGstRegistered, setIsGstRegistered] = useState(false);

  // Reset form whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setDisplayName(initialName || '');
      setContactType(defaultType);
      setCompanyName('');
      setGstin('');
      setGstRegType('unregistered');
      setEmail('');
      setPhone('');
      setAddressLine1('');
      setCity('');
      setStateCode('');
      setPincode('');
      setError('');
      setLoading(false);
      setIsGstRegistered(false);
    }
  }, [isOpen, defaultType]);

  // Close on Escape key or submit on Ctrl+Enter
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const form = document.getElementById('quick-contact-form') as HTMLFormElement;
        if (form) form.requestSubmit();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-detect state code from GSTIN
  const handleGstinChange = (val: string) => {
    const cleanGstin = val.toUpperCase();
    setGstin(cleanGstin);
    if (cleanGstin.length >= 2) {
      const code = cleanGstin.substring(0, 2);
      const matchedState = INDIAN_STATES.find(s => s.code === code);
      if (matchedState && !stateCode) {
        setStateCode(matchedState.code);
      }
    }
  };

  // ---- Validation ----
  const validate = useCallback((): string | null => {
    if (!displayName.trim()) return 'Display Name is required.';

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Please enter a valid email address.';
    }

    if (phone && !/^\+?[\d\s-]{7,15}$/.test(phone)) {
      return 'Please enter a valid phone number.';
    }

    // Address validation: if any address field is filled, validate together
    const addressFields = [addressLine1, city, stateCode, pincode];
    const hasAnyAddress = addressFields.some((f) => f.trim());
    if (hasAnyAddress) {
      if (!addressLine1.trim()) return 'Address Line 1 is required when adding an address.';
      if (!city.trim()) return 'City is required when adding an address.';
      if (!stateCode) return 'State is required when adding an address.';
      if (pincode.trim() && !/^\d{6}$/.test(pincode.trim())) return 'Pincode must be exactly 6 digits.';
    }

    return null;
  }, [displayName, email, phone, addressLine1, city, stateCode, pincode]);

  // ---- Submit ----
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      const validationError = validate();
      if (validationError) {
        setError(validationError);
        return;
      }

      setLoading(true);

      try {
        const hasAddress = [addressLine1, city, stateCode, pincode].some((f) => f.trim());
        const stateName = INDIAN_STATES.find((s) => s.code === stateCode)?.name ?? '';

        const payload = {
          type: contactType,
          displayName: displayName.trim(),
          companyName: companyName.trim() || null,
          gstin: isGstRegistered ? (gstin.trim() || null) : null,
          gstRegistrationType: isGstRegistered ? (gstRegType || 'regular') : 'unregistered',
          email: email.trim() || null,
          phone: phone.trim() || null,
          addresses: hasAddress
            ? [
                {
                  label: 'Billing',
                  addressLine1: addressLine1.trim(),
                  addressLine2: null,
                  city: city.trim(),
                  stateCode,
                  stateName,
                  pincode: pincode.trim(),
                  country: 'India',
                  isBillingDefault: true,
                  isShippingDefault: true,
                },
              ]
            : [],
        };

        const res = await api.post('/contacts', payload);
        onCreated(res.data.data);
        onClose();
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to create contact. Please try again.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [
      validate,
      contactType,
      displayName,
      companyName,
      gstin,
      gstRegType,
      email,
      phone,
      addressLine1,
      city,
      stateCode,
      pincode,
      isGstRegistered,
      onCreated,
      onClose,
    ]
  );

  // ---- Render ----
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Quick Create Contact</h2>
            <p className="text-xs text-zinc-500">Create a new customer or vendor on the fly.</p>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono bg-zinc-100 px-2 py-0.5 rounded">Ctrl + Enter to Save</span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <form id="quick-contact-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Segmented Type Selector */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">Contact Type *</label>
            <div className="grid grid-cols-3 gap-2 bg-zinc-100 p-1 rounded-xl">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setContactType(opt.value)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    contactType === opt.value
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Display Name + Company Name */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Display Name *"
              placeholder="John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoFocus
              className="h-[38px] text-xs"
            />
            <Input
              label="Company Name"
              placeholder="Acme Corp"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="h-[38px] text-xs"
            />
          </div>

          {/* GST Toggle & GSTIN */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Is GST Registered?"
              options={[
                { value: 'no', label: 'Unregistered' },
                { value: 'yes', label: 'Registered GST' },
              ]}
              value={isGstRegistered ? 'yes' : 'no'}
              onChange={(e) => {
                const isReg = e.target.value === 'yes';
                setIsGstRegistered(isReg);
                if (isReg && gstRegType === 'unregistered') {
                  setGstRegType('regular');
                }
              }}
              className="h-[38px] text-xs"
            />
            {isGstRegistered ? (
              <Input
                label="GSTIN *"
                placeholder="27AAAAA0000A1Z5"
                value={gstin}
                onChange={(e) => handleGstinChange(e.target.value)}
                maxLength={15}
                className="h-[38px] text-xs uppercase font-mono"
              />
            ) : (
              <Input
                label="Phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-[38px] text-xs"
              />
            )}
          </div>

          {/* Email + Phone (if GST active) */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[38px] text-xs"
            />
            {isGstRegistered && (
              <Input
                label="Phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-[38px] text-xs"
              />
            )}
          </div>

          {/* Address Section */}
          <div className="pt-2 border-t border-zinc-100">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">
              Primary Address <span className="text-zinc-400 font-normal normal-case">(optional)</span>
            </p>

            <div className="space-y-3">
              <Input
                label="Address Line 1"
                placeholder="123 Main Street, Suite 4"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="h-[38px] text-xs"
              />

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="City"
                  placeholder="Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-[38px] text-xs"
                />
                <Select
                  label="State"
                  options={STATE_OPTIONS}
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  className="h-[38px] text-xs"
                />
                <Input
                  label="Pincode"
                  placeholder="400001"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  maxLength={6}
                  className="h-[38px] text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="text-xs font-semibold border-zinc-200 hover:bg-zinc-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-sm transition-all"
            >
              {loading ? 'Creating Contact...' : 'Create Contact'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
