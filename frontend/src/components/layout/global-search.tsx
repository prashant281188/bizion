'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, User, Package, Building2, Tag, FileText } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command';
import { Command as CommandPrimitive } from 'cmdk';
import { useDebounce } from '@/hooks/use-debounce';
import api from '@/lib/api';

type Contact = {
  id: string;
  name: string;
  companyName: string | null;
  type: string;
};

type Product = {
  id: string;
  name: string;
  sku: string | null;
  hasVariants?: boolean;
};

type Variant = {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  documentType: string;
  totalAmount: string;
  status: string;
  contactName: string | null;
};

type SearchResults = {
  contacts: Contact[];
  products: Product[];
  variants: Variant[];
  invoices: Invoice[];
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<SearchResults>({ contacts: [], products: [], variants: [], invoices: [] });
  const router = useRouter();
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Ignore shortcut triggers inside input / textarea / editable elements unless pressing Escape or Cmd+K
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);

      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
        return;
      }

      if (e.altKey && !isInput) {
        const code = e.code;
        const key = e.key.toLowerCase();
        if (code === 'KeyI' || key === 'i') {
          e.preventDefault();
          setOpen(false);
          router.push('/dashboard/invoices/new');
        } else if (code === 'KeyO' || key === 'o') {
          e.preventDefault();
          setOpen(false);
          router.push('/dashboard/orders/sales/new');
        } else if (code === 'KeyP' || key === 'p') {
          e.preventDefault();
          setOpen(false);
          router.push('/dashboard/orders/purchases/new');
        } else if (code === 'KeyD' || key === 'd') {
          e.preventDefault();
          setOpen(false);
          router.push('/dashboard/dispatches/new');
        } else if (code === 'KeyN' || key === 'n') {
          e.preventDefault();
          setOpen(false);
          router.push('/dashboard/products/new');
        } else if (code === 'KeyC' || key === 'c') {
          e.preventDefault();
          setOpen(false);
          router.push('/dashboard/contacts?action=new');
        } else if (code === 'KeyR' || key === 'r') {
          e.preventDefault();
          setOpen(false);
          window.dispatchEvent(new CustomEvent('open-record-payment-modal'));
        }
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults({ contacts: [], products: [], variants: [], invoices: [] });
      return;
    }

    const fetchSearchResults = async () => {
      setIsLoading(true);
      try {
        const response = await api.get(`/search?q=${encodeURIComponent(debouncedQuery)}`);
        if (response.data?.success) {
          setResults(response.data.data);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSearchResults();
  }, [debouncedQuery]);

  const handleSelectContact = (id: string) => {
    setOpen(false);
    setQuery('');
    router.push(`/dashboard/analytics/customers?customerId=${id}`);
  };

  const handleSelectProduct = (id: string) => {
    setOpen(false);
    setQuery('');
    router.push(`/dashboard/analytics/products?productId=${id}`);
  };

  const handleSelectVariant = (productId: string) => {
    setOpen(false);
    setQuery('');
    // Since variants belong to products, we route to the parent product page
    router.push(`/dashboard/analytics/products?productId=${productId}`);
  };

  const handleSelectInvoice = (id: string) => {
    setOpen(false);
    setQuery('');
    router.push(`/dashboard/invoices/${id}`);
  };

  const filteredProducts = results.products.filter(product => !product.hasVariants);

  return (
    <Command 
      shouldFilter={false}
      className="relative w-full max-w-sm overflow-visible bg-transparent"
      onBlur={(e) => {
        // If focus moves outside this component, close the dropdown
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
    >
      <div className="cursor-text rounded-lg border border-zinc-200 bg-white/50 px-3 py-1.5 text-sm text-zinc-500 shadow-sm transition-colors hover:bg-white focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 flex items-center">
        <Search className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
        <CommandPrimitive.Input
            ref={inputRef}
            className="flex-1 bg-transparent placeholder:text-zinc-400 text-zinc-900 p-0 m-0 w-full"
            style={{ border: 'none', boxShadow: 'none', outline: 'none' }}
            placeholder="Search parties, products, variants..."
            value={query}
            onValueChange={(val) => {
              setQuery(val);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
        />
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 font-mono text-[10px] font-medium text-zinc-500 opacity-100 sm:flex ml-2">
          <span className="text-xs">⌘</span>K
        </kbd>
      </div>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-[400px] z-[60] bg-white rounded-xl shadow-lg border border-zinc-200 overflow-hidden">
            <CommandList className="max-h-[300px] overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-amber-500 mr-2" />
                <span className="text-zinc-500 text-sm">Searching...</span>
              </div>
            )}

            {!isLoading && query.length === 0 && (
              <CommandGroup heading="Quick Actions &amp; Global Shortcuts">
                <CommandItem
                  onSelect={() => { setOpen(false); router.push('/dashboard/invoices/new'); }}
                  className="px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-amber-50 cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-[11px] font-bold">+</span>
                  <span>Create New Sales Invoice</span>
                  <CommandShortcut className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
                    Alt + I
                  </CommandShortcut>
                </CommandItem>

                <CommandItem
                  onSelect={() => { setOpen(false); router.push('/dashboard/orders/sales/new'); }}
                  className="px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-amber-50 cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-[11px] font-bold">+</span>
                  <span>Create New Sales Order</span>
                  <CommandShortcut className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
                    Alt + O
                  </CommandShortcut>
                </CommandItem>

                <CommandItem
                  onSelect={() => { setOpen(false); router.push('/dashboard/orders/purchases/new'); }}
                  className="px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-amber-50 cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center text-[11px] font-bold">+</span>
                  <span>Create Purchase Order</span>
                  <CommandShortcut className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
                    Alt + P
                  </CommandShortcut>
                </CommandItem>

                <CommandItem
                  onSelect={() => { setOpen(false); router.push('/dashboard/dispatches/new'); }}
                  className="px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-amber-50 cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center text-[11px] font-bold">+</span>
                  <span>Create Dispatch Advice</span>
                  <CommandShortcut className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
                    Alt + D
                  </CommandShortcut>
                </CommandItem>

                <CommandItem
                  onSelect={() => { setOpen(false); router.push('/dashboard/products/new'); }}
                  className="px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-amber-50 cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-[11px] font-bold">+</span>
                  <span>Add New Product Master</span>
                  <CommandShortcut className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
                    Alt + N
                  </CommandShortcut>
                </CommandItem>

                <CommandItem
                  onSelect={() => { setOpen(false); router.push('/dashboard/contacts?action=new'); }}
                  className="px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-amber-50 cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center text-[11px] font-bold">+</span>
                  <span>Create New Contact</span>
                  <CommandShortcut className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
                    Alt + C
                  </CommandShortcut>
                </CommandItem>

                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    window.dispatchEvent(new CustomEvent('open-record-payment-modal'));
                  }}
                  className="px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-amber-50 cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-[11px] font-bold">₹</span>
                  <span>Record Payment &amp; Cheque</span>
                  <CommandShortcut className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
                    Alt + R
                  </CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}

            {!isLoading && query.length >= 2 && results.contacts.length === 0 && results.products.length === 0 && results.variants.length === 0 && results.invoices.length === 0 && (
              <CommandEmpty>
                <div className="py-6 text-center text-sm text-zinc-500">
                  No results found for "<span className="font-semibold text-zinc-700">{query}</span>"
                </div>
              </CommandEmpty>
            )}
            
            {results.contacts?.length > 0 && (
              <CommandGroup heading="Parties">
                {results.contacts.map((contact) => (
                  <CommandItem
                    key={contact.id}
                    value={`contact-${contact.id}`}
                    onSelect={() => handleSelectContact(contact.id)}
                    className="flex flex-col items-start gap-0 py-1 cursor-pointer"
                  >
                    <div className="flex items-center w-full">
                      <User className="mr-2 h-4 w-4 text-amber-600" />
                      <span className="font-medium text-zinc-900">{contact.name}</span>
                      {contact.type && (
                        <span className="ml-auto text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                          {contact.type}
                        </span>
                      )}
                    </div>
                    {contact.companyName && (
                      <div className="flex items-center text-[11px] text-zinc-500 pl-6 -mt-0.5">
                        <Building2 className="mr-1 h-3 w-3" />
                        {contact.companyName}
                      </div>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredProducts.length > 0 && (
              <CommandGroup heading="Products">
                {filteredProducts.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={`product-${product.id}`}
                    onSelect={() => handleSelectProduct(product.id)}
                    className="flex flex-col items-start gap-0 py-1 cursor-pointer"
                  >
                    <div className="flex items-center w-full">
                      <Package className="mr-2 h-4 w-4 text-amber-600" />
                      <span className="font-medium text-zinc-900">{product.name}</span>
                    </div>
                    {product.sku && (
                      <div className="text-[11px] text-zinc-500 pl-6 -mt-0.5">
                        SKU: {product.sku}
                      </div>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.variants.length > 0 && (
              <CommandGroup heading="Product Variants">
                {results.variants.map((variant) => (
                  <CommandItem
                    key={variant.id}
                    value={`variant-${variant.id}`}
                    onSelect={() => handleSelectVariant(variant.productId)}
                    className="flex flex-col items-start gap-0 py-1 cursor-pointer"
                  >
                    <div className="flex items-center w-full">
                      <Tag className="mr-2 h-4 w-4 text-sky-600" />
                      <span className="font-medium text-zinc-900">{variant.name}</span>
                    </div>
                    {variant.sku && (
                      <div className="text-[11px] text-zinc-500 pl-6 -mt-0.5">
                        SKU: {variant.sku}
                      </div>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.invoices?.length > 0 && (
              <CommandGroup heading="Invoices">
                {results.invoices.map((invoice) => (
                  <CommandItem
                    key={invoice.id}
                    value={`invoice-${invoice.id}`}
                    onSelect={() => handleSelectInvoice(invoice.id)}
                    className="flex flex-col items-start gap-0 py-1 cursor-pointer"
                  >
                    <div className="flex items-center w-full">
                      <FileText className="mr-2 h-4 w-4 text-amber-600" />
                      <span className="font-medium text-zinc-900">{invoice.invoiceNumber}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                        {invoice.status}
                      </span>
                    </div>
                    {invoice.contactName && (
                      <div className="text-[11px] text-zinc-500 pl-6 -mt-0.5">
                        To: {invoice.contactName}
                      </div>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            </CommandList>
        </div>
      )}
    </Command>
  );
}
