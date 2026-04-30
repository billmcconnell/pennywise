# Pennywise

Personal finance tracker. Privacy-first, upload-only ingestion (CSV), self-hosted.

See `personal_finance_tracker_prd.md` for full spec.

## Stack

- **Monorepo**: pnpm workspaces
- **Backend** (`packages/api`): Fastify + Drizzle + Postgres + pg-boss + Auth.js
- **Frontend** (`packages/web`): Vite + React + TanStack Query + shadcn/ui + Recharts
- **Shared** (`packages/shared`): Zod schemas, types, category seed

## Prerequisites

- Node 22 LTS (`fnm use` reads `.nvmrc`)
- pnpm 10+
- Docker (Colima locally)

## Setup

```bash
fnm use            # Node 22
pnpm install
pnpm db:up         # Postgres 16 in Docker
pnpm dev           # api + web
```

API: http://localhost:3000  ·  health: http://localhost:3000/healthz

## Scripts

| Command | What |
|---|---|
| `pnpm dev` | run api + web in parallel |
| `pnpm build` | build all packages |
| `pnpm typecheck` | tsc across workspace |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm db:up` / `db:down` | Postgres container |

## Phase status

Phase 0 — scaffold (current). Phase 1 MVP scope per PRD §8.
