'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type FailedBooking = {
  id: string;
  created_at: string;
  customer_name: string | null;
  phone: string;
  email: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  service_type: string | null;
  job_description: string | null;
  zoho_error: string | null;
};

export type FailedBookingsResponse = {
  data: FailedBooking[];
  count: number;
};

export type { FailedBooking };

export const useFailedBookings = () => {
  return useQuery<FailedBookingsResponse>({
    queryKey: ['dashboard', 'failed-bookings'],
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // Auto-refresh every 60 seconds
    queryFn: async (): Promise<FailedBookingsResponse> => {
      return await apiClient.get<FailedBookingsResponse>('/api/dashboard/crm-backup');
    },
  });
};
