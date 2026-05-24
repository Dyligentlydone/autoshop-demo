'use client';

import { useState } from 'react';
import { useSMSConversations } from '@/hooks/use-sms-conversations';
import Link from 'next/link';

export default function CommunicationsPage() {
  const conversations = useSMSConversations();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const convData = (conversations.data as any)?.data as any[] | undefined;

  const selectedConversation = convData?.find(
    (c: any) => c.customer?.id === selectedCustomerId
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: '#d7b73f' }}>
          Communications
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Conversations List */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-white/10 bg-black/40 backdrop-blur">
            <div className="border-b border-white/10 p-4">
              <h2 className="text-sm font-semibold text-slate-300">Conversations</h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {conversations.isLoading ? (
                <div className="p-4 text-sm text-slate-400">Loading conversations...</div>
              ) : conversations.isError ? (
                <div className="p-4 text-sm text-red-400">Failed to load conversations</div>
              ) : !convData?.length ? (
                <div className="p-4 text-sm text-slate-400">No conversations yet</div>
              ) : (
                <div className="divide-y divide-white/10">
                  {convData?.map((conv: any) => {
                    const customer = conv.customer;
                    const lastMsg = conv.lastMessage;
                    const isSelected = customer?.id === selectedCustomerId;

                    return (
                      <button
                        key={customer?.id}
                        onClick={() => setSelectedCustomerId(customer?.id)}
                        className={`w-full p-4 text-left transition-colors ${
                          isSelected ? 'bg-[#d7b73f]/15' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-200">
                              {customer?.first_name} {customer?.last_name}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {customer?.phone}
                            </div>
                            {lastMsg && (
                              <div className="mt-2 truncate text-sm text-slate-300">
                                {lastMsg.message_body?.substring(0, 60)}
                                {lastMsg.message_body?.length > 60 ? '...' : ''}
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
          {!selectedCustomerId ? (
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
                      {selectedConversation?.customer?.first_name}{' '}
                      {selectedConversation?.customer?.last_name}
                    </h2>
                    <div className="mt-1 text-xs text-slate-400">
                      {selectedConversation?.customer?.phone}
                    </div>
                  </div>
                  <Link
                    href={`/customers/${selectedCustomerId}`}
                    className="text-xs font-medium hover:opacity-80"
                    style={{ color: '#d7b73f' }}
                  >
                    View Customer →
                  </Link>
                </div>
              </div>

              {/* Messages */}
              <div className="max-h-[450px] space-y-4 overflow-y-auto p-4">
                {selectedConversation?.messages?.map((msg: any) => {
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
                        <div className="whitespace-pre-wrap text-sm">{msg.message_body}</div>
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
              </div>

              {/* Quick Actions */}
              <div className="border-t border-white/10 p-4">
                <div className="text-xs text-slate-400">
                  Quick actions coming soon: Send message, View repair orders
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
