import type { Account } from './api';

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
    <div className="relative overflow-hidden rounded-xl bg-teal-800 p-7 text-white">
      {/* watermark pattern */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-[14px]"
            style={{
              width: 56, height: 56,
              background: 'rgba(255,255,255,0.04)',
              left: `${58 + (i % 4) * 13}%`,
              top: `${(Math.floor(i / 4)) * 32 + 5}%`,
            }}
          />
        ))}
      </div>
      <div className="relative">
        <p className="mb-1 text-sm opacity-80">Net worth</p>
        <p
          className="font-display text-4xl font-bold tabular-nums tracking-tight whitespace-nowrap"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {fmt(netWorth)}
        </p>
        <p className="mt-2 text-sm opacity-65">
          {fmt(assets)} assets · {fmt(liabilities)} liabilities
        </p>
      </div>
    </div>
  );
}
