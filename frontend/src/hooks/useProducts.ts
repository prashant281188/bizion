import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function useProductSearch(searchTerm: string, limit: number = 20) {
  return useQuery({
    queryKey: ['products', 'search', searchTerm, limit],
    queryFn: async () => {
      const res = await api.get(`/products?search=${encodeURIComponent(searchTerm)}&limit=${limit}&flattenVariants=true`);
      return res.data.data || [];
    },
    staleTime: 60 * 1000, // 1 minute
  });
}
