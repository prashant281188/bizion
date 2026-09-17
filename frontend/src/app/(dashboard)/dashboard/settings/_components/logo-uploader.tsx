'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { UploadCloud, Image as ImageIcon, Trash2, Loader2, Check } from 'lucide-react';

interface LogoUploaderProps {
  value: string;
  onChange: (url: string) => void;
  businessName?: string;
}

export function LogoUploader({ value, onChange, businessName }: LogoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo image size must be under 5MB');
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploadedUrl = res.data.data?.url || res.data?.url;
      if (uploadedUrl) {
        onChange(uploadedUrl);
        toast.success('Company logo uploaded successfully');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/50">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Logo Preview Box */}
      <div className="relative h-24 w-24 rounded-2xl border-2 border-dashed border-zinc-300 bg-white flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xs group">
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={value} 
              alt={businessName || 'Organization Logo'} 
              className="h-full w-full object-contain p-2" 
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 bg-white/90 rounded-lg text-zinc-700 hover:text-black shadow-xs"
                title="Change Logo"
              >
                <UploadCloud className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="p-1.5 bg-white/90 rounded-lg text-red-600 hover:text-red-700 shadow-xs"
                title="Remove Logo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-400 p-2 text-center">
            <ImageIcon className="w-6 h-6 mb-1 text-zinc-300" />
            <span className="text-[10px] font-semibold">No Logo</span>
          </div>
        )}
      </div>

      {/* Upload Details & Actions */}
      <div className="space-y-1.5 flex-1">
        <div className="text-xs font-bold text-zinc-900">Organization Logo</div>
        <p className="text-[11px] text-zinc-500 max-w-sm">
          Used on printed Tax Invoices, Delivery Manifests, and the Public Storefront.
          PNG or SVG with transparent background recommended.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="h-8 text-xs font-semibold rounded-xl bg-white border-zinc-200 hover:border-amber-400 text-zinc-800"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 text-amber-600" />
                Uploading...
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                {value ? 'Replace Logo' : 'Upload Image'}
              </>
            )}
          </Button>

          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange('')}
              className="h-8 text-xs font-semibold text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
            >
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
