'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// Fetch all active presets
export const useEstimatePresets = () => {
  return useQuery({
    queryKey: ['estimate-presets'],
    queryFn: async () => apiClient.get('/api/estimates/presets'),
  });
};

// Fetch single preset
export const useEstimatePreset = (id: string) => {
  return useQuery({
    queryKey: ['estimate-presets', id],
    queryFn: async () => apiClient.get(`/api/estimates/presets/${id}`),
    enabled: !!id,
  });
};

// Create preset
export const useCreateEstimatePreset = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      return apiClient.post('/api/estimates/presets', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimate-presets'] });
    },
  });
};

// Update preset
export const useUpdateEstimatePreset = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      return apiClient.patch(`/api/estimates/presets/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimate-presets'] });
    },
  });
};

// Delete preset
export const useDeleteEstimatePreset = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/api/estimates/presets/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimate-presets'] });
    },
  });
};
