'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ActiveRepairOrderItem } from '@/types';

type Response = {
  data: ActiveRepairOrderItem[];
  info?: {
    count: number;
    more_records: boolean;
  };
};

type Params = {
  status?: string;
  page?: number;
  perPage?: number;
};

export const useRepairOrdersEnriched = (params: Params = {}) => {
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 50;

  return useQuery({
    queryKey: ['repair-orders', 'enriched', { status: params.status || '', page, perPage }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set('page', String(page));
      sp.set('perPage', String(perPage));
      if (params.status) sp.set('status', params.status);

      return apiClient.get<Response>(`/api/crm/repair-orders/enriched?${sp.toString()}`);
    },
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });
};
