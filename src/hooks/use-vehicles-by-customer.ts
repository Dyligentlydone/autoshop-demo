'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Vehicle } from '@/types';

type Response = {
  data: Vehicle[];
  info?: {
    count: number;
    more_records: boolean;
  };
};

export const useVehiclesByCustomer = (customerId: string) => {
  return useQuery({
    queryKey: ['vehicles', 'by-customer', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const res = await apiClient.get<Response>(
        `/api/crm/vehicles/by-customer?customer_id=${encodeURIComponent(customerId)}`
      );
      return res.data;
    },
  });
};
