'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type SendSMSParams = {
  type: 'estimate' | 'general' | 'update';
  to: string;
  message?: string;
  repairOrderId?: string;
  customerId?: string;
  estimateData?: {
    customerName: string;
    serviceType: string;
    estimatedTotal?: number;
    estimatedCompletion?: string;
    photoUrls?: string[];
  };
  mediaUrls?: string[];
};

export const useSendSMS = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendSMSParams) => {
      return apiClient.post('/api/sms/send', params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-conversations'] });
    },
  });
};
