'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Customer } from '@/types';

type Response = {
  data: Customer | null;
};

export const useCustomerByPhone = (phone: string) => {
  return useQuery({
    queryKey: ['customers', 'by-phone', phone],
    enabled: Boolean(phone),
    queryFn: async () => {
      const res = await apiClient.get<Response>(
        `/api/crm/customers/search?phone=${encodeURIComponent(phone)}`
      );
      return res.data;
    },
  });
};
