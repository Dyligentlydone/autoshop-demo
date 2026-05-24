'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { RepairOrder, Vehicle } from '@/types';

type Response = {
  data: {
    repairOrder: RepairOrder;
    vehicle: Vehicle;
    action: 'linked_existing_vehicle' | 'updated_vehicle_vin' | 'vin_already_on_current_vehicle';
  };
};

type Input = {
  repair_order_id: string;
  vin: string;
};

export const useCheckInVin = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: Input) => {
      const res = await apiClient.post<Response>(
        `/api/crm/repair-orders/${input.repair_order_id}/check-in-vin`,
        { vin: input.vin }
      );
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['repair-orders', vars.repair_order_id] });
      qc.invalidateQueries({ queryKey: ['repair-orders', 'enriched'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'active-repair-orders'] });
    },
  });
};
