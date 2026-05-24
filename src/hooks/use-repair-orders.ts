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

type Params = {
  status?: string;
  page?: number;
  perPage?: number;
};

export const useRepairOrders = (params: Params = {}) => {
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;

  return useQuery({
    queryKey: ['repair-orders', { status: params.status || '', page, perPage }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set('page', String(page));
      sp.set('perPage', String(perPage));
      if (params.status) sp.set('status', params.status);

      const res = await apiClient.get<RepairOrdersResponse>(`/api/crm/repair-orders?${sp.toString()}`);
      return res;
    },
  });
};
