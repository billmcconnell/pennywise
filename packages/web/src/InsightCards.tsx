import type React from 'react';
import type { InsightsData } from './api';

const usd = (s: string) =>
  Number(s).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const IconTag = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);

const IconStar = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
  </svg>
);

type Accent = 'amber' | 'green' | 'blue';

interface CardProps {
  label: string;
  icon?: React.ReactNode;
  headline: string;
  sub?: string;
  accent: Accent;
  cta?: string;
  onCta?: () => void;
}

function Card({ label, icon, headline, sub, accent, cta, onCta }: CardProps) {
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
  const ctaColor: Record<Accent, string> = {
    amber: 'text-amber-700 hover:text-amber-900',
    green: 'text-emerald-700 hover:text-emerald-900',
    blue:  'text-teal-700 hover:text-teal-900',
  };

  return (
    <div className={`flex flex-col rounded-xl border p-4 ${style[accent]}`}>
      <div className={`mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${labelColor[accent]}`}>
        {icon && <span className="shrink-0 text-zinc-400">{icon}</span>}
        <span>{label}</span>
      </div>
      <p className="text-sm font-semibold text-zinc-900">{headline}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
      {cta && onCta && (
        <button
          type="button"
          onClick={onCta}
          className={`mt-3 flex items-center gap-0.5 text-xs font-medium transition-colors ${ctaColor[accent]}`}
        >
          {cta} <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-2 h-2.5 w-20 rounded bg-zinc-200" />
      <div className="h-3.5 w-4/5 rounded bg-zinc-200" />
      <div className="mt-1.5 h-2.5 w-1/2 rounded bg-zinc-200" />
      <div className="mt-3 h-3 w-24 rounded bg-zinc-200" />
    </div>
  );
}

export function InsightCards({
  data,
  isLoading,
  onNavigate,
}: {
  data: InsightsData | undefined;
  isLoading?: boolean;
  onNavigate: (view: string) => void;
}) {
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
      return (
        <Card
          label="Categorization"
          icon={<IconTag />}
          headline="All transactions categorized"
          accent="green"
        />
      );
    }
    return (
      <Card
        label="Categorization"
        icon={<IconTag />}
        headline={`${uncategorizedCount} transaction${uncategorizedCount === 1 ? '' : 's'} need${uncategorizedCount === 1 ? 's' : ''} a category`}
        accent="amber"
        cta="Open Categorize"
        onCta={() => onNavigate('categories')}
      />
    );
  })();

  const topCatCard = (() => {
    if (!topCategory) {
      return <Card label="Top category" icon={<IconStar />} headline="No expense data this month" accent="blue" />;
    }
    const { name, currentTotal, priorTotal, changePct } = topCategory;
    const priorNum = Number(priorTotal);
    if (changePct === null) {
      return (
        <Card
          label="Top category"
          icon={<IconStar />}
          headline={`${name} — ${usd(currentTotal)}`}
          sub="No data last month to compare"
          accent="blue"
          cta="Review Budget"
          onCta={() => onNavigate('budgets')}
        />
      );
    }
    const direction = changePct >= 0 ? 'up' : 'down';
    const pct = Math.abs(changePct);
    const accent: Accent = changePct > 10 ? 'amber' : changePct < -10 ? 'green' : 'blue';
    return (
      <Card
        label="Top category"
        icon={<IconStar />}
        headline={`${name} is ${direction} ${pct}% vs last month`}
        sub={`${usd(currentTotal)} this month vs ${usd(priorNum.toFixed(2))} last month`}
        accent={accent}
        cta="Review Budget"
        onCta={() => onNavigate('budgets')}
      />
    );
  })();

  const recurringCard = (() => {
    if (!largestRecurring) {
      return <Card label="Recurring" icon={<IconRefresh />} headline="No recurring merchants detected" accent="blue" />;
    }
    const { merchant, avgMonthlyTotal, monthCount } = largestRecurring;
    return (
      <Card
        label="Largest recurring"
        icon={<IconRefresh />}
        headline={`${merchant} — ${usd(avgMonthlyTotal)}/mo`}
        sub={`Seen in ${monthCount} of the last 3 months`}
        accent="blue"
        cta="View Bills"
        onCta={() => onNavigate('bills')}
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
