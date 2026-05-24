'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ActiveRepairOrderItem } from '@/types';

type ActiveRepairOrdersResponse = {
  data: ActiveRepairOrderItem[];
};

export const useActiveRepairOrders = () => {
  return useQuery({
    queryKey: ['dashboard', 'active-repair-orders'],
    staleTime: 30_000, // Consider data fresh for 30 seconds (matches server cache TTL)
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchInterval: 60_000, // Auto-refresh every 60 seconds for TV/dashboard display
    queryFn: async () => {
      const res = await apiClient.get<ActiveRepairOrdersResponse>(
        '/api/crm/dashboard/active-repair-orders'
      );
      return res.data;
    },
  });
};
