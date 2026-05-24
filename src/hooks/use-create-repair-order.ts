'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { RepairOrder, RepairOrderStatus } from '@/types';

type RepairOrderResponse = {
  data: RepairOrder;
};

type CreateRepairOrderInput = {
  vehicle_id: string;
  customer_id?: string;
  status?: RepairOrderStatus;
  service_type?: string;
  job_description?: string;
  note?: string;
  notes?: string;
  estimated_total?: number;
  final_charge_total?: number;
  estimated_completion?: string;
  scheduled_drop_off?: string;
};

export const useCreateRepairOrder = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRepairOrderInput) => {
      const res = await apiClient.post<RepairOrderResponse>('/api/crm/repair-orders', input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repair-orders'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'active-repair-orders'] });
    },
  });
};
