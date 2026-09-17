import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const STALE_TIME = Infinity; // Data that rarely changes should be cached indefinitely during a session

export function useCategories() {
  return useQuery({
    queryKey: ['masters', 'categories'],
    queryFn: async () => {
      const res = await api.get('/masters/categories?limit=1000');
      return res.data.data || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ['masters', 'brands'],
    queryFn: async () => {
      const res = await api.get('/masters/brands?limit=1000');
      return res.data.data || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useUoms() {
  return useQuery({
    queryKey: ['masters', 'units'],
    queryFn: async () => {
      const res = await api.get('/masters/units?limit=1000');
      return res.data.data || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useTaxRates() {
  return useQuery({
    queryKey: ['masters', 'tax-rates'],
    queryFn: async () => {
      const res = await api.get('/masters/tax-rates?limit=1000');
      return res.data.data || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useHsnCodes() {
  return useQuery({
    queryKey: ['masters', 'hsn-codes'],
    queryFn: async () => {
      const res = await api.get('/masters/hsn-codes?limit=1000');
      return res.data.data || [];
    },
    staleTime: STALE_TIME,
  });
}

export function usePaymentTerms() {
  return useQuery({
    queryKey: ['masters', 'payment-terms'],
    queryFn: async () => {
      const res = await api.get('/masters/payment-terms?limit=1000');
      return res.data.data || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useContacts(type?: 'customer' | 'supplier' | 'all') {
  return useQuery({
    queryKey: ['contacts', type || 'all'],
    queryFn: async () => {
      const typeQuery = type && type !== 'all' ? `&type=${type}` : '';
      const res = await api.get(`/contacts?limit=1000${typeQuery}`);
      return res.data.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (contacts update more frequently than masters)
  });
}

export function useAttributes() {
  return useQuery({
    queryKey: ['products', 'attributes'],
    queryFn: async () => {
      const res = await api.get('/products/attributes');
      return res.data.data || [];
    },
    staleTime: STALE_TIME,
  });
}
