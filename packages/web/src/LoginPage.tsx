import React, { useState } from 'react';
import { sendMagicLink } from './api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function send(addr: string) {
    setState('loading');
    setError('');
    setDevUrl(null);
    try {
      const result = await sendMagicLink(addr.trim());
      if (result.devUrl) setDevUrl(result.devUrl);
      setState('sent');
    } catch {
      setError('Something went wrong. Please try again.');
      setState('error');
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(email);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="0"  y="0"  width="13" height="13" rx="3" fill="#0B3F3A" />
            <rect x="15" y="0"  width="13" height="13" rx="3" fill="#94A3B8" />
            <rect x="0"  y="15" width="13" height="13" rx="3" fill="#CBD5E1" />
            <rect x="15" y="15" width="13" height="13" rx="3" fill="#22C55E" />
          </svg>
          <span className="text-2xl font-bold text-zinc-900">Pennywise</span>
        </div>

        {state === 'sent' ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-700">
              Check your email for a sign-in link. It expires in 15 minutes.
            </p>
            {devUrl && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="mb-1 text-xs font-medium text-amber-800">
                  Dev mode — no SMTP configured
                </p>
                <a href={devUrl} className="break-all text-xs text-amber-700 underline">
                  {devUrl}
                </a>
              </div>
            )}
            <div className="flex gap-3">
              <button
                className="text-sm text-zinc-500 hover:text-zinc-800"
                onClick={() => send(email)}
              >
                Resend link
              </button>
              <span className="text-zinc-300">·</span>
              <button
                className="text-sm text-zinc-400 hover:text-zinc-600"
                onClick={() => setState('idle')}
              >
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>
            {state === 'error' && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={state === 'loading'}
              className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {state === 'loading' ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
