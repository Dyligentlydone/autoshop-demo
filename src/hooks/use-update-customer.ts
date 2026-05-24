'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Customer } from '@/types';
import type { CustomerDetailResponse } from './use-customer';

type Input = {
  id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  rawUpdates?: Record<string, any>;
};

export const useUpdateCustomer = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: Input) => {
      const { id, ...body } = input;
      return apiClient.patch<CustomerDetailResponse>(`/api/crm/customers/${encodeURIComponent(id)}`, body);
    },
    onSuccess: (data, vars) => {
      qc.setQueryData(['customers', 'by-id', vars.id, 'full'], data);
      qc.setQueryData(['customers', 'by-id', vars.id, 'partial'], data);
      qc.invalidateQueries({ queryKey: ['dashboard', 'active-repair-orders'] });
    },
  });
};
