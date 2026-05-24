// SMS utility functions that can be used on both client and server

export type EstimateData = {
  customerName: string;
  serviceType: string;
  estimatedTotal?: number;
  estimatedCompletion?: string;
  photoUrls?: string[];
};

export const formatEstimateMessage = ({
  customerName,
  serviceType,
  estimatedTotal,
  estimatedCompletion,
  photoUrls,
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
    parts.push(``, `📸 ${photoUrls.length} photo(s) attached`);
  }

  parts.push(
    ``,
    `Questions? Reply to this message or call us!`,
    ``,
    `- AutoShop Demo`
  );

  return parts.join('\n');
};
