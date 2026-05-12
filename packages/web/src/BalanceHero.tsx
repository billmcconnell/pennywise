import type { Account } from './api';

function LogoMarkDecal({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="0"  y="0"  width="13" height="13" rx="3" fill="white" />
      <rect x="15" y="0"  width="13" height="13" rx="3" fill="white" />
      <rect x="0"  y="15" width="13" height="13" rx="3" fill="white" />
      <rect x="15" y="15" width="13" height="13" rx="3" fill="#22C55E" />
    </svg>
  );
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const ASSET_TYPES = new Set(['checking', 'savings', 'investment']);

export function BalanceHero({
  accounts,
  onImport,
  onAddAccount,
}: {
  accounts: Account[];
  onImport: () => void;
  onAddAccount: () => void;
}) {
  const active = accounts.filter((a) => a.archivedAt === null);
  if (active.length === 0) return null;

  let assets = 0;
  let liabilities = 0;
  for (const a of active) {
    const bal = Number(a.currentBalance);
    if (ASSET_TYPES.has(a.type)) {
      assets += bal;
    } else {
      liabilities += Math.max(0, bal);
    }
  }
  const netWorth = assets - liabilities;

  return (
    <div className="relative overflow-hidden rounded-xl bg-teal-800 px-7 py-6 text-white">
      {/* decorative logo marks — tiled in upper-right */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 overflow-hidden" aria-hidden="true">
        {[
          { r: '8%',  t: '-20%', s: 120, o: 0.07 },
          { r: '30%', t: '30%',  s: 88,  o: 0.06 },
          { r: '-4%', t: '55%',  s: 64,  o: 0.05 },
          { r: '52%', t: '5%',   s: 72,  o: 0.05 },
        ].map(({ r, t, s, o }, i) => (
          <span key={i} className="absolute" style={{ right: r, top: t, opacity: o }}>
            <LogoMarkDecal size={s} />
          </span>
        ))}
      </div>

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        {/* Left: balance */}
        <div>
          <p className="mb-1 text-sm opacity-75">Total Balance</p>
          <p
            className="font-display text-4xl font-bold tabular-nums tracking-tight whitespace-nowrap"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {fmt(netWorth)}
          </p>
          <p className="mt-2 text-sm opacity-60">
            {fmt(assets)} assets · {fmt(liabilities)} liabilities
          </p>
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onImport}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
            Import
          </button>
          <button
            type="button"
            onClick={onAddAccount}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Account
          </button>
        </div>
      </div>
    </div>
  );
}
