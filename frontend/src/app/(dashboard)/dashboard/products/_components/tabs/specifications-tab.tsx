'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles, Plus, X, Tag, ArrowRight } from 'lucide-react';

export interface SpecificationsTabProps {
  productAttributes: { key: string; value: string }[];
  setProductAttributes: (v: { key: string; value: string }[]) => void;
  hasVariants: boolean;
  setActiveTab: (v: 'basic' | 'pricing' | 'specifications' | 'variants' | 'seo' | 'images') => void;
}

// Preset dictionary for quick auto-suggestions
const SPEC_SUGGESTIONS: Record<string, string[]> = {
  material: ['Zinc Alloy', 'Stainless Steel (SS 304)', 'Brass', 'Aluminum', 'Iron', 'Mild Steel', 'Plastic/ABS'],
  finish: ['Stainless Steel (SS)', 'Chrome Plated (CP)', 'Matte Black', 'Antique Brass (AB)', 'PVD Rose Gold', 'PVD Gold'],
  warranty: ['1 Year', '2 Years', '5 Years', '10 Years', 'Lifetime'],
  mounting: ['Surface Mount', 'Concealed', 'Screw-on', 'Mortise', 'Self-Closing'],
  application: ['Cabinet', 'Wardrobe', 'Main Door', 'Drawer', 'Glass Door', 'Window'],
  thickness: ['1.0mm', '1.5mm', '2.0mm', '3.0mm'],
  grade: ['SS 202', 'SS 304', 'SS 316', 'Commercial Grade'],
};

const COMMON_KEYS = [
  { name: 'Material', isPopular: true, defaultValue: 'Zinc Alloy' },
  { name: 'Finish', isPopular: true, defaultValue: 'Stainless Steel' },
  { name: 'Warranty', isPopular: false, defaultValue: '5 Years' },
  { name: 'Mounting Type', isPopular: false, defaultValue: 'Screw-on' },
  { name: 'Usage/Application', isPopular: false, defaultValue: 'Cabinet' },
  { name: 'Grade', isPopular: false, defaultValue: 'SS 304' },
  { name: 'Thickness', isPopular: false, defaultValue: '1.5mm' },
  { name: 'Country of Origin', isPopular: false, defaultValue: 'India' },
];

