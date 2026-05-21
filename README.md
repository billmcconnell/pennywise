# Pennywise

Personal finance tracker. Privacy-first, upload-only ingestion, self-hosted.

Live at **https://pennywise.mcconnalino.com**

See `personal_finance_tracker_prd.md` for the full product spec.

## Stack

- **Monorepo**: pnpm workspaces
- **Backend** (`packages/api`): Fastify + Drizzle + Postgres 16 + pg-boss + custom magic-link auth
- **Frontend** (`packages/web`): Vite + React 18 + Tailwind + TanStack Query + Recharts
- **Shared** (`packages/shared`): Zod schemas, types, category seed
- **AI**: Anthropic API (Claude Haiku) for LLM-assisted categorization
- **Email**: Resend via SMTP (domain: `mcconnalino.com`)
- **Hosting**: Fly.io with Neon (Postgres)

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

By default, `AUTH_MODE=dev` auto-logs in as the seeded household — no email required locally.

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

- **Auth**: magic-link email sign-in; email allowlist; HTTP-only session cookie; global 401 → login redirect
- **Household model**: multiple users share one household; all data is household-scoped
- **Admin roles**: `admin` / `member` roles. First user is admin. Admins can invite members, remove members, and promote members to admin. Settings page is admin-only.
- **Invites**: admins enter an email address; an accept-invite link is emailed to the invitee via Resend
- **Multi-account**: track checking, savings, investment, and credit accounts
- **Statement import**: CSV upload with adapters for Amex, Chase, BofA, Wells Fargo, USAA, SoFi, and Bask; graceful PDF rejection
- **Auto-categorization**: two-phase pipeline — rules engine first, then Claude Haiku LLM for unmatched transactions. High-confidence LLM results (≥ 0.90) auto-promote to rules.
- **Categorization feedback**: inline thumbs up/down on auto-categorized transactions. Thumbs-down records `incorrect` without interrupting flow. Feedback is used as few-shot examples in future LLM calls.
- **Split transactions**: split a single transaction across multiple categories
- **Budgets**: monthly budget targets per category with vs-actual tracking and history
- **Goals**: savings goals with on-track status
- **Bills**: recurring bill tracking with suggestions from transaction patterns
- **Cash flow forecasting**: projected income/expenses from detected recurring patterns
- **Dashboard**: balance hero, summary cards (income/expenses/net vs prior month), cash flow chart, spending pie with category drill-down, top merchants, insight cards
- **Transactions**: search, filter by month/account/category/tag, inline edit, split transactions
- **Export**: CSV and JSON backup

## Deployment

Production runs on [Fly.io](https://fly.io) (`pennywise-app`) with [Neon](https://neon.tech) Postgres. Every push to `main` deploys automatically via GitHub Actions. Migrations run as a Fly release command before traffic cuts over.

**Production URL**: https://pennywise.mcconnalino.com  
**Fly app**: `pennywise-app` (also reachable at `pennywise-app.fly.dev`)

### First-time deploy

```bash
brew install flyctl
fly auth login

# Add custom domain and DNS
fly certs add pennywise.mcconnalino.com
# Then add A/AAAA records at your registrar pointing to Fly's IPs

# Set required secrets
fly secrets set \
  DATABASE_URL="postgresql://..." \
  AUTH_SECRET="$(openssl rand -hex 32)" \
  AUTH_MODE="magic-link" \
  ALLOWED_EMAILS="you@example.com" \
  APP_URL="https://pennywise.mcconnalino.com" \
  SMTP_HOST="smtp.resend.com" \
  SMTP_PORT="465" \
  SMTP_USER="resend" \
  SMTP_PASS="re_..." \
  SMTP_FROM="Pennywise <noreply@mcconnalino.com>" \
  ANTHROPIC_API_KEY="sk-ant-..."

fly deploy
```

> `ANTHROPIC_API_KEY` is optional. Without it, imports fall back to rules-only categorization.

### Re-deploy manually

```bash
fly deploy
```

### Promote an existing user to admin

```bash
fly ssh console -C "node -e \"import('pg').then(({default:pg})=>{const c=new pg.Client(process.env.DATABASE_URL);c.connect().then(()=>c.query(\\\"UPDATE users SET role='admin' WHERE email='you@example.com'\\\")).then(r=>{console.log('updated',r.rowCount,'row(s)');c.end()})})\""
```

## Phase status

| Phase | Commit | What shipped |
|-------|--------|-------------|
| **Phase 1** | `v0.1.0` / `ce3437a` | CSV upload, manual categorization, pie chart, single account |
| **Phase 2** | `aba435c` | Rules engine, multi-account, dashboard expansion, transaction edit + search |
| **Phase 3** | `92de03a` | Budgets, goals, bills, cashflow forecasting, multi-bank CSV adapters, data export |
| **Phase 4** | `fe8fa62` | Magic-link auth, household model, admin/member roles, member invites, LLM categorization (Claude Haiku), categorization feedback loop, custom domain (`pennywise.mcconnalino.com`), GitHub Actions CI/CD |
