'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// Fetch all estimates
export const useEstimates = (status?: string) => {
  return useQuery({
    queryKey: ['estimates', status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      return apiClient.get(`/api/estimates${params}`);
    },
  });
};

// Fetch single estimate with items
export const useEstimate = (id: string) => {
  return useQuery({
    queryKey: ['estimates', id],
    queryFn: async () => apiClient.get(`/api/estimates/${id}`),
    enabled: !!id,
  });
};

// Create estimate
export const useCreateEstimate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { customer_id?: string; vehicle_id?: string; notes?: string }) => {
      return apiClient.post('/api/estimates', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimates'] });
    },
  });
};

// Update estimate
export const useUpdateEstimate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      return apiClient.patch(`/api/estimates/${id}`, data);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['estimates', vars.id] });
      qc.invalidateQueries({ queryKey: ['estimates'] });
    },
  });
};

// Delete estimate
export const useDeleteEstimate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/api/estimates/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimates'] });
    },
  });
};

// Add item to estimate
export const useAddEstimateItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ estimateId, ...data }: { estimateId: string; [key: string]: any }) => {
      return apiClient.post(`/api/estimates/${estimateId}/items`, data);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['estimates', vars.estimateId] });
    },
  });
};

// Update estimate item
export const useUpdateEstimateItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      estimateId,
      itemId,
      ...data
    }: {
      estimateId: string;
      itemId: string;
      [key: string]: any;
    }) => {
      return apiClient.patch(`/api/estimates/${estimateId}/items/${itemId}`, data);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['estimates', vars.estimateId] });
    },
  });
};

// Delete estimate item
export const useDeleteEstimateItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ estimateId, itemId }: { estimateId: string; itemId: string }) => {
      return apiClient.delete(`/api/estimates/${estimateId}/items/${itemId}`);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['estimates', vars.estimateId] });
    },
  });
};

// Complete estimate (link to RO)
export const useCompleteEstimate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      estimateId,
      ...data
    }: {
      estimateId: string;
      repair_order_id?: string;
      create_repair_order?: {
        customer_id: string;
        vehicle_id: string;
        service_type?: string;
        job_description?: string;
      };
      order_parts?: boolean;
    }) => {
      return apiClient.post(`/api/estimates/${estimateId}/complete`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimates'] });
      qc.invalidateQueries({ queryKey: ['repair-orders'] });
    },
  });
};