function SpecValueTagInput({
  specKey,
  valueStr,
  onChange,
}: {
  specKey: string;
  valueStr: string;
  onChange: (newValStr: string) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Parse current tags from comma-separated string
  const currentTags = valueStr
    ? valueStr.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const keyLower = specKey.trim().toLowerCase();
  const suggestions = SPEC_SUGGESTIONS[keyLower] || (keyLower.includes('mat') ? SPEC_SUGGESTIONS.material : []);

  // Filter suggestions that aren't already selected
  const availableSuggestions = suggestions.filter(
    (s) => !currentTags.some((t) => t.toLowerCase() === s.toLowerCase())
  );

  // Inline ghost text match
  const topMatch = inputValue.trim()
    ? availableSuggestions.find((s) =>
        s.toLowerCase().startsWith(inputValue.trim().toLowerCase())
      )
    : null;

  const addTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim();
    if (!clean) return;
    if (currentTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setInputValue('');
      return;
    }
    const nextTags = [...currentTags, clean];
    onChange(nextTags.join(', '));
    setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    const nextTags = currentTags.filter((t) => t !== tagToRemove);
    onChange(nextTags.join(', '));
  };

  return (
    <div className="space-y-2">
      <div
        className={`min-h-[42px] w-full bg-white rounded-lg border px-3 py-1.5 flex flex-wrap items-center gap-1.5 transition-all ${
          isFocused
            ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
            : 'border-zinc-200 hover:border-zinc-300'
        }`}
      >
        {currentTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs"
          >
            <Tag className="w-3 h-3 text-amber-600" />
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-amber-700 hover:text-amber-950 hover:bg-amber-200/50 rounded-xs p-0.5 ml-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <div className="relative flex-1 min-w-[140px]">
          {inputValue && topMatch && topMatch.toLowerCase().startsWith(inputValue.toLowerCase()) && (
            <div className="absolute inset-0 flex items-center pointer-events-none text-zinc-400 font-normal text-sm select-none pl-0">
              <span className="opacity-0">{inputValue}</span>
              <span>{topMatch.slice(inputValue.length)}</span>
              <span className="ml-2 text-[9px] bg-zinc-100 text-zinc-500 px-1 rounded font-mono">
                Tab ↹
              </span>
            </div>
          )}

          <input
            type="text"
            className="w-full bg-transparent p-0 placeholder:text-zinc-400 text-zinc-800 text-sm focus:outline-none focus:ring-0 border-none outline-none ring-0"
            placeholder={currentTags.length === 0 ? `Type values for ${specKey || 'specification'} (e.g. Zinc Alloy)...` : 'Add value...'}
            value={inputValue}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              if (inputValue.trim()) {
                addTag(inputValue);
              }
            }}
            onChange={(e) => {
              const val = e.target.value;
              if (val.endsWith(',')) {
                addTag(val.slice(0, -1));
              } else {
                setInputValue(val);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab' || e.key === 'Enter') {
                if (topMatch) {
                  e.preventDefault();
                  addTag(topMatch);
                } else if (inputValue.trim()) {
                  e.preventDefault();
                  addTag(inputValue);
                }
              } else if (e.key === 'Backspace' && !inputValue && currentTags.length > 0) {
                removeTag(currentTags[currentTags.length - 1]);
              }
            }}
          />
        </div>
      </div>

      {/* Suggested Value Chips when focused or when available */}
      {isFocused && availableSuggestions.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1 animate-in fade-in duration-200">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Suggested:</span>
          {availableSuggestions.slice(0, 6).map((sugg) => (
            <button
              key={sugg}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(sugg);
              }}
              className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 hover:bg-amber-100 hover:text-amber-900 border border-zinc-200 transition-colors"
            >
              + {sugg}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SpecificationsTab({
  productAttributes,
  setProductAttributes,
  hasVariants,
  setActiveTab
}: SpecificationsTabProps) {
  return (
    <Card className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-6">
      <div>
        <h3 className="text-base font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
          Product Specifications
        </h3>
        <p className="text-xs text-zinc-500 mt-1">
          Add key specification attributes (e.g., <strong className="text-zinc-700">Material</strong>, <strong className="text-zinc-700">Finish</strong>, <strong className="text-zinc-700">Warranty</strong>) with tag pills or comma-separated values to display on your storefront and catalog.
        </p>
      </div>

      {/* Quick Presets Section */}
      <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>Mostly Needed Specifications (Click to Quick Add)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {COMMON_KEYS.map((preset) => {
            const isAlreadyAdded = productAttributes.some(
              (a) => a.key.trim().toLowerCase() === preset.name.toLowerCase()
            );

            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  if (isAlreadyAdded) return;
                  // If first item is completely blank, populate it
                  if (
                    productAttributes.length === 1 &&
                    !productAttributes[0].key.trim() &&
                    !productAttributes[0].value.trim()
                  ) {
                    setProductAttributes([{ key: preset.name, value: preset.defaultValue }]);
                  } else {
                    setProductAttributes([
                      ...productAttributes,
                      { key: preset.name, value: preset.defaultValue },
                    ]);
                  }
                }}
                disabled={isAlreadyAdded}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-2xs ${
                  isAlreadyAdded
                    ? 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed opacity-60'
                    : preset.isPopular
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                    : 'bg-white hover:bg-amber-100 text-zinc-700 hover:text-amber-900 border border-zinc-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                {preset.name}
                {preset.isPopular && (
                  <span className="text-[9px] bg-amber-800/40 text-amber-100 px-1 rounded font-bold">
                    MOST NEEDED
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Specifications Builder List */}
      <div className="space-y-4 pt-2">
        {productAttributes.length === 0 ? (
          <div className="text-center py-8 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 space-y-3">
            <p className="text-xs text-zinc-500 font-medium">No specifications added yet.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setProductAttributes([{ key: 'Material', value: 'Zinc Alloy' }])}
              className="text-xs font-bold border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            >
              + Add Material Specification
            </Button>
          </div>
        ) : (
          productAttributes.map((attr, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 hover:bg-white hover:border-amber-300 transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Specification #{idx + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setProductAttributes(productAttributes.filter((_, i) => i !== idx));
                  }}
                  className="text-zinc-400 hover:text-red-600 hover:bg-red-50 h-7 px-2 text-xs font-semibold"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Remove
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Property Key */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Property Name / Key
                  </label>
                  <Input
                    placeholder="e.g. Material, Finish"
                    value={attr.key}
                    onChange={(e) => {
                      const copy = [...productAttributes];
                      copy[idx].key = e.target.value;
                      setProductAttributes(copy);
                    }}
                    className="bg-white border-zinc-200 text-sm font-semibold text-zinc-800"
                  />
                </div>

                {/* Property Values (Tag Pills Input) */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Values (Type & press Comma or Enter to add tags)
                  </label>
                  <SpecValueTagInput
                    specKey={attr.key}
                    valueStr={attr.value}
                    onChange={(newValStr) => {
                      const copy = [...productAttributes];
                      copy[idx].value = newValStr;
                      setProductAttributes(copy);
                    }}
                  />
                </div>
              </div>
            </div>
          ))
        )}

        <Button
          type="button"
          variant="outline"
          onClick={() => setProductAttributes([...productAttributes, { key: '', value: '' }])}
          className="text-xs font-semibold border-zinc-200 hover:bg-zinc-800 hover:text-white text-zinc-700"
        >
          + Add Custom Specification Row
        </Button>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-zinc-200">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveTab('pricing')}
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={() => setActiveTab('images')}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5"
        >
          Continue to Images
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
