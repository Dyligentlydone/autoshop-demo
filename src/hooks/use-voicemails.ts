'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type Voicemail = {
  id: string;
  shop_id: string;
  caller_number: string;
  recording_url: string;
  recording_sid: string;
  call_sid: string;
  duration: number | null;
  status: 'new' | 'read' | 'transcribed' | 'transcription_failed';
  transcript: string | null;
  ai_summary: string | null;
  ai_customer_name: string | null;
  ai_vehicle: string | null;
  ai_issue: string | null;
  ai_urgency: 'high' | 'medium' | 'low' | null;
  matched_customer_name: string | null;
  created_at: string;
};

type VoicemailsResponse = { data: Voicemail[] };

export const useVoicemails = () => {
  return useQuery({
    queryKey: ['voicemails'],
    queryFn: async () => {
      const res = await apiClient.get<VoicemailsResponse>('/api/voicemails');
      return res.data || [];
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
};

export const useVoicemailUnreadCount = () => {
  const query = useVoicemails();
  const data = query.data || [];
  return data.filter((v) => v.status === 'new' || v.status === 'transcribed').length;
};

export const useMarkVoicemailRead = () => {
  const queryClient = useQueryClient();

  return async (id: string) => {
    await fetch('/api/voicemails', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'read' }),
    });
    await queryClient.invalidateQueries({ queryKey: ['voicemails'] });
  };
};
