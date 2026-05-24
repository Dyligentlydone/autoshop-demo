'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { RepairOrder, RepairOrderStatus } from '@/types';

type RepairOrderResponse = {
  data: RepairOrder;
};

type UpdateRepairOrderInput = {
  id: string;
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

export const useUpdateRepairOrder = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateRepairOrderInput) => {
      const { id, ...body } = input;
      const res = await apiClient.patch<RepairOrderResponse>(`/api/crm/repair-orders/${id}`, body);
      return res.data;
    },
    onSuccess: (updated) => {
      // Update the single repair order cache with fresh data from the update response
      qc.setQueryData(['repair-orders', updated.id], updated);
      
      // Invalidate list queries so they refetch in the background
      // This ensures the updated order appears with correct status in lists
      qc.invalidateQueries({ queryKey: ['repair-orders', 'enriched'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'active-repair-orders'] });
    },
  });
};
