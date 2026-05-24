'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Vehicle } from '@/types';

export type VehicleDetailResponse = {
  data: Vehicle;
  raw?: Record<string, any>;
};

export const useVehicle = (id: string, opts?: { full?: boolean }) => {
  return useQuery({
    queryKey: ['vehicles', 'by-id', id, opts?.full ? 'full' : 'partial'],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get<VehicleDetailResponse>(
        `/api/crm/vehicles/${encodeURIComponent(id)}${opts?.full ? '?full=1' : ''}`
      );
      return res;
    },
  });
};
