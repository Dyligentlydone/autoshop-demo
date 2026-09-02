import { useMutation, useQueryClient } from '@tanstack/react-query';
import { compressImage } from '@/lib/image-compression';

const UPLOAD_TIMEOUT_MS = 120_000;

export const useUploadAttachment = (repairOrderId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      // Downscale camera photos before upload. Full-resolution iPad images
      // routinely take over a minute and get dropped mid-transfer.
      const payload = await compressImage(file);

      const formData = new FormData();
      formData.append('file', payload);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch(`/api/crm/repair-orders/${repairOrderId}/attachments`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          throw new Error('Upload timed out. Check your connection and try again.');
        }
        throw new Error('Upload failed. Check your connection and try again.');
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to upload attachment');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-order-attachments', repairOrderId] });
    },
  });
};
