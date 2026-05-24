'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextPath, setNextPath] = useState('/');
  const router = useRouter();

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const raw = sp.get('next') || '/';
    setNextPath(raw.startsWith('/') ? raw : '/');
  }, []);

  const submit = async () => {
    setError('');
    const trimmed = pin.trim();

    if (!/^\d{4}$/.test(trimmed)) {
      setError('Enter a 4-digit PIN');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin: trimmed }),
      });

      if (!res.ok) {
        setError('Incorrect PIN');
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError('Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="text-center">
          <div className="text-2xl font-semibold" style={{ color: '#d7b73f' }}>
            Unlock
          </div>
          <div className="mt-1 text-sm text-slate-300">Enter your 4-digit PIN to continue.</div>
        </div>

        <div className="mt-6">
          <div className="text-xs font-medium" style={{ color: '#d7b73f' }}>
            PIN
          </div>
          <input
            className="mt-1 w-full rounded-full border border-white/10 bg-black/30 px-4 py-3 text-lg tracking-[0.4em] text-slate-100 outline-none focus:border-[#d7b73f]/60"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder="••••"
          />

          {error ? <div className="mt-3 text-sm text-red-200">{error}</div> : null}

          <button
            type="button"
            className="mt-5 w-full rounded-full bg-[#d7b73f] px-6 py-3 text-sm font-semibold text-black hover:bg-[#d7b73f]/90 disabled:opacity-50"
            disabled={isSubmitting}
            onClick={submit}
          >
            {isSubmitting ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}
