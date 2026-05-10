import React, { useState } from 'react';
import { sendMagicLink } from './api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    setError('');
    try {
      const result = await sendMagicLink(email.trim());
      if (result.devUrl) setDevUrl(result.devUrl);
      setState('sent');
    } catch {
      setError('Something went wrong. Please try again.');
      setState('error');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-zinc-900">Pennywise</h1>
        <p className="mb-6 text-sm text-zinc-500">Personal finance tracker</p>

        {state === 'sent' ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-700">
              Check your email for a sign-in link. It expires in 15 minutes.
            </p>
            {devUrl && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="mb-1 text-xs font-medium text-amber-800">
                  Dev mode — no SMTP configured
                </p>
                <a
                  href={devUrl}
                  className="break-all text-xs text-amber-700 underline"
                >
                  {devUrl}
                </a>
              </div>
            )}
            <button
              className="text-sm text-zinc-400 hover:text-zinc-600"
              onClick={() => { setState('idle'); setDevUrl(null); }}
            >
              Use a different email
            </button>
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
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {state === 'error' && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={state === 'loading'}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {state === 'loading' ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
