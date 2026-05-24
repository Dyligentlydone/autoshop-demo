'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { LineItem, EstimateSummary } from '@/types';

type LineItemInput = {
  repair_order_id: string;
  description: string;
  quantity: number;
  parts_cost: number;
  parts_price: number;
  labor_hours: number;
  labor_rate: number;
  labor_cost: number;
  labor_price: number;
  part_number?: string;
  supplier?: string;
  source?: 'manual' | 'aftermarket' | 'oem';
  condition?: 'new' | 'used' | 'remanufactured';
  category?: string;
  notes?: string;
  taxable?: boolean;
};

export const useLineItems = (repairOrderId: string) => {
  return useQuery<{ data: EstimateSummary }>({
    queryKey: ['line-items', repairOrderId],
    queryFn: async () => {
      return await apiClient.get<{ data: EstimateSummary }>(
        `/api/line-items?repair_order_id=${repairOrderId}`
      );
    },
    enabled: !!repairOrderId,
  });
};

export const useCreateLineItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LineItemInput) => {
      return await apiClient.post<{ data: LineItem }>('/api/line-items', data);
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['line-items', variables.repair_order_id] });
      
      // Sync to Zoho (silent failure)
      try {
        await apiClient.post('/api/line-items/sync-to-zoho', {
          repair_order_id: variables.repair_order_id,
        });
      } catch (error) {
        // Silent failure
        console.error('Zoho sync failed:', error);
      }
    },
  });
};

export const useUpdateLineItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, repairOrderId, ...data }: Partial<LineItem> & { id: string; repairOrderId: string }) => {
      return await apiClient.patch<{ data: LineItem }>(`/api/line-items/${id}`, data);
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['line-items', variables.repairOrderId] });
      
      // Sync to Zoho (silent failure)
      try {
        await apiClient.post('/api/line-items/sync-to-zoho', {
          repair_order_id: variables.repairOrderId,
        });
      } catch (error) {
        // Silent failure
        console.error('Zoho sync failed:', error);
      }
    },
  });
};

export const useDeleteLineItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, repairOrderId }: { id: string; repairOrderId: string }) => {
      return await apiClient.delete(`/api/line-items/${id}`);
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['line-items', variables.repairOrderId] });
      
      // Sync to Zoho (silent failure)
      try {
        await apiClient.post('/api/line-items/sync-to-zoho', {
          repair_order_id: variables.repairOrderId,
        });
      } catch (error) {
        // Silent failure
        console.error('Zoho sync failed:', error);
      }
    },
  });
};
