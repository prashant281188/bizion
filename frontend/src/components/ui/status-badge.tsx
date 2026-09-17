import React from 'react';
import { cn } from '@/lib/utils';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/lib/constants';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = INVOICE_STATUS_LABELS[status as keyof typeof INVOICE_STATUS_LABELS] || status;
  const colorClass = INVOICE_STATUS_COLORS[status as keyof typeof INVOICE_STATUS_COLORS] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
        colorClass,
        className
      )}
    >
      {label}
    </span>
  );
}
