'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Customer } from '@/types';

type Response = {
  data: Customer;
};

type Input = {
  phone: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

export const useCreateCustomer = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: Input) => {
      const res = await apiClient.post<Response>('/api/crm/customers', input);
      return res.data;
    },
    onSuccess: (customer) => {
      qc.setQueryData(['customers', 'by-phone', customer.phone], customer);
    },
  });
};
