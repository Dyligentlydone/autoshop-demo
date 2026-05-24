import { useQuery } from '@tanstack/react-query';

export const useRepairOrderAttachments = (repairOrderId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['repair-order-attachments', repairOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/repair-orders/${repairOrderId}/attachments`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch attachments');
      }
      return res.json();
    },
    enabled: !!repairOrderId && enabled, // Only fetch when explicitly enabled
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });
};
