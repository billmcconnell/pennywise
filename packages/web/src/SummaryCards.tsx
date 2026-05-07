import type { Summary } from './api';

const fmt = (s: string): string =>
  Number(s).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function SummaryCards(props: { summary: Summary | undefined; isLoading: boolean }) {
  const s = props.summary;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      <Card label="Income" value={s ? fmt(s.income) : '—'} accent="emerald" loading={props.isLoading} />
      <Card label="Expenses" value={s ? fmt(s.expenses) : '—'} accent="rose" loading={props.isLoading} />
      <Card label="Net" value={s ? fmt(s.net) : '—'} accent={s && Number(s.net) < 0 ? 'rose' : 'emerald'} loading={props.isLoading} />
      <Card
        label="Largest category"
        value={s?.largestCategory ? s.largestCategory.name ?? '—' : '—'}
        sub={s?.largestCategory ? fmt(s.largestCategory.total) : undefined}
        loading={props.isLoading}
      />
      <Card
        label="Uncategorized"
        value={s ? String(s.uncategorizedCount) : '—'}
        sub={s ? `of ${s.txnCount} txns` : undefined}
        accent={s && s.uncategorizedCount > 0 ? 'amber' : 'zinc'}
        loading={props.isLoading}
      />
    </div>
  );
}

const ACCENTS = {
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  amber: 'text-amber-700',
  zinc: 'text-zinc-900',
} as const;

function Card(props: {
  label: string;
  value: string;
  sub?: string | undefined;
  accent?: keyof typeof ACCENTS | undefined;
  loading: boolean;
}) {
  const accent = ACCENTS[props.accent ?? 'zinc'];
  return (
    <div className="rounded border border-zinc-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{props.label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${accent}`}>
        {props.loading ? '…' : props.value}
      </div>
      {props.sub && <div className="text-xs text-zinc-500">{props.sub}</div>}
    </div>
  );
}
