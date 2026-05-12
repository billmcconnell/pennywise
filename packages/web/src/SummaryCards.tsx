import type { Summary } from './api';

const fmtFull = (s: string) =>
  Number(s).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const fmtShort = (s: string) =>
  Number(s).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function pct(current: string, prior: string): number | null {
  const c = Number(current);
  const p = Number(prior);
  if (p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}

function TrendBadge({ changePct, positiveIsGood }: { changePct: number | null; positiveIsGood: boolean }) {
  if (changePct === null) return null;
  const abs = Math.abs(changePct);
  if (abs < 0.5) return <span className="text-xs text-zinc-400">—</span>;
  const isGood = positiveIsGood ? changePct > 0 : changePct < 0;
  const color = isGood ? 'text-emerald-600' : 'text-amber-600';
  const arrow = changePct > 0 ? '↗' : '↙';
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {abs.toFixed(1)}% {arrow}
    </span>
  );
}

function Card({
  label,
  value,
  prevValue,
  accentClass,
  positiveIsGood,
  loading,
}: {
  label: string;
  value: string | undefined;
  prevValue: string | undefined;
  accentClass: string;
  positiveIsGood: boolean;
  loading: boolean;
}) {
  const changePct = value && prevValue ? pct(value, prevValue) : null;

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 h-2.5 w-20 rounded bg-zinc-200" />
        <div className="h-7 w-32 rounded bg-zinc-200" />
        <div className="mt-2 h-3 w-24 rounded bg-zinc-200" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className={`font-display text-2xl font-bold tabular-nums ${accentClass}`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {value ? fmtShort(value) : '—'}
        </span>
        <TrendBadge changePct={changePct} positiveIsGood={positiveIsGood} />
      </div>
      {prevValue && (
        <p className="mt-1 text-xs text-zinc-400">
          vs. {fmtFull(prevValue)} last month
        </p>
      )}
    </div>
  );
}

export function SummaryCards(props: {
  summary: Summary | undefined;
  prevSummary: Summary | undefined;
  isLoading: boolean;
}) {
  const s = props.summary;
  const p = props.prevSummary;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card
        label="Income"
        value={s?.income}
        prevValue={p?.income}
        accentClass="text-emerald-700"
        positiveIsGood={true}
        loading={props.isLoading}
      />
      <Card
        label="Expenses"
        value={s?.expenses}
        prevValue={p?.expenses}
        accentClass="text-rose-600"
        positiveIsGood={false}
        loading={props.isLoading}
      />
      <Card
        label="Net"
        value={s?.net}
        prevValue={p?.net}
        accentClass={s && Number(s.net) >= 0 ? 'text-emerald-700' : 'text-rose-600'}
        positiveIsGood={true}
        loading={props.isLoading}
      />
    </div>
  );
}
