'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginSchema, type LoginFormData } from '@/schemas/auth.schema';
import { ZodError } from 'zod';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState<LoginFormData>({
    identifier: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when editing
    if (errors[name as keyof LoginFormData]) {
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
      // Validate client side
      loginSchema.parse(formData);

      // Perform auth login
      const userData = await login(formData);
      
      // Redirect on success
      if (userData?.role === 'customer') {
        router.push('/portal');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      if (err instanceof ZodError) {
        const fieldErrors: Partial<Record<keyof LoginFormData, string>> = {};
        err.issues.forEach((issue) => {
          const path = issue.path[0] as keyof LoginFormData;
          if (path) {
            fieldErrors[path] = issue.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        // Handle expected auth server errors gracefully
        const errMsg = err.response?.data?.message || 'Invalid email or password. Please check your credentials and try again.';
        setServerError(errMsg);
        // Highlight fields with error status
        setErrors({
          identifier: ' ',
          password: ' ',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Welcome Back</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Sign in to access your business console
        </p>
      </div>

      {serverError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50/90 p-3.5 text-xs text-red-700 shadow-sm animate-pulse">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <p className="font-bold text-red-900">Authentication Failed</p>
            <p className="mt-0.5 text-[11px] text-red-700 font-medium">{serverError}</p>
          </div>
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Identifier Input */}
        <Input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="email"
          required
          label="Email or Mobile Number"
          value={formData.identifier}
          onChange={handleChange}
          placeholder="name@company.com or 9876543210"
          error={errors.identifier}
        />

        {/* Password Input */}
        <div className="relative">
          <div className="absolute right-0 top-0 z-10">
            <Link
              href="/forgot-password"
              className="text-xs text-brand-600 hover:text-brand-500 transition-colors font-medium"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            label="Password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            error={errors.password}
          />
        </div>

        {/* Submit button with micro-animation loading spinner */}
        <Button
          type="submit"
          disabled={isLoading}
          className="relative mt-2 flex w-full justify-center rounded-lg bg-zinc-900 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-zinc-800 hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center space-x-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></span>
              <span>Signing in...</span>
            </span>
          ) : (
            'Sign In'
          )}
        </Button>
      </form>

      <div className="text-center text-sm text-zinc-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-500 transition-colors">
          Create organization
        </Link>
      </div>
    </div>
  );
}
