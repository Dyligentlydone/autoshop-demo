'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export const useDeleteVehicle = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/api/crm/vehicles/${encodeURIComponent(id)}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      qc.invalidateQueries({ queryKey: ['global-search'] });
    },
  });
};
