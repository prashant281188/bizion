import React from 'react';
import { cn } from '@/lib/utils';
import { FileIcon } from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = FileIcon,
  actionLabel,
  onAction,
  className
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center bg-white border border-zinc-200 border-dashed rounded-xl min-h-[300px]", className)}>
      <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-zinc-100">
        <Icon className="w-6 h-6 text-zinc-400" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-zinc-500 max-w-sm">{description}</p>
      )}
      {actionLabel && onAction && (
        <div className="mt-6">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </div>
  );
}
