'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  RefreshCw, 
  LayoutDashboard, 
  Bug, 
  ChevronDown, 
  ChevronUp, 
  Home, 
  LifeBuoy, 
  Copy, 
  Check 
} from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error('Unhandled runtime error captured by App Error Boundary:', error);
  }, [error]);

  const handleCopyDetails = () => {
    const text = `Error: ${error.message}\nDigest: ${error.digest || 'N/A'}\nStack: ${error.stack || 'N/A'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-100 overflow-hidden font-sans selection:bg-red-500 selection:text-white">
      {/* Dynamic Background Mesh Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-rose-600/15 via-amber-500/10 to-indigo-600/10 rounded-full blur-[150px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-rose-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a15_1px,transparent_1px),linear-gradient(to_bottom,#27272a15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="relative w-full max-w-xl text-center space-y-8 z-10">
        {/* Visual Hero Badge */}
        <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center w-28 h-28 rounded-3xl bg-gradient-to-b from-rose-500/20 to-rose-500/5 border border-rose-500/30 shadow-2xl shadow-rose-500/10 backdrop-blur-2xl mb-6 group">
            {/* Animated Pulse Ring */}
            <div className="absolute inset-0 rounded-3xl bg-rose-500/20 animate-ping opacity-25 pointer-events-none" />
            <AlertTriangle className="w-14 h-14 text-rose-400 group-hover:scale-110 transition-transform duration-300" />
            <span className="absolute -top-3 -right-3 bg-gradient-to-r from-rose-500 to-red-600 text-white font-black text-xs uppercase tracking-widest px-3 py-1 rounded-full shadow-lg border border-rose-300/40">
              Error
            </span>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            System Execution Alert
          </h1>
          <p className="mt-3 text-sm text-zinc-400 max-w-md leading-relaxed">
            An unexpected error occurred while processing this request in <span className="text-amber-400 font-semibold">{APP_NAME}</span>.
          </p>
        </div>

        {/* Diagnostic Error Card */}
        <div className="rounded-3xl border border-rose-500/20 bg-zinc-900/60 p-6 backdrop-blur-2xl text-left space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <Bug className="w-3.5 h-3.5" />
              Runtime Error Message
            </span>
            {error.digest && (
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-800">
                Ref: {error.digest}
              </span>
            )}
          </div>

          <p className="text-xs font-mono text-zinc-200 bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800/80 break-all leading-relaxed">
            {error.message || 'Unknown application runtime failure.'}
          </p>

          {/* Expandable Stack Trace Drawer */}
          <div className="pt-1">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-medium transition-colors focus:outline-none"
            >
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{showDetails ? 'Hide Stack Trace' : 'View Full Technical Stack Trace'}</span>
            </button>

            {showDetails && (
              <div className="mt-3 relative">
                <button
                  onClick={handleCopyDetails}
                  className="absolute top-2 right-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <pre className="text-[10px] font-mono text-zinc-400 bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800 overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                  {error.stack || 'No stack trace available.'}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Primary Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => reset()}
            className="w-full sm:w-auto h-11 bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto h-11 border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold px-6 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Link href="/dashboard">
              <LayoutDashboard className="w-4 h-4" />
              Return to Console Dashboard
            </Link>
          </Button>
        </div>

        {/* Help Footer */}
        <div className="flex items-center justify-center gap-4 text-xs text-zinc-500 pt-2">
          <Link href="/dashboard" className="hover:text-zinc-300 transition-colors flex items-center gap-1">
            <Home className="w-3.5 h-3.5" />
            Home
          </Link>
          <span>•</span>
          <span className="text-zinc-600 flex items-center gap-1">
            <LifeBuoy className="w-3.5 h-3.5" />
            Support: admin@bizion.com
          </span>
        </div>
      </div>
    </div>
  );
}
