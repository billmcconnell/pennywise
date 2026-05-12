# Pennywise

Personal finance tracker. Privacy-first, upload-only ingestion, self-hosted.

See `personal_finance_tracker_prd.md` for full spec.

## Stack

- **Monorepo**: pnpm workspaces
- **Backend** (`packages/api`): Fastify + Drizzle + Postgres 16 + pg-boss + Auth.js
- **Frontend** (`packages/web`): Vite + React 18 + Tailwind + TanStack Query + Recharts
- **Shared** (`packages/shared`): Zod schemas, types, category seed

## Prerequisites

- Node 22 LTS (`fnm use` reads `.nvmrc`)
- pnpm 10+
- Docker (Colima locally)

## Setup

```bash
fnm use                                    # Node 22
pnpm install
pnpm db:up                                 # Postgres 16 in Docker
pnpm --filter @pennywise/api db:migrate    # apply migrations
pnpm dev                                   # api + web in parallel
```

API: http://localhost:3000 · health: http://localhost:3000/healthz  
Web: http://localhost:5173 (or next available port)

## Scripts

| Command | What |
|---|---|
| `pnpm dev` | api + web in parallel |
| `pnpm build` | tsc + vite build, all packages |
| `pnpm typecheck` | tsc `--noEmit` workspace-wide |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm db:up` / `db:down` / `db:logs` | Postgres 16 container |
| `pnpm --filter @pennywise/api db:generate` | Drizzle migration gen |
| `pnpm --filter @pennywise/api db:migrate` | apply migrations |

## Features

- **Multi-account**: track checking, savings, investment, and credit accounts
- **Statement import**: CSV upload with adapters for Amex, Chase, BofA, Wells Fargo, USAA, SoFi, and Bask; graceful PDF rejection
- **Auto-categorization**: rules engine with pattern matching; inline thumbs-up/down feedback loop
- **Budgets**: monthly budget targets per category with vs-actual tracking and history
- **Goals**: savings goals with on-track status
- **Bills**: recurring bill tracking with suggestions from transaction patterns
- **Cash flow forecasting**: projected income/expenses from detected recurring patterns
- **Dashboard**: balance hero, summary cards (income/expenses/net vs prior month), cash flow chart, spending pie with category drill-down, top merchants, insight cards
- **Transactions**: search, filter by month/account/category/tag, inline edit, split transactions
- **Export**: CSV and JSON backup

## Phase status

- **Phase 1** (`v0.1.0`, `ce3437a`): CSV upload, manual categorization, pie chart
- **Phase 2** (`aba435c`): rules engine, multi-account, dashboard expansion, transaction edit + search
- **Phase 3** (`92de03a`): budgets, goals, bills, cashflow forecasting, multi-bank adapters, categorization feedback
- **Phase 4**: next — see PRD §8 for scope
