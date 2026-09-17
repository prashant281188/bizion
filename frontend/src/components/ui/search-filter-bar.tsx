import React from 'react';
import { Card } from './card';
import { cn } from '@/lib/utils';

interface SearchFilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function SearchFilterBar({ children, className, ...props }: SearchFilterBarProps) {
  return (
    <Card className={cn("bg-white rounded-xl shadow-sm border border-zinc-200 p-4", className)} {...props}>
      <div className="grid grid-cols-1 gap-4 md:flex md:items-center">
        {children}
      </div>
    </Card>
  );
}
