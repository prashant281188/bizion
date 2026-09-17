'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) return;

    setStatus('loading');
    setMessage('');
    try {
      await api.post('/auth/forgot-password', { identifier });
      setStatus('success');
      setMessage('If an account exists with that email or mobile number, a password reset link has been dispatched.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.message || 'An error occurred. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Forgot Password</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your registered email address or mobile number to receive a reset link
        </p>
      </div>

      {status === 'success' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-lg">
              ✓
            </div>
          </div>
          <p className="text-xs font-medium text-emerald-800">{message}</p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-block text-xs font-bold text-emerald-900 hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {status === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {message}
            </div>
          )}

          <Input
            id="identifier"
            type="text"
            label="Email or Mobile Number"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="name@company.com or 9876543210"
            required
            className="h-10 text-xs"
          />

          <Button
            type="submit"
            disabled={status === 'loading'}
            className="relative mt-2 flex w-full justify-center rounded-lg bg-zinc-900 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-zinc-800 hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {status === 'loading' ? (
              <span className="flex items-center space-x-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></span>
                <span>Sending link...</span>
              </span>
            ) : (
              'Send Reset Link'
            )}
          </Button>
        </form>
      )}

      <div className="text-center text-sm text-zinc-500">
        Remembered your password?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-500 transition-colors">
          Sign In
        </Link>
      </div>
    </div>
  );
}
