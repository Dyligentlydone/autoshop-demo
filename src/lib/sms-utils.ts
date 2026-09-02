// SMS utility functions that can be used on both client and server

export type EstimateData = {
  customerName: string;
  serviceType: string;
  estimatedTotal?: number;
  estimatedCompletion?: string;
  photoUrls?: string[];
  videoUrls?: string[];
  approvalUrl?: string;
};

export const formatEstimateMessage = ({
  customerName,
  serviceType,
  estimatedTotal,
  estimatedCompletion,
  photoUrls,
  videoUrls,
}: EstimateData) => {
  const parts = [
    `Hi ${customerName}!`,
    ``,
    `Your ${serviceType} estimate is ready:`,
  ];

  if (estimatedTotal !== undefined && estimatedTotal !== null) {
    parts.push(`💰 Estimated Total: $${estimatedTotal.toFixed(2)}`);
  }

  if (estimatedCompletion) {
    const date = new Date(estimatedCompletion);
    const formatted = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    parts.push(`📅 Est. Completion: ${formatted}`);
  }

  if (photoUrls && photoUrls.length > 0) {
    parts.push(``, `📸 ${photoUrls.length} photo${photoUrls.length === 1 ? '' : 's'} on approval link`);
  }

  if (videoUrls && videoUrls.length > 0) {
    parts.push(
      // Only blank line before video count if no photos already added a blank
      ...(photoUrls && photoUrls.length > 0 ? [] : ['']),
      `🎥 ${videoUrls.length} video${videoUrls.length === 1 ? '' : 's'} on approval link`
    );
  }

  return parts.join('\n');
};
