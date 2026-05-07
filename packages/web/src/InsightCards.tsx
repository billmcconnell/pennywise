import type { InsightsData } from './api';

const usd = (s: string) =>
  Number(s).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

interface CardProps {
  label: string;
  headline: string;
  sub?: string;
  accent: 'amber' | 'red' | 'green' | 'blue';
}

function Card({ label, headline, sub, accent }: CardProps) {
  const border = {
    amber: 'border-l-amber-400',
    red: 'border-l-red-400',
    green: 'border-l-green-500',
    blue: 'border-l-blue-500',
  }[accent];

  return (
    <div className={`rounded border border-zinc-200 border-l-4 ${border} p-4`}>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-zinc-900">{headline}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export function InsightCards({ data }: { data: InsightsData }) {
  const { uncategorizedCount, topCategory, largestRecurring } = data;

  const uncatCard = (() => {
    if (uncategorizedCount === 0) {
      return (
        <Card
          label="Categorization"
          headline="All transactions categorized"
          accent="green"
        />
      );
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
      return (
        <Card label="Top Category" headline="No expense data this month" accent="blue" />
      );
    }
    const { name, currentTotal, priorTotal, changePct } = topCategory;
    const priorNum = Number(priorTotal);

    if (changePct === null) {
      return (
        <Card
          label="Top Category"
          headline={`${name} — ${usd(currentTotal)}`}
          sub="No data last month to compare"
          accent="blue"
        />
      );
    }

    const direction = changePct >= 0 ? 'up' : 'down';
    const pct = Math.abs(changePct);
    const accent = changePct > 10 ? 'red' : changePct < -10 ? 'green' : 'blue';

    return (
      <Card
        label="Top Category"
        headline={`${name} is ${direction} ${pct}% vs last month`}
        sub={`${usd(currentTotal)} this month vs ${usd(priorNum.toFixed(2))} last month`}
        accent={accent}
      />
    );
  })();

  const recurringCard = (() => {
    if (!largestRecurring) {
      return (
        <Card label="Recurring" headline="No recurring merchants detected" accent="blue" />
      );
    }
    const { merchant, avgMonthlyTotal, monthCount } = largestRecurring;
    return (
      <Card
        label="Largest Recurring"
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
