'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing password reset token.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setStatus('error');
      setMessage('Password must be at least 6 characters.');
      return;
    }

    setStatus('loading');
    setMessage('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setStatus('success');
      setMessage('Your password has been reset successfully. Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.message || 'An error occurred while resetting password.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Reset Password</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your new password below
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
            <Button
              onClick={() => router.push('/login')}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs"
            >
              Sign In Now
            </Button>
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
            id="new-password"
            type="password"
            label="New Password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="h-10 text-xs"
          />

          <Input
            id="confirm-password"
            type="password"
            label="Confirm New Password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="h-10 text-xs"
          />

          <Button
            type="submit"
            disabled={status === 'loading' || !token}
            className="relative mt-2 flex w-full justify-center rounded-lg bg-zinc-900 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-zinc-800 hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {status === 'loading' ? (
              <span className="flex items-center space-x-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></span>
                <span>Resetting...</span>
              </span>
            ) : (
              'Reset Password'
            )}
          </Button>
        </form>
      )}

      <div className="text-center text-sm text-zinc-500">
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-500 transition-colors">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
