'use client';

import React, { useEffect } from 'react';
import ProductFormPage from '@/app/(dashboard)/dashboard/products/form-page';

interface QuickProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (product: any) => void;
  initialName?: string;
}

export function QuickProductModal({
  isOpen,
  onClose,
  onCreated,
  initialName = '',
}: QuickProductModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 p-6 relative">
        <ProductFormPage
          isModal={true}
          onSuccess={onCreated}
          onCancel={onClose}
          initialName={initialName}
        />
      </div>
    </div>
  );
}
