// Server-side only Twilio integration
// DO NOT import this file in client components - use sms-utils.ts instead

import twilio from 'twilio';
import { formatEstimateMessage } from './sms-utils';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  console.warn('Twilio credentials not configured. SMS features will not work.');
}

export const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;

export type EstimateData = {
  customerName: string;
  customerPhone: string;
  serviceType: string;
  estimatedTotal?: number;
  estimatedCompletion?: string;
  photoUrls?: string[];
  repairOrderId: string;
};

// Re-export the formatter for convenience
export { formatEstimateMessage };

export const sendEstimateSMS = async (data: EstimateData) => {
  if (!twilioClient || !fromNumber) {
    throw new Error('Twilio is not configured');
  }

  const message = formatEstimateMessage(data);

  // Twilio supports up to 10 media attachments per MMS
  const mediaUrls = data.photoUrls?.slice(0, 10);

  const result = await twilioClient.messages.create({
    from: fromNumber,
    to: data.customerPhone,
    body: message,
    ...(mediaUrls && mediaUrls.length > 0 ? { mediaUrl: mediaUrls } : {}),
  });

  return {
    sid: result.sid,
    status: result.status,
    to: result.to,
    from: result.from,
    body: result.body,
    dateCreated: result.dateCreated,
  };
};

export const sendSMS = async ({
  to,
  message,
  mediaUrls,
}: {
  to: string;
  message: string;
  mediaUrls?: string[];
}) => {
  if (!twilioClient || !fromNumber) {
    throw new Error('Twilio is not configured');
  }

  const result = await twilioClient.messages.create({
    from: fromNumber,
    to,
    body: message,
    ...(mediaUrls && mediaUrls.length > 0 ? { mediaUrl: mediaUrls.slice(0, 10) } : {}),
  });

  return {
    sid: result.sid,
    status: result.status,
    to: result.to,
    from: result.from,
    body: result.body,
    dateCreated: result.dateCreated,
  };
};
