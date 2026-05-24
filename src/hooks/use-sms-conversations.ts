'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export const useSMSConversations = (customerId?: string) => {
  return useQuery({
    queryKey: ['sms-conversations', customerId],
    queryFn: async () => {
      const params = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
      return apiClient.get(`/api/sms/conversations${params}`);
    },
    staleTime: 30_000,
  });
};
