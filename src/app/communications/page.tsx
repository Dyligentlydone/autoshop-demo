'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSMSConversations } from '@/hooks/use-sms-conversations';
import { useVoicemails, useMarkVoicemailRead, useVoicemailUnreadCount } from '@/hooks/use-voicemails';
import { VoicemailCard } from '@/components/VoicemailCard';
import Link from 'next/link';
import { MessageSquare, PenSquare, Search as SearchIcon, Voicemail } from 'lucide-react';
import { NewConversationModal } from '@/components/NewConversationModal';

const convKey = (c: any): string =>
  c?.customer?.id || `phone:${c?.phoneNumber || 'unknown'}`;

export default function CommunicationsPage() {
  const [activeTab, setActiveTab] = useState<'sms' | 'voicemails'>('sms');
  const conversations = useSMSConversations();
  const voicemails = useVoicemails();
  const markVoicemailRead = useMarkVoicemailRead();
  const voicemailUnread = useVoicemailUnreadCount();
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewConversationModalOpen, setIsNewConversationModalOpen] = useState(false);
  const [newConversation, setNewConversation] = useState<
    | {
        phone: string;
        displayName?: string;
        customerId?: string;
      }
    | null
  >(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const convData = (conversations.data as any)?.data as any[] | undefined;

  const selectedConversation = convData?.find((c: any) => convKey(c) === selectedKey);
  const selectedCustomerId =
    selectedConversation?.customer?.id || newConversation?.customerId || null;

  const searchValue = searchTerm.trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    if (!convData || !convData.length) return convData || [];
    if (!searchValue) return convData;

    const matches = (value: string | null | undefined) =>
      (value || '').toLowerCase().includes(searchValue);

    return convData.filter((conv: any) => {
      const customer = conv.customer;
      const displayName = customer
        ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
        : '';
      const displayPhone = customer?.phone || conv.phoneNumber || '';
      const lastBody = conv.lastMessage?.message_body || '';
      return [displayName, displayPhone, lastBody].some(matches);
    });
  }, [convData, searchValue]);

  const newConversationMatchesSearch = useMemo(() => {
    if (!newConversation) return false;
    if (!searchValue) return true;
    const fields = [newConversation.displayName || '', newConversation.phone];
    return fields.some((value) => (value || '').toLowerCase().includes(searchValue));
  }, [newConversation, searchValue]);

  useEffect(() => {
    if (!newConversation || !convData?.length) return;
    const targetDigits = newConversation.phone.replace(/\D/g, '');

    const matched = convData.find((conv: any) => {
      if (newConversation.customerId && conv.customer?.id === newConversation.customerId) {
        return true;
      }
      const convPhone = (conv.customer?.phone || conv.phoneNumber || '').replace(/\D/g, '');
      if (!convPhone || !targetDigits) return false;
      return convPhone.endsWith(targetDigits) || convPhone.includes(targetDigits);
    });

    if (matched) {
      setSelectedKey(convKey(matched));
      setNewConversation(null);
    }
  }, [convData, newConversation]);

  // Messages come back newest-first from the API — reverse for chat order
  const orderedMessages = (selectedConversation?.messages || [])
    .slice()
    .sort(
      (a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  // Auto-scroll to bottom whenever conversation or messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [selectedKey, orderedMessages.length]);

  const recipientPhone =
    selectedConversation?.customer?.phone ||
    selectedConversation?.phoneNumber ||
    newConversation?.phone ||
    '';

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || !recipientPhone || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientPhone,
          message,
          customerId: selectedCustomerId || undefined,
          type: 'reply',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSendError(json?.error || json?.details || 'Failed to send message');
        return;
      }
      setDraft('');
      setSendError(null);
      // Refresh conversation list
      await queryClient.invalidateQueries({ queryKey: ['sms-conversations'] });
    } catch (err: any) {
      setSendError(err?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectConversation = async (key: string, conv: any) => {
    setSelectedKey(key);
    if (conv.unreadCount > 0) {
      try {
        await fetch('/api/sms/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: conv.customer?.id || null,
            phoneNumber: conv.phoneNumber || null,
          }),
        });
        // Refresh both conversation list and sidebar unread badge
        await queryClient.invalidateQueries({ queryKey: ['sms-conversations'] });
      } catch {
        // silently ignore — badge will clear on next poll anyway
      }
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    if (!confirm('Are you sure you want to delete this conversation? This cannot be undone.')) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/sms/conversations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedConversation.customer?.id || undefined,
          phoneNumber: selectedConversation.phoneNumber || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        alert(json?.error || 'Failed to delete conversation');
        return;
      }

      setSelectedKey(null);
      await queryClient.invalidateQueries({ queryKey: ['sms-conversations'] });
    } catch (err: any) {
      alert(err?.message || 'Failed to delete conversation');
    } finally {
      setDeleting(false);
    }
  };

  const isNewConversation = selectedKey === 'new' && !!newConversation;
  const activeDisplayName = isNewConversation
    ? newConversation?.displayName || newConversation?.phone || 'New conversation'
    : selectedConversation?.customer
    ? `${selectedConversation.customer.first_name || ''} ${
        selectedConversation.customer.last_name || ''
      }`.trim() || 'Customer'
    : 'Unknown sender';
  const activePhone =
    (isNewConversation ? newConversation?.phone : null) ||
    selectedConversation?.customer?.phone ||
    selectedConversation?.phoneNumber ||
    '';
  const activeCustomerId = selectedCustomerId || newConversation?.customerId || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: '#d7b73f' }}>
          Communications
        </h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('sms')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === 'sms'
              ? 'bg-[#d7b73f]/20 text-[#d7b73f] ring-1 ring-[#d7b73f]/40'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          SMS
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('voicemails')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === 'voicemails'
              ? 'bg-[#d7b73f]/20 text-[#d7b73f] ring-1 ring-[#d7b73f]/40'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Voicemail className="h-4 w-4" />
          Voicemails
          {voicemailUnread > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {voicemailUnread > 9 ? '9+' : voicemailUnread}
            </span>
          )}
        </button>
      </div>

      {/* Voicemails tab */}
      {activeTab === 'voicemails' && (
        <div className="space-y-3">
          {voicemails.isLoading ? (
            <div className="p-4 text-sm text-slate-400">Loading voicemails…</div>
          ) : voicemails.isError ? (
            <div className="p-4 text-sm text-red-400">Failed to load voicemails</div>
          ) : !voicemails.data?.length ? (
            <div className="rounded-xl border border-white/10 bg-black/40 p-8 text-center">
              <Voicemail className="mx-auto h-8 w-8 text-slate-500 mb-3" />
              <div className="text-sm text-slate-400">No voicemails yet</div>
              <div className="mt-1 text-xs text-slate-500">Voicemails will appear here when customers call.</div>
            </div>
          ) : (
            (voicemails.data || []).map((vm) => (
              <VoicemailCard
                key={vm.id}
                voicemail={vm}
                onMarkRead={markVoicemailRead}
              />
            ))
          )}
        </div>
      )}

      {/* SMS tab */}
      {activeTab === 'sms' && <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Conversations List */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-white/10 bg-black/40 backdrop-blur">
            <div className="space-y-4 border-b border-white/10 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300">Conversations</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 shadow-inner">
                    <SearchIcon className="h-4 w-4 flex-shrink-0 text-slate-300" />
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search"
                      className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-400 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewConversationModalOpen(true);
                    setSelectedKey('new');
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-slate-200 shadow transition hover:border-[#d7b73f]/60 hover:bg-[#d7b73f]/20 hover:text-[#d7b73f]"
                >
                  <PenSquare className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {conversations.isLoading ? (
                <div className="p-4 text-sm text-slate-400">Loading conversations...</div>
              ) : conversations.isError ? (
                <div className="p-4 text-sm text-red-400">Failed to load conversations</div>
              ) : !convData?.length && !newConversation ? (
                <div className="p-4 text-sm text-slate-400">No conversations yet</div>
              ) : filteredConversations?.length === 0 && !newConversationMatchesSearch ? (
                <div className="p-4 text-sm text-slate-400">
                  No conversations match “{searchTerm.trim()}”.
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {newConversation && newConversationMatchesSearch && (
                    <button
                      onClick={() => setSelectedKey('new')}
                      className={`w-full p-4 text-left transition-colors ${
                        selectedKey === 'new' ? 'bg-[#d7b73f]/15' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-200">
                            {newConversation.displayName || 'New conversation'}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">{newConversation.phone}</div>
                          <div className="mt-2 text-xs text-[#d7b73f]">Draft</div>
                        </div>
                      </div>
                    </button>
                  )}
                  {convData?.map((conv: any) => {
                    if (!filteredConversations?.includes(conv)) return null;
                    const customer = conv.customer;
                    const lastMsg = conv.lastMessage;
                    const key = convKey(conv);
                    const isSelected = key === selectedKey;
                    const displayName = customer
                      ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
                        'Customer'
                      : 'Unknown sender';
                    const displayPhone = customer?.phone || conv.phoneNumber || '';

                    return (
                      <button
                        key={key}
                        onClick={() => handleSelectConversation(key, conv)}
                        className={`w-full p-4 text-left transition-colors ${
                          isSelected ? 'bg-[#d7b73f]/15' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-200">
                              {displayName}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {displayPhone}
                            </div>
                            {lastMsg && (
                              <div className="mt-2 truncate text-sm text-slate-300">
                                {lastMsg.message_body
                                  ? `${lastMsg.message_body.substring(0, 60)}${lastMsg.message_body.length > 60 ? '...' : ''}`
                                  : lastMsg.metadata?.mediaUrls?.length
                                  ? '📷 Photo'
                                  : ''}
                              </div>
                            )}
                          </div>
                          {conv.unreadCount > 0 && (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d7b73f] text-xs font-semibold text-black">
                              {conv.unreadCount}
                            </div>
                          )}
                        </div>
                        {lastMsg && (
                          <div className="mt-2 text-xs text-slate-500">
                            {new Date(lastMsg.created_at).toLocaleDateString()} at{' '}
                            {new Date(lastMsg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Conversation Detail */}
        <div className="lg:col-span-2">
          {!selectedKey ? (
            <div className="flex h-[600px] items-center justify-center rounded-lg border border-white/10 bg-black/40 backdrop-blur">
              <div className="text-center">
                <div className="text-4xl" style={{ color: '#d7b73f' }}>
                  💬
                </div>
                <div className="mt-4 text-sm text-slate-300">
                  Select a conversation to view messages
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-black/40 backdrop-blur">
              {/* Header */}
              <div className="border-b border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold" style={{ color: '#d7b73f' }}>
                      {activeDisplayName}
                    </h2>
                    <div className="mt-1 text-xs text-slate-400">{activePhone}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeCustomerId && (
                      <Link
                        href={`/customers/${activeCustomerId}`}
                        className="text-xs font-medium hover:opacity-80"
                        style={{ color: '#d7b73f' }}
                      >
                        View Customer →
                      </Link>
                    )}
                    {!isNewConversation && (
                      <button
                        type="button"
                        onClick={handleDeleteConversation}
                        disabled={deleting}
                        className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {deleting ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages (oldest top, newest bottom — iMessage style) */}
              <div className="max-h-[450px] space-y-4 overflow-y-auto p-4">
                {orderedMessages.map((msg: any) => {
                  const isOutbound = msg.direction === 'outbound';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          isOutbound
                            ? 'bg-[#d7b73f]/20 text-slate-100'
                            : 'bg-white/10 text-slate-200'
                        }`}
                      >
                        {(() => {
                          const hasMedia = Array.isArray(msg.metadata?.mediaUrls) && msg.metadata.mediaUrls.length > 0;
                          const isTwilioPlaceholder = hasMedia && msg.message_body?.trim().toLowerCase() === 'mms attachment';
                          return msg.message_body && !isTwilioPlaceholder ? (
                            <div className="whitespace-pre-wrap text-sm">{msg.message_body}</div>
                          ) : null;
                        })()}
                        {Array.isArray(msg.metadata?.mediaUrls) && msg.metadata.mediaUrls.length > 0 && (
                          <div className={`space-y-2 ${msg.message_body && msg.message_body.trim().toLowerCase() !== 'mms attachment' ? 'mt-2' : ''}`}>
                            {msg.metadata.mediaUrls.map((mediaUrl: string, i: number) => {
                              const proxyUrl = `/api/sms/media?url=${encodeURIComponent(mediaUrl)}`;
                              const contentType: string = msg.metadata?.mediaTypes?.[i] || 'image/jpeg';
                              if (contentType.startsWith('video/')) {
                                return (
                                  <video
                                    key={i}
                                    src={proxyUrl}
                                    controls
                                    className="max-w-full rounded-lg"
                                    style={{ maxHeight: '300px' }}
                                  />
                                );
                              }
                              return (
                                <img
                                  key={i}
                                  src={proxyUrl}
                                  alt="MMS attachment"
                                  className="max-w-full rounded-lg"
                                  style={{ maxHeight: '300px', objectFit: 'contain' }}
                                />
                              );
                            })}
                          </div>
                        )}
                        <div className="mt-2 text-xs text-slate-400">
                          {new Date(msg.created_at).toLocaleDateString()} at{' '}
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {msg.message_type && (
                            <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5">
                              {msg.message_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isNewConversation && orderedMessages.length === 0 && (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/30 py-16 text-center text-sm text-slate-400">
                    This is a fresh conversation. Send your first message to create the thread.
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply composer */}
              <div className="border-t border-white/10 p-3">
                {sendError && (
                  <div className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {sendError}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      recipientPhone
                        ? `Reply to ${recipientPhone}… (Enter to send, Shift+Enter for newline)`
                        : 'No phone number on this conversation'
                    }
                    disabled={!recipientPhone || sending}
                    rows={2}
                    className="min-h-[44px] flex-1 resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#d7b73f]/40 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!draft.trim() || !recipientPhone || sending}
                    className="rounded-full bg-[#d7b73f] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#c9a534] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      }

      <NewConversationModal
        isOpen={isNewConversationModalOpen}
        onClose={() => setIsNewConversationModalOpen(false)}
        onSelect={({ phone, displayName, customerId }) => {
          setNewConversation({ phone, displayName, customerId });
          setDraft('');
          setSendError(null);
          setIsNewConversationModalOpen(false);
          setSelectedKey('new');
        }}
      />
    </div>
  );
}
