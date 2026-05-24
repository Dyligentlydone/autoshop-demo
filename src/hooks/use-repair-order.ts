'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { RepairOrder } from '@/types';

type RepairOrderResponse = {
  data: RepairOrder;
};

export const useRepairOrder = (id: string) => {
  return useQuery({
    queryKey: ['repair-orders', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get<RepairOrderResponse>(`/api/crm/repair-orders/${id}`);
      return res.data;
    },
  });
};
