import type { Account } from './api';

const ASSET_TYPES = new Set(['checking', 'savings', 'investment']);

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function NetWorthPanel({ accounts }: { accounts: Account[] }) {
  const active = accounts.filter((a) => a.archivedAt === null);
  if (active.length === 0) return null;

  let assets = 0;
  let liabilities = 0;

  for (const a of active) {
    const bal = Number(a.currentBalance);
    if (ASSET_TYPES.has(a.type)) {
      assets += bal;
    } else {
      // credit_card: positive balance = amount owed
      liabilities += Math.max(0, bal);
    }
  }

  const netWorth = assets - liabilities;

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 p-4 sm:grid-cols-3">
      <Stat label="Total assets" value={assets} positive />
      <Stat label="Total liabilities" value={liabilities} negative />
      <Stat label="Net worth" value={netWorth} highlight />
    </div>
  );
}

function Stat({
  label,
  value,
  positive,
  negative,
  highlight,
}: {
  label: string;
  value: number;
  positive?: boolean;
  negative?: boolean;
  highlight?: boolean;
}) {
  const color = highlight
    ? value >= 0
      ? 'text-emerald-700'
      : 'text-red-600'
    : positive
      ? 'text-emerald-700'
      : negative
        ? 'text-red-600'
        : 'text-zinc-900';

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-lg font-semibold tabular-nums ${color}`}>{fmt(value)}</span>
    </div>
  );
}
