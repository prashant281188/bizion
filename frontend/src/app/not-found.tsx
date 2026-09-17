'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  FileQuestion, 
  ArrowLeft, 
  LayoutDashboard, 
  ShoppingBag, 
  Receipt, 
  Package, 
  Search, 
  Compass, 
  ArrowRight,
  ShieldAlert,
  Users,
  BarChart3
} from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

export default function NotFound() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase().trim();
    if (q.includes('order') || q.includes('sale')) router.push('/dashboard/orders/sales');
    else if (q.includes('invoice') || q.includes('bill')) router.push('/dashboard/invoices');
    else if (q.includes('product') || q.includes('stock') || q.includes('item')) router.push('/dashboard/products');
    else if (q.includes('customer') || q.includes('contact') || q.includes('vendor')) router.push('/dashboard/contacts');
    else if (q.includes('report') || q.includes('analytics')) router.push('/dashboard/reports');
    else router.push(`/dashboard?search=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-100 overflow-hidden font-sans selection:bg-amber-500 selection:text-zinc-950">
      {/* Dynamic Background Mesh Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-amber-500/15 via-indigo-600/10 to-rose-500/10 rounded-full blur-[150px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a15_1px,transparent_1px),linear-gradient(to_bottom,#27272a15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="relative w-full max-w-xl text-center space-y-8 z-10">
        {/* Visual Hero Badge */}
        <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center w-28 h-28 rounded-3xl bg-gradient-to-b from-amber-500/20 to-amber-500/5 border border-amber-500/30 shadow-2xl shadow-amber-500/10 backdrop-blur-2xl mb-6 group">
            {/* Animated Pulse Ring */}
            <div className="absolute inset-0 rounded-3xl bg-amber-500/20 animate-ping opacity-25 pointer-events-none" />
            <FileQuestion className="w-14 h-14 text-amber-400 group-hover:scale-110 transition-transform duration-300" />
            <span className="absolute -top-3 -right-3 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-black text-xs uppercase tracking-widest px-3 py-1 rounded-full shadow-lg border border-amber-300/40">
              404
            </span>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Lost in Space?
          </h1>
          <p className="mt-3 text-sm text-zinc-400 max-w-md leading-relaxed">
            The destination you requested couldn&apos;t be found on <span className="text-amber-400 font-semibold">{APP_NAME}</span>. It might have been moved or removed.
          </p>
        </div>

        {/* Interactive Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative max-w-md mx-auto">
          <div className="relative flex items-center rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
            <Search className="w-4 h-4 text-zinc-400 ml-4 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders, invoices, products, or customers..."
              className="w-full bg-transparent px-3 py-3.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            <Button
              type="submit"
              size="sm"
              className="mr-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl px-4 h-8 shrink-0 transition-all"
            >
              Search
            </Button>
          </div>
        </form>

        {/* Quick Navigation Cards Grid */}
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-6 backdrop-blur-2xl text-left space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              Popular Destinations
            </p>
            <span className="text-[10px] text-zinc-500 font-mono">Quick Access</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <Link
              href="/dashboard/orders/sales"
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-950/70 hover:bg-zinc-800/70 border border-zinc-800/60 text-zinc-300 transition-all hover:text-amber-400 hover:border-amber-500/30 group"
            >
              <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-zinc-950 transition-colors">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium truncate">Sales Orders</span>
            </Link>

            <Link
              href="/dashboard/invoices"
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-950/70 hover:bg-zinc-800/70 border border-zinc-800/60 text-zinc-300 transition-all hover:text-amber-400 hover:border-amber-500/30 group"
            >
              <div className="w-7 h-7 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                <Receipt className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium truncate">Invoices</span>
            </Link>

            <Link
              href="/dashboard/products"
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-950/70 hover:bg-zinc-800/70 border border-zinc-800/60 text-zinc-300 transition-all hover:text-amber-400 hover:border-amber-500/30 group"
            >
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-colors">
                <Package className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium truncate">Products</span>
            </Link>

            <Link
              href="/dashboard/contacts"
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-950/70 hover:bg-zinc-800/70 border border-zinc-800/60 text-zinc-300 transition-all hover:text-amber-400 hover:border-amber-500/30 group"
            >
              <div className="w-7 h-7 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:bg-sky-500 group-hover:text-zinc-950 transition-colors">
                <Users className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium truncate">Contacts</span>
            </Link>

            <Link
              href="/dashboard/reports"
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-950/70 hover:bg-zinc-800/70 border border-zinc-800/60 text-zinc-300 transition-all hover:text-amber-400 hover:border-amber-500/30 group"
            >
              <div className="w-7 h-7 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                <BarChart3 className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium truncate">Reports</span>
            </Link>

            <Link
              href="/portal"
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-950/70 hover:bg-zinc-800/70 border border-zinc-800/60 text-zinc-300 transition-all hover:text-amber-400 hover:border-amber-500/30 group"
            >
              <div className="w-7 h-7 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                <LayoutDashboard className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium truncate">Portal</span>
            </Link>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="w-full sm:w-auto h-11 border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold px-6 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>

          <Button
            asChild
            className="w-full sm:w-auto h-11 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs px-6 rounded-xl shadow-lg shadow-amber-500/20 transition-all"
          >
            <Link href="/dashboard">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Go to Console Dashboard
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-zinc-600">
          &copy; {new Date().getFullYear()} {APP_NAME}. Modern Business Console.
        </p>
      </div>
    </div>
  );
}
