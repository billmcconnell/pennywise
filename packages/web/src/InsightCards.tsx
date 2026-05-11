import type { InsightsData } from './api';

const usd = (s: string) =>
  Number(s).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

type Accent = 'amber' | 'green' | 'blue';

interface CardProps {
  label: string;
  headline: string;
  sub?: string;
  accent: Accent;
}

function Card({ label, headline, sub, accent }: CardProps) {
  const style: Record<Accent, string> = {
    amber: 'bg-amber-50 border-amber-200',
    green: 'bg-emerald-50 border-emerald-200',
    blue:  'bg-white border-zinc-200',
  };
  const labelColor: Record<Accent, string> = {
    amber: 'text-amber-700',
    green: 'text-emerald-700',
    blue:  'text-zinc-400',
  };

  return (
    <div className={`rounded-xl border p-4 ${style[accent]}`}>
      <p className={`mb-1 text-xs font-medium uppercase tracking-wide ${labelColor[accent]}`}>{label}</p>
      <p className="text-sm font-semibold text-zinc-900">{headline}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-2 h-2.5 w-20 rounded bg-zinc-200" />
      <div className="h-3.5 w-4/5 rounded bg-zinc-200" />
      <div className="mt-1.5 h-2.5 w-1/2 rounded bg-zinc-200" />
    </div>
  );
}

export function InsightCards({ data, isLoading }: { data: InsightsData | undefined; isLoading?: boolean }) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }
  const { uncategorizedCount, topCategory, largestRecurring } = data;

  const uncatCard = (() => {
    if (uncategorizedCount === 0) {
      return <Card label="Categorization" headline="All transactions categorized" accent="green" />;
    }
    return (
      <Card
        label="Categorization"
        headline={`${uncategorizedCount} transaction${uncategorizedCount === 1 ? '' : 's'} need${uncategorizedCount === 1 ? 's' : ''} a category`}
        accent="amber"
      />
    );
  })();

  const topCatCard = (() => {
    if (!topCategory) {
      return <Card label="Top category" headline="No expense data this month" accent="blue" />;
    }
    const { name, currentTotal, priorTotal, changePct } = topCategory;
    const priorNum = Number(priorTotal);
    if (changePct === null) {
      return (
        <Card
          label="Top category"
          headline={`${name} — ${usd(currentTotal)}`}
          sub="No data last month to compare"
          accent="blue"
        />
      );
    }
    const direction = changePct >= 0 ? 'up' : 'down';
    const pct = Math.abs(changePct);
    const accent: Accent = changePct > 10 ? 'amber' : changePct < -10 ? 'green' : 'blue';
    return (
      <Card
        label="Top category"
        headline={`${name} is ${direction} ${pct}% vs last month`}
        sub={`${usd(currentTotal)} this month vs ${usd(priorNum.toFixed(2))} last month`}
        accent={accent}
      />
    );
  })();

  const recurringCard = (() => {
    if (!largestRecurring) {
      return <Card label="Recurring" headline="No recurring merchants detected" accent="blue" />;
    }
    const { merchant, avgMonthlyTotal, monthCount } = largestRecurring;
    return (
      <Card
        label="Largest recurring"
        headline={`${merchant} — ${usd(avgMonthlyTotal)}/mo`}
        sub={`Seen in ${monthCount} of the last 3 months`}
        accent="blue"
      />
    );
  })();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {uncatCard}
      {topCatCard}
      {recurringCard}
    </div>
  );
}
