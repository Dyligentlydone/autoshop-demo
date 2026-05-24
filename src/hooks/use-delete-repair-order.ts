import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

export function useDeleteRepairOrder() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/repair-orders/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete repair order');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'active-repair-orders'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      router.push('/repair-orders');
    },
  });
}
