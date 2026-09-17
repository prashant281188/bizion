import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  sku?: string;
  imageUrl?: string;
  rightElement?: React.ReactNode;
}

interface SearchableSelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  minSearchChars?: number;
  onCreateNew?: (searchTerm: string) => void;
  createNewText?: string;
  dropdownPosition?: 'top' | 'bottom';
  onSearch?: (term: string) => void;
  loading?: boolean;
}

export function SearchableSelect({
  label,
  placeholder = 'Search & select option...',
  options,
  value,
  onChange,
  onCreateNew,
  error,
  disabled = false,
  required = false,
  className,
  id,
  minSearchChars = 1,
  dropdownPosition = 'bottom',
  createNewText = 'Item',
  onSearch,
  loading = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (selectedOption) {
      setSearchTerm(selectedOption.label);
    } else {
      setSearchTerm('');
    }
  }, [value, selectedOption]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedOption) {
          setSearchTerm(selectedOption.label);
        } else {
          setSearchTerm('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption]);

  const filteredOptions = useMemo(() => {
    if (onSearch) return options;

    const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    let matched = options;

    if (searchWords.length > 0) {
      matched = options.filter((opt) => {
        return searchWords.every((word) => {
          return (
            opt.label.toLowerCase().includes(word) ||
            (opt.sublabel && opt.sublabel.toLowerCase().includes(word)) ||
            (opt.sku && opt.sku.toLowerCase().includes(word))
          );
        });
      });
    }

    // Sort matching options in ascending alphabetical order by label (prioritizing direct variants when searching)
    return [...matched].sort((a, b) => {
      if (searchWords.length > 0) {
        const aIsVariant = a.value.includes(':') && !a.value.endsWith(':default');
        const bIsVariant = b.value.includes(':') && !b.value.endsWith(':default');

        if (aIsVariant && !bIsVariant) return -1;
        if (!aIsVariant && bIsVariant) return 1;
      }

      return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [options, searchTerm, onSearch]);

  // Reset highlighted index to -1 when options change or dropdown opens without active typing
  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Scroll the highlighted option into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    const el = optionRefs.current.get(highlightedIndex);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      const opt = options.find((o) => o.value === val);
      if (opt) {
        setSearchTerm(opt.label);
      }
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [onChange, options],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    setIsOpen(true);
    // Highlight first option ONLY when user has typed text
    setHighlightedIndex(val.trim().length > 0 ? 0 : -1);

    if (onSearch) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        onSearch(val);
      }, 300);
    }

    if (val === '') {
      onChange('');
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    const optionCount = filteredOptions.length;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (optionCount === 0) return;
        setHighlightedIndex((prev) => (prev < 0 ? 0 : (prev + 1) % optionCount));
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (optionCount === 0) return;
        setHighlightedIndex((prev) => (prev <= 0 ? optionCount - 1 : prev - 1));
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (optionCount > 0 && highlightedIndex >= 0 && highlightedIndex < optionCount) {
          handleSelect(filteredOptions[highlightedIndex].value);
        } else if (onCreateNew) {
          onCreateNew(searchTerm);
          setIsOpen(false);
        }
        break;
      }
      case 'Tab': {
        if (isOpen) {
          if (filteredOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
            handleSelect(filteredOptions[highlightedIndex].value);
          } else {
            setIsOpen(false);
            if (selectedOption) {
              setSearchTerm(selectedOption.label);
            } else {
              setSearchTerm('');
            }
          }
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setIsOpen(false);
        if (selectedOption) {
          setSearchTerm(selectedOption.label);
        } else {
          setSearchTerm('');
        }
        break;
      }
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
      if (selectedOption) {
        setSearchTerm(selectedOption.label);
      } else {
        setSearchTerm('');
      }
    }
  };

  const setOptionRef = (index: number, el: HTMLButtonElement | null) => {
    if (el) {
      optionRefs.current.set(index, el);
    } else {
      optionRefs.current.delete(index);
    }
  };

  return (
    <div ref={containerRef} onBlur={handleBlur} className={cn('relative w-full', className?.replace(/\bh-\d+\b/g, ''))}>
      <Input
        id={id}
        label={label}
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={(e) => {
          if (!disabled) {
            e.target.select();
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        error={error}
        disabled={disabled}
        required={required}
        className="pr-10"
      />

      {/* Dropdown Indicator Icon */}
      <div
        className={cn(
          'absolute right-3 flex items-center pointer-events-none text-zinc-400',
          label ? 'top-[34px]' : 'top-1/2 -translate-y-1/2',
        )}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && !disabled && (minSearchChars === 0 || searchTerm.trim().length >= minSearchChars) && (
        <div
          ref={listRef}
          className={cn(
            "absolute z-[99999] w-full min-w-full rounded-xl border border-zinc-200/80 bg-white shadow-2xl max-h-72 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-150",
            dropdownPosition === 'top' ? "bottom-full mb-2" : "mt-2"
          )}
          role="listbox"
        >
          {loading ? (
            <div className="px-5 py-6 text-sm text-zinc-500 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-1" />
              <span className="font-medium text-zinc-600">Searching...</span>
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-5 py-6 text-sm text-zinc-500 flex flex-col items-center justify-center gap-2">
              <svg className="w-8 h-8 text-zinc-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="font-medium text-zinc-600">No matching items found.</span>
              <span className="text-xs text-zinc-400">Try a different search term.</span>
            </div>
          ) : (
            <div className="py-2">
              {filteredOptions.map((opt, index) => {
                const isSelected = opt.value === value;
                const isHighlighted = index === highlightedIndex;
                return (
                  <div
                    key={opt.value}
                    ref={(el) => setOptionRef(index, el as any)}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(opt.value);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 flex items-center justify-between cursor-pointer transition-all border-l-2',
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500'
                        : isHighlighted
                          ? 'bg-zinc-100 border-transparent'
                          : 'border-transparent hover:bg-zinc-50',
                    )}
                  >
                    <div className="flex flex-col gap-0.5 overflow-hidden pr-4 flex-grow">
                      <div className="flex items-center gap-3">
                        {opt.imageUrl && (
                          <div className="w-8 h-8 rounded-md overflow-hidden bg-zinc-100 border border-zinc-200/60 shrink-0 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={opt.imageUrl} alt={opt.label} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex flex-col overflow-hidden">
                          <span className={cn(
                            "text-sm truncate transition-colors duration-150",
                            isSelected ? "font-bold text-amber-900" : "font-medium text-zinc-700 hover:text-zinc-900"
                          )}>{opt.label}</span>
                          {opt.sublabel && (
                            <span
                              className={cn(
                                'text-[11px] truncate font-medium',
                                isSelected ? 'text-amber-700/80' : 'text-zinc-400',
                              )}
                            >
                              {opt.sublabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {opt.rightElement && (
                        <div className="flex-shrink-0">
                          {opt.rightElement}
                        </div>
                      )}
                      {isSelected && (
                        <div className="flex-shrink-0 text-amber-600 animate-in zoom-in duration-200">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {onCreateNew && (
            <div className="sticky bottom-0 border-t border-zinc-200 bg-zinc-50 p-2.5 backdrop-blur-md bg-zinc-50/90 z-10">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCreateNew(searchTerm);
                  setIsOpen(false);
                }}
                onClick={() => {
                  onCreateNew(searchTerm);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-amber-700 bg-white border border-zinc-200 rounded-lg hover:border-amber-300 hover:bg-amber-50 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/20 active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Create New {searchTerm ? `"${searchTerm}"` : createNewText}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
