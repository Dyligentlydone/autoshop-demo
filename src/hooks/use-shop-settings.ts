'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ShopSettings } from '@/types';

export const useShopSettings = () => {
  return useQuery<{ data: ShopSettings }>({
    queryKey: ['shop-settings'],
    queryFn: async () => {
      return await apiClient.get<{ data: ShopSettings }>('/api/settings');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
