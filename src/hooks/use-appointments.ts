'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type Appointment = {
  id: string;
  repair_order_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  vehicle_display: string | null;
  service_type: string | null;
  scheduled_datetime: string;
  duration_minutes: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  zoho_status: string | null;
  appointment_type: 'estimated_completion' | 'scheduled_drop_off';
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type AppointmentsResponse = {
  data: Appointment[];
};

type UseAppointmentsOptions = {
  startDate?: string;
  endDate?: string;
};

export const useAppointments = (options?: UseAppointmentsOptions) => {
  const params = new URLSearchParams();
  if (options?.startDate) params.set('start', options.startDate);
  if (options?.endDate) params.set('end', options.endDate);

  return useQuery<AppointmentsResponse>({
    queryKey: ['appointments', options?.startDate, options?.endDate],
    queryFn: async () => {
      const url = `/api/appointments${params.toString() ? `?${params.toString()}` : ''}`;
      return await apiClient.get<AppointmentsResponse>(url);
    },
    staleTime: 10_000, // 10 seconds
    refetchInterval: 30_000, // Auto-refresh every 30 seconds
  });
};

export const useCreateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Appointment>) => {
      return await apiClient.post<{ data: Appointment }>('/api/appointments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
};

export const useUpdateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Appointment> & { id: string }) => {
      return await apiClient.patch<{ data: Appointment }>(`/api/appointments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
};

export const useDeleteAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.delete(`/api/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
};
