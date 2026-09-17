'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles, Globe, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export interface SeoTabProps {
  metaTitle: string;
  setMetaTitle: (v: string) => void;
  metaDescription: string;
  setMetaDescription: (v: string) => void;
  tagsInput: string;
  setTagsInput: (v: string) => void;
  shortDescription?: string;
  setShortDescription?: (v: string) => void;
  description?: string;
  setDescription?: (v: string) => void;
  setActiveTab: (v: 'basic' | 'pricing' | 'specifications' | 'variants' | 'seo' | 'images') => void;
  isEdit: boolean;
  submitting: boolean;
  formErrors?: Record<string, string>;
  productName?: string;
  categoryName?: string;
  brandName?: string;
  uomName?: string;
  hsnCode?: string;
  productAttributes?: Array<{ key?: string; name?: string; value: string }>;
}

function generateDynamicProductContent({
  productName,
  categoryName,
  brandName,
  uomName,
  hsnCode,
  productAttributes = []
}: {
  productName: string;
  categoryName: string;
  brandName: string;
  uomName: string;
  hsnCode: string;
  productAttributes?: Array<{ key?: string; name?: string; value: string }>;
}) {
  const title = productName.trim() || 'Product Catalog Item';
  const brandText = brandName ? `by ${brandName}` : '';
  const categoryText = categoryName ? categoryName : 'Hardware & Fittings';
  
  const lowerCat = categoryName.toLowerCase();
  const lowerTitle = title.toLowerCase();

  // Category domain archetype detection
  let domain = 'general';
  if (lowerCat.includes('handle') || lowerCat.includes('knob') || lowerTitle.includes('handle') || lowerTitle.includes('knob') || lowerCat.includes('pull')) {
    domain = 'handles';
  } else if (lowerCat.includes('slide') || lowerCat.includes('hinge') || lowerCat.includes('channel') || lowerTitle.includes('slide') || lowerTitle.includes('channel') || lowerTitle.includes('hinge')) {
    domain = 'slides';
  } else if (lowerCat.includes('lock') || lowerCat.includes('cylinder') || lowerCat.includes('latch') || lowerTitle.includes('lock')) {
    domain = 'locks';
  } else if (lowerCat.includes('wardrobe') || lowerCat.includes('kitchen') || lowerCat.includes('basket') || lowerCat.includes('organizer') || lowerCat.includes('storage')) {
    domain = 'storage';
  }

  // Domain-tailored vocabulary and copy templates
  const domainProfiles: Record<string, {
    intros: string[];
    features: string[];
    shortPhrases: string[];
    applications: string[];
  }> = {
    handles: {
      intros: [
        `Elevate your furniture aesthetics with ${title}${brandText ? ` ${brandText}` : ''}.`,
        `Designed for modern interiors, ${title}${brandText ? ` ${brandText}` : ''} combines an ergonomic grip with refined surface styling.`,
        `The ${title}${brandText ? ` from ${brandName}` : ''} delivers an elegant finish to cabinets, drawers, and wardrobe doors.`
      ],
      features: [
        'Crafted with a durable surface coating resistant to tarnishing and daily wear.',
        'Ergonomically contoured for comfortable tactile feedback and smooth operation.',
        'Standard hole-pitch alignment for quick, hassle-free bolt-on installation.'
      ],
      shortPhrases: [
        `Sleek and durable ${title}${brandText ? ` ${brandText}` : ''} for luxury furniture and cabinet fittings.`,
        `Ergonomic ${title} featuring corrosion-resistant coating and modern styling.`,
        `Premium architectural ${title}${categoryName ? ` in ${categoryName}` : ''} designed for seamless interior integration.`
      ],
      applications: ['kitchen cabinetry', 'wardrobe shutters', 'office furniture', 'modular vanity units']
    },
    slides: {
      intros: [
        `Experience ultra-smooth drawer movement with ${title}${brandText ? ` ${brandText}` : ''}.`,
        `Engineered for high weight-bearing precision, ${title} ensures silent glide and long-term mechanical stability.`,
        `The ${title}${brandText ? ` ${brandText}` : ''} provides effortless opening and closing cycles for heavy-duty drawers.`
      ],
      features: [
        'Heavy-gauge steel construction for maximum load capacity and structural rigidity.',
        'Integrated soft-close damper for whisper-quiet operating performance.',
        'Rigorously tested for multi-cycle endurance under heavy daily utility.'
      ],
      shortPhrases: [
        `Heavy-duty ${title}${brandText ? ` ${brandText}` : ''} with smooth glide technology and high load tolerance.`,
        `Precision-engineered ${title} for silent, effortless drawer motion.`,
        `High-performance ${title} designed for smooth full-extension functionality.`
      ],
      applications: ['modular kitchen drawers', 'office filing cabinets', 'heavy storage drawers', 'architectural joinery']
    },
    locks: {
      intros: [
        `Ensure maximum security and peace of mind with ${title}${brandText ? ` ${brandText}` : ''}.`,
        `Built with high-precision locking mechanics, ${title} offers robust protection against forced entry.`,
        `The ${title}${brandText ? ` ${brandText}` : ''} delivers dependable security for residential and commercial entry points.`
      ],
      features: [
        'Hardened anti-pick pin cylinder mechanism for enhanced security.',
        'Durable internal components resistant to wear, corrosion, and tampering.',
        'Precision-cut keys engineered for smooth keyway insertion and rotation.'
      ],
      shortPhrases: [
        `High-security ${title}${brandText ? ` ${brandText}` : ''} with anti-tamper locking mechanism.`,
        `Robust and reliable ${title} for ultimate door and cabinet protection.`,
        `Precision-engineered ${title} featuring heavy-duty construction.`
      ],
      applications: ['main entrance doors', 'office cabins', 'secure storage units', 'commercial premises']
    },
    storage: {
      intros: [
        `Optimize space and storage layout with ${title}${brandText ? ` ${brandText}` : ''}.`,
        `Designed for maximum utility, ${title} brings intelligent organization to your living and storage spaces.`,
        `The ${title}${brandText ? ` ${brandText}` : ''} offers effortless access and clean aesthetic arrangement.`
      ],
      features: [
        'Heavy-gauge wireframe structure with protective anti-rust coating.',
        'Smooth pull-out mechanism for easy visibility and convenient reach.',
        'Optimized load distribution suitable for everyday kitchen and wardrobe utility.'
      ],
      shortPhrases: [
        `Space-saving ${title}${brandText ? ` ${brandText}` : ''} for modern, organized storage.`,
        `Intelligent storage solution: ${title} with durable frame and smooth access.`,
        `Premium ${title} designed for maximum space utilization and convenience.`
      ],
      applications: ['modular kitchens', 'walk-in wardrobes', 'pantry units', 'bedroom closets']
    },
    general: {
      intros: [
        `Enhance your projects with ${title}${brandText ? ` ${brandText}` : ''}.`,
        `The ${title}${brandText ? ` ${brandText}` : ''} is crafted for superior reliability, durability, and practical utility.`,
        `Built to meet professional standards, ${title} delivers dependable quality across applications.`
      ],
      features: [
        'Robust construction engineered for long service life.',
        'Precision manufacturing for standard fitment and easy installation.',
        'Versatile design suited for both commercial and residential setups.'
      ],
      shortPhrases: [
        `Premium quality ${title}${brandText ? ` ${brandText}` : ''} for professional catalog requirements.`,
        `Durable and dependable ${title} designed for versatile application.`,
        `High-performance ${title}${categoryName ? ` in ${categoryName}` : ''} built for lasting performance.`
      ],
      applications: ['residential spaces', 'commercial installations', 'architectural projects', 'industrial fittings']
    }
  };

  const profile = domainProfiles[domain] || domainProfiles.general;

  // Use a string hash of the title to pick varied phrasing deterministically
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  const pos = Math.abs(hash);

  const intro = profile.intros[pos % profile.intros.length];
  const shortDesc = profile.shortPhrases[pos % profile.shortPhrases.length];

  // Construct Detailed Description
  let detailedDesc = `${intro}\n${profile.features.join(' ')}\n\nIdeal for use in ${profile.applications.join(', ')}.\n\nKey Specifications:\n• Product Name: ${title}`;
  if (categoryName) detailedDesc += `\n• Category: ${categoryName}`;
  if (brandName) detailedDesc += `\n• Brand: ${brandName}`;
  if (uomName) detailedDesc += `\n• Unit of Measure: ${uomName}`;
  if (hsnCode) detailedDesc += `\n• HSN Code: ${hsnCode}`;

  if (productAttributes && productAttributes.length > 0) {
    detailedDesc += `\n\nAttributes:\n` + productAttributes.map(a => `• ${a.key || a.name}: ${a.value}`).join('\n');
  }

  // Search Tags
  const tags = Array.from(new Set([
    title.toLowerCase(),
    brandName.toLowerCase(),
    categoryName.toLowerCase(),
    uomName.toLowerCase(),
    'wholesale',
    'catalog'
  ].filter(Boolean))).join(', ');

  // Meta Title & Meta Description
  const metaTitle = `${title}${brandName ? ` | ${brandName}` : ''}${categoryName ? ` - ${categoryName}` : ''}`;
  const metaDesc = `${shortDesc} Available for fast delivery and wholesale bulk orders.`;

  return {
    metaTitle,
    metaDescription: metaDesc,
    tagsInput: tags,
    shortDescription: shortDesc,
    description: detailedDesc
  };
}

