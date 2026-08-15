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

export function BalanceHero({ accounts }: { accounts: Account[] }) {
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

      <div className="relative">
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
    </div>
  );
}
