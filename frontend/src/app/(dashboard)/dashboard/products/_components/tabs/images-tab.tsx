'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ImagePlus, Star, Trash2, CheckCircle2, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface FormImage {
  id?: string;
  url: string;
  altText: string;
  isPrimary: boolean;
  file?: File;
}

export interface ImagesTabProps {
  uploading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  images: FormImage[];
  handleSetPrimaryImage: (idx: number) => void;
  handleRemoveImage: (idx: number) => void;
  hasVariants: boolean;
  setActiveTab: (v: 'basic' | 'pricing' | 'specifications' | 'variants' | 'seo' | 'images') => void;
}

export function ImagesTab({
  uploading,
  handleFileUpload,
  images,
  handleSetPrimaryImage,
  handleRemoveImage,
  hasVariants,
  setActiveTab
}: ImagesTabProps) {
  return (
    <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6">
      <div className="pb-3 border-b border-zinc-100 flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
            <ImagePlus className="w-4 h-4 text-amber-600" />
            Product Media Gallery
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Upload high-resolution images for storefront, catalog PDFs, and price list downloads.
          </p>
        </div>
        <Badge className="bg-zinc-100 text-zinc-700 font-bold border-zinc-200 text-xs">
          {images.length} Image{images.length !== 1 ? 's' : ''} Uploaded
        </Badge>
      </div>

      <div className="space-y-6">
        {/* Upload Dropzone */}
        <div className="relative border-2 border-dashed border-amber-300/80 hover:border-amber-500 rounded-2xl p-8 flex flex-col items-center justify-center transition-all bg-amber-50/30 hover:bg-amber-50/60 group cursor-pointer text-center">
          {uploading ? (
            <div className="flex flex-col items-center space-y-2 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
              <span className="text-sm font-bold text-zinc-800">Uploading media to S3...</span>
              <span className="text-xs text-zinc-500">Optimizing image resolution and CDN delivery</span>
            </div>
          ) : (
            <>
              <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl mb-3 group-hover:scale-105 transition-transform">
                <UploadCloud className="w-8 h-8 text-amber-600" />
              </div>
              <span className="text-sm font-bold text-zinc-900 mb-1">
                Click or Drop Image File Here to Upload
              </span>
              <span className="text-xs text-zinc-500">
                Supports PNG, JPG, WEBP, SVG up to 10MB
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </>
          )}
        </div>

        {/* Gallery Grid */}
        {images.length > 0 ? (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Uploaded Images (Click star to set main product image)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className={`relative rounded-xl border p-2 flex flex-col items-center gap-2 group transition-all ${
                    img.isPrimary
                      ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-amber-300'
                  }`}
                >
                  <div className="h-28 w-full rounded-lg overflow-hidden border border-zinc-200/80 bg-zinc-50 relative">
                    <img src={img.url} alt={img.altText} className="h-full w-full object-cover" />
                    {img.isPrimary && (
                      <span className="absolute top-1.5 left-1.5 bg-amber-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-white" /> PRIMARY
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-zinc-600 text-center truncate max-w-full font-medium">
                    {img.altText || `Image #${idx + 1}`}
                  </span>

                  <div className="flex justify-between items-center w-full pt-1 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => handleSetPrimaryImage(idx)}
                      className={`text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                        img.isPrimary
                          ? 'text-amber-700 font-bold'
                          : 'text-zinc-500 hover:text-amber-600'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${img.isPrimary ? 'fill-amber-600 text-amber-600' : ''}`} />
                      {img.isPrimary ? 'Main Cover' : 'Set Cover'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="text-zinc-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                      title="Remove Image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-xs text-zinc-500 space-y-1">
            <p className="font-semibold text-zinc-700">No images uploaded yet</p>
            <p>Upload a product image to render on storefront cards, PDF catalogs, and order receipts.</p>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4 border-t border-zinc-200">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveTab('specifications')}
        >
          Back
        </Button>
        <Button type="button" onClick={() => setActiveTab('seo')}>
          Continue to SEO
        </Button>
      </div>
    </Card>
  );
}
