'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { RepairOrder } from '@/types';

type RepairOrdersResponse = {
  data: RepairOrder[];
  info?: {
    count: number;
    more_records: boolean;
  };
};

export const useRepairOrdersByVehicle = (vehicleId: string) => {
  return useQuery({
    queryKey: ['repair-orders', 'by-vehicle', vehicleId],
    enabled: Boolean(vehicleId),
    queryFn: async () => {
      const res = await apiClient.get<RepairOrdersResponse>(
        `/api/crm/vehicles/${encodeURIComponent(vehicleId)}/repair-orders`
      );
      return res;
    },
  });
};
