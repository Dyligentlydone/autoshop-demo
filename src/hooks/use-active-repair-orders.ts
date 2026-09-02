'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ActiveRepairOrderItem } from '@/types';
import {
  saveSnapshot,
  loadSnapshot,
  shouldFallBackToSnapshot,
  SNAP_KEYS,
} from '@/lib/local-snapshot';

type ActiveRepairOrdersResponse = {
  data: ActiveRepairOrderItem[];
};

export type ActiveRepairOrdersResult = {
  data: ActiveRepairOrderItem[];
  fromCache: boolean;
  cacheTimestamp: number | null;
};

export const useActiveRepairOrders = () => {
  return useQuery<ActiveRepairOrdersResult>({
    queryKey: ['dashboard', 'active-repair-orders'],
    staleTime: 30_000, // Consider data fresh for 30 seconds (matches server cache TTL)
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchInterval: 60_000, // Auto-refresh every 60 seconds for TV/dashboard display
    queryFn: async (): Promise<ActiveRepairOrdersResult> => {
      try {
        const res = await apiClient.get<ActiveRepairOrdersResponse>(
          '/api/crm/dashboard/active-repair-orders'
        );
        const data = res.data;
        saveSnapshot(SNAP_KEYS.activeRepairOrders, data);
        return { data, fromCache: false, cacheTimestamp: null };
      } catch (err) {
        if (shouldFallBackToSnapshot(err)) {
          const snapshot = loadSnapshot<ActiveRepairOrderItem[]>(SNAP_KEYS.activeRepairOrders);
          if (snapshot) {
            return { data: snapshot.data, fromCache: true, cacheTimestamp: snapshot.timestamp };
          }
        }
        throw err;
      }
    },
  });
};