export function SeoTab({
  metaTitle,
  setMetaTitle,
  metaDescription,
  setMetaDescription,
  tagsInput,
  setTagsInput,
  shortDescription = '',
  setShortDescription,
  description = '',
  setDescription,
  setActiveTab,
  isEdit,
  submitting,
  formErrors = {},
  productName = '',
  categoryName = '',
  brandName = '',
  uomName = '',
  hsnCode = '',
  productAttributes = []
}: SeoTabProps) {
  const autoGenerateSeo = () => {
    const generated = generateDynamicProductContent({
      productName,
      categoryName,
      brandName,
      uomName,
      hsnCode,
      productAttributes
    });

    setMetaTitle(generated.metaTitle);
    setMetaDescription(generated.metaDescription);
    setTagsInput(generated.tagsInput);

    if (setShortDescription) setShortDescription(generated.shortDescription);
    if (setDescription) setDescription(generated.description);

    toast.success('Auto-generated category-tailored SEO Headers & Product Descriptions!');
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
        <div>
          <h3 className="text-base font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-600" />
            Search Engine Optimization (SEO) & Catalog Content
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Optimize search engine indexing headers and auto-generate product descriptions from catalog data.
          </p>
        </div>

        <Button
          type="button"
          onClick={autoGenerateSeo}
          className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          Auto-Generate SEO & Descriptions
        </Button>
      </div>

      <div className="space-y-4">
        {/* Meta Title */}
        <div className="space-y-1">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">
              Meta Title (SEO Title)
            </label>
            <span className="text-[10px] text-zinc-400 font-mono">
              {metaTitle.length}/60 chars
            </span>
          </div>
          <Input
            placeholder="e.g. Premium Brass Handle | Acme Hardware"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            error={formErrors.metaTitle}
          />
        </div>

        {/* Meta Description */}
        <div className="space-y-1">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">
              Meta Description
            </label>
            <span className="text-[10px] text-zinc-400 font-mono">
              {metaDescription.length}/160 chars
            </span>
          </div>
          <textarea
            className="w-full rounded-xl border bg-white border-zinc-200 focus:border-amber-500 px-3.5 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            placeholder="Write concise metadata indexing summary for search results..."
            rows={2}
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
          />
        </div>

        {/* Search Tags */}
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">
            Search Tags & Keywords (Comma separated)
          </label>
          <Input
            placeholder="e.g. brass, handle, cabinet, hardware, wholesale"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
          <p className="text-[11px] text-zinc-500 mt-1">Used for storefront instant search matching.</p>
        </div>

        {/* Product Catalog Short & Detailed Descriptions */}
        <div className="pt-3 border-t border-zinc-100 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
              Product Description Fields (Auto-Generated Content)
            </h4>
            <span className="text-[11px] text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Synced with Basic Information
            </span>
          </div>

          {/* Short Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-700">
              Short Description (Highlights)
            </label>
            <Input
              placeholder="Short summary highlighting key features..."
              value={shortDescription}
              onChange={(e) => setShortDescription && setShortDescription(e.target.value)}
            />
          </div>

          {/* Detailed Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-700">
              Detailed Description (Full Specifications & Usage)
            </label>
            <textarea
              className="w-full rounded-xl border bg-white border-zinc-200 focus:border-amber-500 px-3.5 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-sans"
              placeholder="Full detailed specifications and feature description..."
              rows={4}
              value={description}
              onChange={(e) => setDescription && setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Live Search Preview Box */}
        {(metaTitle || metaDescription) && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-1 mt-2">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Search Engine Result Preview</p>
            <p className="text-sm font-semibold text-blue-700 hover:underline cursor-pointer truncate">
              {metaTitle || 'Product Title'}
            </p>
            <p className="text-xs text-emerald-700 truncate">
              https://yourstore.com/products/{(metaTitle || 'product-slug').toLowerCase().replace(/[^a-z0-9]+/g, '-')}
            </p>
            <p className="text-xs text-zinc-600 line-clamp-2">
              {metaDescription || 'Add a meta description to preview search engine snippet text.'}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4 border-t border-zinc-200">
        <Button type="button" variant="ghost" onClick={() => setActiveTab('images')}>
          Back
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5"
        >
          {submitting ? 'Saving Product...' : isEdit ? 'Update Product Catalog' : 'Onboard Product Now'}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
