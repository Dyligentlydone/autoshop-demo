import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useDeleteAttachment = (repairOrderId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await fetch(
        `/api/crm/repair-orders/${repairOrderId}/attachments/${attachmentId}`,
        {
          method: 'DELETE',
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete attachment');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-order-attachments', repairOrderId] });
    },
  });
};
