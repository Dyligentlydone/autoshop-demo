'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { VehicleDetailResponse } from './use-vehicle';

type Input = {
  id: string;
  year?: string;
  make?: string;
  model?: string;
  vin?: string;
  license_plate?: string;
  engine_size?: string;
  customer_id?: string;
  rawUpdates?: Record<string, any>;
};

export const useUpdateVehicle = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: Input) => {
      const { id, ...body } = input;
      return apiClient.patch<VehicleDetailResponse>(`/api/crm/vehicles/${encodeURIComponent(id)}`, body);
    },
    onSuccess: (data, vars) => {
      qc.setQueryData(['vehicles', 'by-id', vars.id, 'full'], data);
      qc.setQueryData(['vehicles', 'by-id', vars.id, 'partial'], data);
      qc.invalidateQueries({ queryKey: ['dashboard', 'active-repair-orders'] });
      if (vars.customer_id) {
        qc.invalidateQueries({ queryKey: ['vehicles', 'by-customer', vars.customer_id] });
      }
    },
  });
};
