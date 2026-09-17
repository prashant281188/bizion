'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  User, Building2, MapPin, Phone, Mail, FileText, CreditCard, Shield, KeyRound
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function PortalProfilePage() {
  const { user } = useAuth();
  
  // Password change state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Fetch full customer profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['portal', 'profile'],
    queryFn: async () => {
      const res = await api.get('/portal/profile');
      return res.data?.data;
    },
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setStatus('error');
      setMessage('Password must be at least 6 characters');
      return;
    }

    setStatus('loading');
    try {
      await api.put('/users/me/password', { password });
      setStatus('success');
      setMessage('Password updated successfully');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.message || 'Failed to update password');
    }
  };

  const billingAddress = profile?.addresses?.find((a: any) => a.type === 'billing');
  const shippingAddresses = profile?.addresses?.filter((a: any) => a.type === 'shipping') || [];

  return (
    <div className="space-y-8 pb-10 max-w-5xl mx-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-indigo-50/80 border border-indigo-100/50 px-8 py-10 shadow-sm">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center border-4 border-indigo-100 shadow-sm shrink-0 text-indigo-700">
              <User className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1 text-zinc-900">
                {profile?.companyName || profile?.displayName || 'My Profile'}
              </h1>
              <p className="text-indigo-600 font-medium flex items-center gap-1.5">
                <Shield className="h-4 w-4" /> Account Information
              </p>
            </div>
          </div>
          {profile?.isActive ? (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Active Account</Badge>
          ) : (
            <Badge variant="destructive">Inactive</Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Business & Contact Info */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-zinc-200/60 shadow-sm">
              <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-6 py-4">
                <CardTitle className="text-base font-semibold text-zinc-800 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-500" />
                  Business Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Company Name</span>
                    <p className="font-medium text-zinc-900">{profile?.companyName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Display Name</span>
                    <p className="font-medium text-zinc-900">{profile?.displayName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">GSTIN</span>
                    <p className="font-medium text-zinc-900">{profile?.gstin || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">PAN</span>
                    <p className="font-medium text-zinc-900">{profile?.pan || '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-200/60 shadow-sm">
              <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-6 py-4">
                <CardTitle className="text-base font-semibold text-zinc-800 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-indigo-500" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Primary Contact Person</span>
                    <p className="font-medium text-zinc-900">{profile?.contactPerson || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Email Address</span>
                    <p className="font-medium text-zinc-900 flex items-center gap-2">
                      {profile?.email || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Phone Number</span>
                    <p className="font-medium text-zinc-900">{profile?.phone || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Mobile Number</span>
                    <p className="font-medium text-zinc-900">{profile?.mobile || '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card className="border-zinc-200/60 shadow-sm">
                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-6 py-4">
                  <CardTitle className="text-base font-semibold text-zinc-800 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-rose-500" />
                    Billing Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {billingAddress ? (
                    <div className="text-sm text-zinc-700 leading-relaxed space-y-1">
                      <p className="font-semibold text-zinc-900">{billingAddress.attention || profile?.companyName}</p>
                      <p>{billingAddress.street1}</p>
                      {billingAddress.street2 && <p>{billingAddress.street2}</p>}
                      <p>{billingAddress.city}, {billingAddress.state}</p>
                      <p>{billingAddress.zipCode}, {billingAddress.country}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500 italic">No billing address recorded.</p>
                  )}
                </CardContent>
              </Card>

              {shippingAddresses.length > 0 ? (
                <Card className="border-zinc-200/60 shadow-sm">
                  <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-6 py-4">
                    <CardTitle className="text-base font-semibold text-zinc-800 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-500" />
                      Primary Shipping Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="text-sm text-zinc-700 leading-relaxed space-y-1">
                      <p className="font-semibold text-zinc-900">{shippingAddresses[0].attention || profile?.companyName}</p>
                      <p>{shippingAddresses[0].street1}</p>
                      {shippingAddresses[0].street2 && <p>{shippingAddresses[0].street2}</p>}
                      <p>{shippingAddresses[0].city}, {shippingAddresses[0].state}</p>
                      <p>{shippingAddresses[0].zipCode}, {shippingAddresses[0].country}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-zinc-200/60 shadow-sm">
                  <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-6 py-4">
                    <CardTitle className="text-base font-semibold text-zinc-800 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-500" />
                      Shipping Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="text-sm text-zinc-500 italic">No shipping address recorded.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Right Column: Financials & Security */}
          <div className="space-y-8">
            <Card className="border-zinc-200/60 shadow-sm bg-gradient-to-br from-white to-zinc-50/50">
              <CardHeader className="bg-white border-b border-zinc-100 px-6 py-4">
                <CardTitle className="text-base font-semibold text-zinc-800 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-indigo-500" />
                  Financial Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div>
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Credit Limit</span>
                  <p className="font-bold text-zinc-900 text-2xl">{formatCurrency(Number(profile?.creditLimit || 0))}</p>
                </div>
                {profile?.paymentTerm && (
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Payment Terms</span>
                    <Badge variant="outline" className="bg-white mt-1">{profile.paymentTerm.name}</Badge>
                  </div>
                )}
                <div className="pt-4 border-t border-zinc-100">
                  <p className="text-xs text-zinc-500 italic">
                    If you need to update any of your business or financial details, please contact your account manager.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-200/60 shadow-sm border-t-4 border-t-zinc-800">
              <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-6 py-4">
                <CardTitle className="text-base font-semibold text-zinc-800 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-zinc-700" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="mb-6">
                  <p className="text-sm text-zinc-600 mb-1">Signed in as</p>
                  <p className="font-semibold text-zinc-900">{user?.email}</p>
                </div>

                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">New Password</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Min. 6 characters"
                      className="bg-zinc-50 focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Confirm Password</label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Repeat new password"
                      className="bg-zinc-50 focus:bg-white"
                    />
                  </div>

                  {status === 'success' && (
                    <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200">
                      <p className="text-xs font-medium text-emerald-800">{message}</p>
                    </div>
                  )}
                  {status === 'error' && (
                    <div className="rounded-lg bg-rose-50 p-3 border border-rose-200">
                      <p className="text-xs font-medium text-rose-800">{message}</p>
                    </div>
                  )}

                  <Button type="submit" disabled={status === 'loading'} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white">
                    {status === 'loading' ? 'Updating...' : 'Change Password'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
