'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type GlobalSearchResponse = {
  customers: Array<{ id: string; name: string; phone?: string; email?: string }>;
  vehicles: Array<{
    id: string;
    display: string;
    vin?: string;
    plate?: string;
    customerName?: string;
    customerPhone?: string;
  }>;
  repairOrders: Array<{
    id: string;
    status: string;
    serviceType?: string;
    vehicleDisplay?: string;
    customerName?: string;
    customerPhone?: string;
    updatedAt?: string;
  }>;
};

export const useGlobalSearch = (q: string, opts?: { limit?: number }) => {
  const query = (q || '').trim();
  const limit = opts?.limit ?? 5;

  return useQuery({
    queryKey: ['global-search', query, limit],
    enabled: query.length > 0,
    queryFn: async () => {
      return apiClient.get<GlobalSearchResponse>(
        `/api/crm/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`
      );
    },
    staleTime: 30_000,
  });
};
