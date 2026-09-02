'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGlobalSearch } from '@/hooks/use-global-search';
import { Loader2, Phone, SearchIcon, UserRound, X } from 'lucide-react';

type NewConversationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (conversation: {
    phone: string;
    displayName?: string;
    customerId?: string;
  }) => void;
};

type CustomerHit = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return `${digits.slice(0, 1)}-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
};

export function NewConversationModal({ isOpen, onClose, onSelect }: NewConversationModalProps) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setManualPhone('');
      setManualName('');
    }
  }, [isOpen]);

  const search = useGlobalSearch(query, { limit: 8 });

  const customers = useMemo(() => {
    const data = search.data;
    return (data?.customers || []) as CustomerHit[];
  }, [search.data]);

  const handleSelectCustomer = (customer: CustomerHit) => {
    if (!customer.phone) {
      alert('This customer does not have a phone number on file.');
      return;
    }

    onSelect({
      phone: customer.phone,
      displayName: customer.name,
      customerId: customer.id,
    });
    onClose();
  };

  const handleManualSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const phone = manualPhone.trim();
    if (!phone) {
      alert('Please enter a phone number.');
      return;
    }

    onSelect({
      phone,
      displayName: manualName.trim() || undefined,
    });
    onClose();
  };

  if (!isOpen || !mounted) {
    return null;
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-black/90 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-wide text-slate-100">
            Start a New Conversation
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Search Customers
          </label>
          <div className="relative"
          >
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, phone, vehicle, or repair order"
              className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-[#d7b73f]/40 focus:ring-2 focus:ring-[#d7b73f]/20"
              type="text"
            />
          </div>
        </div>

        <div className="mb-8 space-y-2">
          {query.length === 0 ? (
            <p className="text-sm text-slate-400">
              Start typing to search your customer list.
            </p>
          ) : search.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : customers.length === 0 ? (
            <p className="text-sm text-slate-400">
              No customers match "{query}". Try a different name or phone number.
            </p>
          ) : (
            <div className="space-y-2">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  type="button"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-[#d7b73f]/50 hover:bg-[#d7b73f]/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d7b73f]/15 text-[#d7b73f]">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-100">{customer.name}</div>
                      <div className="text-xs text-slate-400">{customer.phone || customer.email || 'No contact details'}</div>
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#d7b73f]">Select</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Phone className="h-4 w-4 text-[#d7b73f]" /> Send to a new number
          </h3>
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                Phone Number
              </label>
              <input
                value={manualPhone}
                onChange={(event) => setManualPhone(formatPhone(event.target.value))}
                placeholder="e.g. 616-555-1234"
                className="w-full rounded-full border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-[#d7b73f]/40 focus:ring-2 focus:ring-[#d7b73f]/20"
                type="tel"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                Name (optional)
              </label>
              <input
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                placeholder="Who are you messaging?"
                className="w-full rounded-full border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-[#d7b73f]/40 focus:ring-2 focus:ring-[#d7b73f]/20"
                type="text"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-[#d7b73f] py-2.5 text-sm font-semibold text-black shadow transition hover:bg-[#c9a534]"
            >
              Start Conversation
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
