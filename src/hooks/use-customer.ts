'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Customer } from '@/types';

export type CustomerDetailResponse = {
  data: Customer;
  raw?: Record<string, any>;
};

export const useCustomer = (id: string, opts?: { full?: boolean }) => {
  return useQuery({
    queryKey: ['customers', 'by-id', id, opts?.full ? 'full' : 'partial'],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get<CustomerDetailResponse>(
        `/api/crm/customers/${encodeURIComponent(id)}${opts?.full ? '?full=1' : ''}`
      );
      return res;
    },
  });
};
