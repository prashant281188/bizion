import React from 'react';
import { cn } from '@/lib/utils';

export function PageContainer({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-6 max-w-[1600px] mx-auto", className)} {...props}>
      {children}
    </div>
  );
}
