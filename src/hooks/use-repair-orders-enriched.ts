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

type EnrichedResponse = {
  data: ActiveRepairOrderItem[];
  info?: {
    count: number;
    more_records: boolean;
  };
};

export type EnrichedResult = {
  data: EnrichedResponse;
  fromCache: boolean;
  cacheTimestamp: number | null;
};

type Params = {
  status?: string;
  page?: number;
  perPage?: number;
};

export const useRepairOrdersEnriched = (params: Params = {}) => {
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 50;

  return useQuery<EnrichedResult>({
    queryKey: ['repair-orders', 'enriched', { status: params.status || '', page, perPage }],
    queryFn: async (): Promise<EnrichedResult> => {
      const sp = new URLSearchParams();
      sp.set('page', String(page));
      sp.set('perPage', String(perPage));
      if (params.status) sp.set('status', params.status);

      // Only the unfiltered first page is worth caching for offline viewing.
      const snapshotKey =
        page === 1 && !params.status ? SNAP_KEYS.repairOrdersEnriched(perPage) : null;

      try {
        const res = await apiClient.get<EnrichedResponse>(
          `/api/crm/repair-orders/enriched?${sp.toString()}`
        );
        if (snapshotKey) {
          saveSnapshot(snapshotKey, res);
        }
        return { data: res, fromCache: false, cacheTimestamp: null };
      } catch (err) {
        if (snapshotKey && shouldFallBackToSnapshot(err)) {
          const snapshot = loadSnapshot<EnrichedResponse>(snapshotKey);
          if (snapshot) {
            return { data: snapshot.data, fromCache: true, cacheTimestamp: snapshot.timestamp };
          }
        }
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });
};
