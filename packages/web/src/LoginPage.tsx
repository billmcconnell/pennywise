import React, { useState } from 'react';
import { sendMagicLink } from './api';

const TILES = [
  { w: 120, h: 120, bg: '#0B3F3A', top: '8%',  left: '6%',   rotate: 12  },
  { w: 80,  h: 80,  bg: '#22C55E', top: '15%', left: '18%',  rotate: -8  },
  { w: 60,  h: 60,  bg: '#94A3B8', top: '60%', right: '8%',  rotate: 20  },
  { w: 100, h: 100, bg: '#22C55E', bottom: '10%', right: '20%', rotate: -15 },
  { w: 50,  h: 50,  bg: '#CBD5E1', bottom: '25%', left: '10%', rotate: 5  },
] as const;

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
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: '#0a1a19' }}
    >
      {/* Background: blobs + floating tiles */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div style={{
          position: 'absolute', width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,197,94,.18) 0%, transparent 65%)',
          top: -200, right: -100,
        }} />
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(11,63,58,.5) 0%, transparent 70%)',
          bottom: -100, left: -80,
        }} />
        {TILES.map((t, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: t.w, height: t.h,
            borderRadius: 8,
            background: t.bg,
            opacity: 0.06,
            top: 'top' in t ? t.top : undefined,
            right: 'right' in t ? t.right : undefined,
            bottom: 'bottom' in t ? t.bottom : undefined,
            left: 'left' in t ? t.left : undefined,
            transform: `rotate(${t.rotate}deg)`,
          }} />
        ))}
      </div>

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl px-9 py-10"
        style={{
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.1)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-5">
          <svg width="72" height="72" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="0"  y="0"  width="13" height="13" rx="3" fill="rgba(255,255,255,0.9)" />
            <rect x="15" y="0"  width="13" height="13" rx="3" fill="rgba(255,255,255,0.45)" />
            <rect x="0"  y="15" width="13" height="13" rx="3" fill="rgba(255,255,255,0.25)" />
            <rect x="15" y="15" width="13" height="13" rx="3" fill="#22C55E" />
          </svg>
          <span
            className="font-bold text-white"
            style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', letterSpacing: '-0.4px', lineHeight: 1 }}
          >
            Pennywise
          </span>
        </div>

        {state === 'sent' ? (
          <>
            <h2
              className="mb-1 text-center text-lg font-semibold text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Check your email
            </h2>
            <p className="mb-6 text-center text-sm" style={{ color: 'rgba(255,255,255,.5)' }}>
              Your sign-in link expires in 15 minutes.
            </p>
            {devUrl && (
              <div
                className="mb-4 rounded-xl p-3"
                style={{ background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.25)' }}
              >
                <p className="mb-1 text-xs font-medium" style={{ color: '#FCD34D' }}>
                  Dev mode — no SMTP configured
                </p>
                <a href={devUrl} className="break-all text-xs underline" style={{ color: '#FDE68A' }}>
                  {devUrl}
                </a>
              </div>
            )}
            <div className="flex justify-center gap-4">
              <button
                className="text-sm transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,.5)' }}
                onClick={() => send(email)}
              >
                Resend link
              </button>
              <span style={{ color: 'rgba(255,255,255,.2)' }}>·</span>
              <button
                className="text-sm transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,.4)' }}
                onClick={() => setState('idle')}
              >
                Different email
              </button>
            </div>
          </>
        ) : (
          <>
            <p
              className="mb-3 text-center font-semibold text-white"
              style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}
            >
              Your budgeting, secured.
            </p>
            <p className="mb-4 text-center text-sm font-medium text-white">
              Your finances stay private.<br />No bank connections required.
            </p>
            <p className="mb-4 text-center text-sm" style={{ color: 'rgba(255,255,255,.45)' }}>
              Enter your email to receive a secure sign-in link.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'rgba(255,255,255,.5)', letterSpacing: '.3px' }}
                >
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:ring-1 focus:ring-emerald-500"
                  style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)' }}
                />
              </div>
              {state === 'error' && (
                <p className="text-sm text-red-400">{error}</p>
              )}
              <button
                type="submit"
                disabled={state === 'loading'}
                className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-600 hover:shadow-[0_0_20px_rgba(34,197,94,.35)] disabled:opacity-50"
                style={{ letterSpacing: '.1px' }}
              >
                {state === 'loading' ? 'Sending…' : 'Send sign-in link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
