'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerSchema, type RegisterFormData } from '@/schemas/auth.schema';
import { ZodError } from 'zod';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    organizationName: '',
    organizationLegalName: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when editing
    if (errors[name as keyof RegisterFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    setServerError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});
    setServerError(null);

    try {
      // Validate schema on client side
      registerSchema.parse(formData);

      // Perform auth registration
      await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        organizationName: formData.organizationName,
        organizationLegalName: formData.organizationLegalName || undefined,
      });

      // Redirect on success
      router.push('/dashboard');
    } catch (err: any) {
      if (err instanceof ZodError) {
        const fieldErrors: Partial<Record<keyof RegisterFormData, string>> = {};
        err.issues.forEach((issue) => {
          const path = issue.path[0] as keyof RegisterFormData;
          if (path) {
            fieldErrors[path] = issue.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        // Handle server errors
        console.error('Registration error:', err);
        setServerError(
          err.response?.data?.message || 'Failed to create organization. Email or slug might already exist.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Get Started</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Create a new tenant organization and owner profile
        </p>
      </div>

      {serverError && (
        <div className="rounded-xl border border-red-200 bg-red-50/90 p-3.5 text-xs text-red-700 shadow-sm">
          {serverError}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* ----- Section 1: Business Details ----- */}
        <div className="border-b border-zinc-200 pb-2">
          <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider">1. Organization Details</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="organizationName"
            name="organizationName"
            type="text"
            required
            label="Org Name *"
            value={formData.organizationName}
            onChange={handleChange}
            placeholder="e.g. Acme India"
            error={errors.organizationName}
          />

          <Input
            id="organizationLegalName"
            name="organizationLegalName"
            type="text"
            label="Legal Name"
            value={formData.organizationLegalName}
            onChange={handleChange}
            placeholder="e.g. Acme India Pvt Ltd"
            error={errors.organizationLegalName}
          />
        </div>

        {/* ----- Section 2: Administrator Profile ----- */}
        <div className="border-b border-zinc-200 pb-2 pt-2">
          <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider">2. Owner Profile</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="firstName"
            name="firstName"
            type="text"
            required
            label="First Name *"
            value={formData.firstName}
            onChange={handleChange}
            placeholder="John"
            error={errors.firstName}
          />

          <Input
            id="lastName"
            name="lastName"
            type="text"
            required
            label="Last Name *"
            value={formData.lastName}
            onChange={handleChange}
            placeholder="Doe"
            error={errors.lastName}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="email"
            name="email"
            type="email"
            required
            label="Email Address *"
            value={formData.email}
            onChange={handleChange}
            placeholder="name@company.com"
            error={errors.email}
          />

          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            label="Mobile Number (India) *"
            value={formData.phone}
            onChange={handleChange}
            placeholder="9876543210"
            error={errors.phone}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="password"
            name="password"
            type="password"
            required
            label="Password *"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            error={errors.password}
          />

          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            label="Confirm Password *"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="••••••••"
            error={errors.confirmPassword}
          />
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          disabled={isLoading}
          className="relative mt-4 flex w-full justify-center rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-zinc-800 hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center space-x-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></span>
              <span>Creating Organization...</span>
            </span>
          ) : (
            'Create Organization'
          )}
        </Button>
      </form>

      <div className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-amber-600 hover:text-amber-700 transition-colors">
          Sign in
        </Link>
      </div>
    </div>
  );
}
