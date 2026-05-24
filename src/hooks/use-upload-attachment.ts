import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useUploadAttachment = (repairOrderId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/crm/repair-orders/${repairOrderId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to upload attachment');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-order-attachments', repairOrderId] });
    },
  });
};
