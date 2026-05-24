'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSendSMS } from '@/hooks/use-send-sms';
import { formatEstimateMessage } from '@/lib/sms-utils';

type SendEstimateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  repairOrder: {
    id: string;
    service_type: string;
    estimated_total?: number;
    estimated_completion?: string;
  };
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
  photoUrls?: string[];
};

export default function SendEstimateModal({
  isOpen,
  onClose,
  repairOrder,
  customer,
  photoUrls = [],
}: SendEstimateModalProps) {
  const sendSMS = useSendSMS();
  const [phoneNumber, setPhoneNumber] = useState(customer.phone || '');
  const [messageBody, setMessageBody] = useState('');
  const [includePhotos, setIncludePhotos] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const customerName = `${customer.first_name} ${customer.last_name}`.trim();

  // Generate preview message
  useEffect(() => {
    if (!isEditing) {
      const preview = formatEstimateMessage({
        customerName,
        serviceType: repairOrder.service_type || 'service',
        estimatedTotal: repairOrder.estimated_total,
        estimatedCompletion: repairOrder.estimated_completion,
        photoUrls: includePhotos ? photoUrls : [],
      });
      setMessageBody(preview);
    }
  }, [customerName, repairOrder, photoUrls, includePhotos, isEditing]);

  const handleSend = async () => {
    if (!phoneNumber.trim()) {
      alert('Phone number is required');
      return;
    }

    try {
      await sendSMS.mutateAsync({
        type: 'estimate',
        to: phoneNumber,
        // Only send message body if user edited it; otherwise API generates from template
        message: isEditing ? messageBody : undefined,
        repairOrderId: repairOrder.id,
        customerId: customer.id,
        estimateData: {
          customerName,
          serviceType: repairOrder.service_type || 'service',
          estimatedTotal: repairOrder.estimated_total,
          estimatedCompletion: repairOrder.estimated_completion,
          photoUrls: includePhotos ? photoUrls : [],
        },
      });

      alert('Estimate sent successfully!');
      onClose();
    } catch (err: any) {
      console.error('Failed to send estimate:', err);
      alert(`Failed to send estimate: ${err?.message || 'Unknown error'}`);
    }
  };

  if (!isOpen) return null;

  // Portal renders at document.body so it's always viewport-centered
  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-white/10 bg-black/95 p-6 backdrop-blur mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold" style={{ color: '#d7b73f' }}>
            Send Estimate to Customer
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Customer Info */}
        <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-sm font-medium text-slate-300">Customer</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: '#d7b73f' }}>
            {customerName}
          </div>
        </div>

        {/* Phone Number */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-slate-300">
            Phone Number
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
            placeholder="Enter phone number"
          />
        </div>

        {/* Photos Section */}
        {photoUrls.length > 0 && (
          <div className="mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includePhotos}
                onChange={(e) => {
                  setIncludePhotos(e.target.checked);
                  setIsEditing(false);
                }}
                className="h-4 w-4 rounded border-[#D4AF37]/25 bg-[#D4AF37]/8 text-[#D4AF37] focus:ring-[#D4AF37]/40"
              />
              <span className="text-sm text-slate-300">
                Include {photoUrls.length} photo{photoUrls.length !== 1 ? 's' : ''} (MMS)
              </span>
            </label>
            {includePhotos && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {photoUrls.map((url, i) => (
                  <div
                    key={i}
                    className="relative overflow-hidden rounded-lg border border-white/10 bg-black/30"
                  >
                    <div className="aspect-square">
                      <img
                        src={url}
                        alt={`Attachment ${i + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message Preview/Edit */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">Message Preview</label>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs font-medium hover:opacity-80"
              style={{ color: '#d7b73f' }}
            >
              {isEditing ? 'Reset to Template' : 'Edit Message'}
            </button>
          </div>
          <textarea
            value={messageBody}
            onChange={(e) => {
              setMessageBody(e.target.value);
              setIsEditing(true);
            }}
            rows={12}
            className="w-full rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
            placeholder="Message will appear here..."
          />
          <div className="mt-1 text-xs text-slate-400">
            {messageBody.length} characters
          </div>
        </div>

        {/* Estimate Details Summary */}
        <div className="mb-6 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs font-medium text-slate-300">Estimate Details</div>
          <div className="mt-2 space-y-1 text-sm text-slate-200">
            <div>
              <span className="text-slate-400">Service:</span> {repairOrder.service_type || 'N/A'}
            </div>
            {repairOrder.estimated_total !== undefined && repairOrder.estimated_total !== null && (
              <div>
                <span className="text-slate-400">Total:</span> ${repairOrder.estimated_total.toFixed(2)}
              </div>
            )}
            {repairOrder.estimated_completion && (
              <div>
                <span className="text-slate-400">Completion:</span>{' '}
                {new Date(repairOrder.estimated_completion).toLocaleDateString()}
              </div>
            )}
            {includePhotos && photoUrls.length > 0 && (
              <div>
                <span className="text-slate-400">Photos:</span> {photoUrls.length} attached
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10"
            disabled={sendSMS.isPending}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            type="button"
            className="rounded-full px-6 py-2 text-sm font-semibold text-black disabled:opacity-50"
            style={{ backgroundColor: '#d7b73f' }}
            disabled={sendSMS.isPending || !phoneNumber.trim()}
          >
            {sendSMS.isPending ? 'Sending...' : 'Send Estimate'}
          </button>
        </div>

        {sendSMS.isError && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            Failed to send SMS. Please check your Twilio configuration.
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
