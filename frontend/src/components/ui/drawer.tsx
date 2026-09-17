import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "./sheet"

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  footer,
  children,
  size = 'md',
}: DrawerProps) {
  const sizeClasses = {
    sm: 'data-[side=right]:sm:max-w-md',
    md: 'data-[side=right]:sm:max-w-lg',
    lg: 'data-[side=right]:sm:max-w-2xl',
    xl: 'data-[side=right]:sm:max-w-4xl',
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className={`${sizeClasses[size]} overflow-y-auto w-[90vw] bg-white border-l border-zinc-200 p-0`}>
        <SheetHeader className="border-b border-zinc-200 pb-4 mb-0 px-6 pt-6">
          <SheetTitle className="text-xl font-bold text-zinc-900 text-left">{title}</SheetTitle>
          {subtitle && <SheetDescription className="text-xs text-zinc-500 text-left">{subtitle}</SheetDescription>}
        </SheetHeader>
        
        <div className="py-2 px-6">
          {children}
        </div>

        {footer && (
          <SheetFooter className="pt-4 border-t border-zinc-200 mt-6 flex justify-end gap-3 sm:justify-end px-6 pb-6">
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
