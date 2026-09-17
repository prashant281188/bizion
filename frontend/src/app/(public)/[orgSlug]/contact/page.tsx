'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStorefront } from '../_components/storefront-provider';
import { Mail, Phone, MapPin, CheckCircle2, MessageSquare } from 'lucide-react';

export default function StorefrontContactPage() {
  const { org } = useStorefront();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!org) return null;

  const contactBadge = org.settings?.storefront?.contactBadge || 'Direct Inquiries';
  const contactTitle = org.settings?.storefront?.contactTitle || 'Contact Showroom & Support';
  const contactDescription = org.settings?.storefront?.contactDescription || 'Request architect quotations, product specification sheets, or bulk rate pricing.';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccess(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl w-full px-6 py-16">
      
      {/* Title Header */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800 mb-3 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
          <MessageSquare className="w-3.5 h-3.5" />
          {contactBadge}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-stone-900 tracking-tight mb-4">{contactTitle}</h1>
        <p className="text-stone-600 text-sm leading-relaxed">
          {contactDescription}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 max-w-5xl mx-auto">
        
        {/* Left Column: Quick Info Cards */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {org.email && (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 flex gap-4 shadow-xs hover:border-amber-400 transition-all">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200/50">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-1">Email Inquiry</h3>
                <a href={`mailto:${org.email}`} className="text-sm font-bold text-stone-800 hover:text-amber-700 transition-colors">
                  {org.email}
                </a>
              </div>
            </div>
          )}

          {org.phone && (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 flex gap-4 shadow-xs hover:border-amber-400 transition-all">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200/50">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-1">Showroom Phone</h3>
                <span className="text-sm font-bold text-stone-800">{org.phone}</span>
              </div>
            </div>
          )}

          {(org.addressLine1 || org.city) && (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 flex gap-4 shadow-xs hover:border-amber-400 transition-all">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200/50">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-1">Showroom Address</h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {org.addressLine1}
                  {org.addressLine2 ? `, ${org.addressLine2}` : ''}
                  {org.city ? `, ${org.city}` : ''}
                  {org.stateName ? `, ${org.stateName}` : ''}
                  {org.pincode ? ` - ${org.pincode}` : ''}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Contact Form */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-stone-200/80 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-stone-900 mb-6">Send an Instant Message</h2>

            {success ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-amber-600" />
                <h3 className="text-lg font-bold text-stone-900">Inquiry Sent Successfully</h3>
                <p className="text-xs text-stone-500">Our representative will get back to you shortly.</p>
                <Button variant="outline" onClick={() => setSuccess(false)} className="mt-4 border-stone-200 text-stone-700">
                  Send Another Inquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Your Name</label>
                  <Input
                    required
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Architect Rajesh Sharma"
                    className="bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Email Address</label>
                  <Input
                    required
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@example.com"
                    className="bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Requirement / Project</label>
                  <textarea
                    required
                    rows={4}
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Specify fittings, hinges, handle quantities or project scope..."
                    className="w-full bg-stone-50 border border-stone-200 text-stone-900 placeholder-stone-400 rounded-xl p-3 text-xs focus:outline-none focus:border-amber-600"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-3 rounded-xl transition-all shadow-md shadow-amber-600/20"
                >
                  {submitting ? 'Sending...' : 'Submit Hardware Inquiry'}
                </Button>
              </form>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
