'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 font-sans min-h-screen flex items-center justify-center p-4 selection:bg-rose-500 selection:text-white">
        {/* Dynamic Mesh */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-500/10 rounded-full blur-[160px] pointer-events-none" />

        <div className="relative w-full max-w-md text-center space-y-6 z-10">
          <div className="relative flex items-center justify-center w-24 h-24 mx-auto rounded-3xl bg-gradient-to-b from-rose-500/20 to-rose-500/5 border border-rose-500/30 shadow-2xl backdrop-blur-2xl">
            <ShieldAlert className="w-12 h-12 text-rose-400 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Critical Core Error</h1>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
              A fatal system exception interrupted root layout execution in {APP_NAME}.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 text-left font-mono text-xs text-rose-400 break-all max-h-40 overflow-y-auto shadow-inner leading-relaxed">
            {error.message || 'Fatal layout component failure.'}
          </div>

          <Button
            onClick={() => reset()}
            className="w-full h-11 bg-white hover:bg-zinc-100 text-zinc-950 font-extrabold text-xs rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Full Application Reload
          </Button>
        </div>
      </body>
    </html>
  );
}
