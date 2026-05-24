'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Vehicle } from '@/types';

type Response = {
  data: Vehicle;
};

type Input = {
  year: string;
  make: string;
  model: string;
  vin?: string;
  license_plate?: string;
  engine_size?: string;
  customer_id: string;
};

export const useCreateVehicle = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: Input) => {
      const res = await apiClient.post<Response>('/api/crm/vehicles', input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', 'active-repair-orders'] });
    },
  });
};
