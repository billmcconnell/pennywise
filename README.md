# Pennywise

Personal finance tracker. Privacy-first, upload-only ingestion, self-hosted.

See `personal_finance_tracker_prd.md` for full spec.

## Stack

- **Monorepo**: pnpm workspaces
- **Backend** (`packages/api`): Fastify + Drizzle + Postgres 16 + pg-boss + custom magic-link auth
- **Frontend** (`packages/web`): Vite + React 18 + Tailwind + TanStack Query + Recharts
- **Shared** (`packages/shared`): Zod schemas, types, category seed

## Prerequisites

- Node 22 LTS (`fnm use` reads `.nvmrc`)
- pnpm 10+
- Docker (Colima locally)

## Local setup

```bash
fnm use                                    # Node 22
pnpm install
pnpm db:up                                 # Postgres 16 in Docker
pnpm --filter @pennywise/api db:migrate    # apply migrations
pnpm dev                                   # builds shared, then starts api + web
```

API: http://localhost:3000 · health: http://localhost:3000/api/healthz  
Web: http://localhost:5173 (or next available port)

## Scripts

| Command | What |
|---|---|
| `pnpm dev` | build shared, then start api + web in parallel |
| `pnpm build` | tsc + vite build, all packages |
| `pnpm typecheck` | tsc `--noEmit` workspace-wide |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm db:up` / `db:down` / `db:logs` | Postgres 16 container |
| `pnpm --filter @pennywise/api db:generate` | Drizzle migration gen |
| `pnpm --filter @pennywise/api db:migrate` | apply migrations |

## Features

- **Auth**: magic-link email sign-in with email allowlist; session cookies; global 401 → login redirect
- **Multi-account**: track checking, savings, investment, and credit accounts
- **Statement import**: CSV upload with adapters for Amex, Chase, BofA, Wells Fargo, USAA, SoFi, and Bask; graceful PDF rejection
- **Auto-categorization**: rules engine with pattern matching; inline thumbs-up/down feedback loop
- **Split transactions**: split a single transaction across multiple categories
- **Budgets**: monthly budget targets per category with vs-actual tracking and history
- **Goals**: savings goals with on-track status
- **Bills**: recurring bill tracking with suggestions from transaction patterns
- **Cash flow forecasting**: projected income/expenses from detected recurring patterns
- **Dashboard**: balance hero, summary cards (income/expenses/net vs prior month), cash flow chart, spending pie with category drill-down, top merchants, insight cards
- **Transactions**: search, filter by month/account/category/tag, inline edit, split transactions
- **Export**: CSV and JSON backup

## Deployment

Production runs on [Fly.io](https://fly.io) (API + static frontend) with [Neon](https://neon.tech) (Postgres). Every push to `main` deploys automatically via GitHub Actions; migrations run as a Fly release command before traffic cuts over.

```
https://pennywise-app.fly.dev
```

### First-time deploy

```bash
brew install flyctl
fly auth login
fly secrets set \
  DATABASE_URL="postgresql://..." \
  AUTH_SECRET="$(openssl rand -hex 32)" \
  ALLOWED_EMAILS="you@example.com" \
  APP_URL="https://pennywise-app.fly.dev" \
  SMTP_HOST="smtp.resend.com" SMTP_PORT="465" \
  SMTP_USER="resend" SMTP_PASS="re_..." \
  SMTP_FROM="Pennywise <noreply@yourdomain.com>" \
  --app pennywise-app
fly deploy --app pennywise-app
```

### Re-deploy manually

```bash
fly deploy --app pennywise-app
```

## Phase status

- **Phase 1** (`v0.1.0`, `ce3437a`): CSV upload, manual categorization, pie chart
- **Phase 2** (`aba435c`): rules engine, multi-account, dashboard expansion, transaction edit + search
- **Phase 3** (`92de03a`): budgets, goals, bills, cashflow forecasting, multi-bank adapters, categorization feedback
- **Phase 4** (in progress): split transactions, magic-link auth (production), Fly.io + Neon deployment, GitHub Actions CI/CD
