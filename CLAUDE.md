# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Subagents v2.0

Bulk mechanical work, scoped research, and parallel investigations should spawn a Claude Code subagent, not run in the parent. This keeps the parent's context clean and the prompt cache warm.

See [SUBAGENTS.md](./SUBAGENTS.md) for routing rules. Check it before defaulting to in-parent execution.

## Preferred Tools

### Data Fetching

1. **WebFetch**: free, text-only, works on public pages that don't block bots.
2. **agent-browser CLI**: free, local Rust CLI + Chrome via CDP. For dynamic pages or auth walls that WebFetch can't handle. Returns the accessibility tree with element refs (@e1, @e2). ~82% fewer tokens than screenshot-based tools. Install: `npm i -g agent-browser && agent-browser install`. Use `snapshot` for AI-friendly DOM state, element refs for interaction.
3. **Notice recurring fetch patterns and propose wrapping them as dedicated tools.** When the same fetch/parse logic comes up more than once, suggest wrapping it as a named tool (e.g. a skill file or a .py script that calls `agent-browser` with the snapshot and extraction steps baked in for that source). Add the entry to `## Dedicated Tools` below and reference it by name on future calls.

### PDF Files

Use 'pdftotext', not the 'Read' tool. Use 'Read' only when the user directly asks to analyze images or charts inside the document. Read loads PDFs as images.

## Dedicated Tools

<!-- List project-specific tools here. For each, link to its skill or script file (e.g. `tools/reddit_fetch.py`). The orchestration logic lives in those files, not here. -->

## Project Status

Phase 1 MVP shipped 2026-05-04 (tag `v0.1.0`, commit `ce3437a`). CSV upload → manual categorize → pie chart works end-to-end. Auth.js magic-link deferred — dev resolver hard-codes the seeded household. Phase 2 next per PRD §8 (multi-format ingestion, rules engine for auto-categorization, multi-account, full dashboard).

- `personal_finance_tracker_prd.md` — canonical spec (scope, features, data model, phasing).
- `Budget Project input files/*.csv` — 12 months Amex statements (Dec 2024 → Dec 2025), reference/test fixtures.

Stack locked (do not re-propose alternatives): Node 22 + TypeScript, pnpm workspaces, Fastify + Drizzle + Postgres 16 + pg-boss (api), Vite + React 18 + Tailwind + TanStack Query + Recharts (web), Zod (shared). PRD listed options; decisions made.

## Package Layout

- `packages/api` — Fastify server, Drizzle migrations (`drizzle/`), pg-boss jobs. Entry: `src/server.ts`.
- `packages/web` — Vite + React SPA. Entry: `src/main.tsx`, `index.html`.
- `packages/shared` — Zod schemas, types, category seed. Imported as `@pennywise/shared`.

## Commands

| Command | What |
|---|---|
| `pnpm dev` | api + web parallel (api :3000, health `/healthz`) |
| `pnpm build` | tsc + vite build, all packages |
| `pnpm typecheck` | tsc `--noEmit` workspace-wide |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm db:up` / `db:down` / `db:logs` | Postgres 16 container |
| `pnpm --filter @pennywise/api db:generate` | Drizzle migration gen |
| `pnpm --filter @pennywise/api db:migrate` | apply migrations |

Node version pinned `.nvmrc` (22). Use `fnm use` before install.

## Sample Data Format (Amex CSV)

Header row:
```
Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
```

Quirks any parser must handle:
- `Date` is `MM/DD/YYYY`.
- `Amount` is positive for charges, negative for credits/payments — opposite of the debit-positive convention many bank CSVs use.
- `Extended Details` is multi-line; embedded newlines inside double-quoted fields. Use a real CSV parser (RFC 4180), not line splitting.
- `Reference` values are wrapped in single quotes inside the field (e.g. `'150110040000063241'`) to defeat spreadsheet number coercion — strip on ingest.
- `Category` is Amex's own taxonomy (`Fees & Adjustments-Fees & Adjustments`, `Merchandise & Supplies-Groceries`, etc.) — not the PRD §4.4 category hierarchy. Map, don't pass through.
- File naming is statement-period: `YYYY-MM -- YYYY-MM.csv`. Adjacent files overlap on boundary dates → duplicate detection (PRD §4.2) is a real requirement, not theoretical.

## Architecture Anchors (from PRD)

The PRD locks these decisions; reference §6 and §4 before proposing alternatives:

- **Privacy-first**: no direct bank API connections in scope. Upload-only ingestion. Don't suggest Plaid/Yodlee unless user explicitly opens that door (listed only as future consideration in §12).
- **Transaction model**: Appendix A defines the canonical schema (UUIDs, `original_description` preserved separately from edited `description`, `auto_categorized` + `confidence_score`, splits as a sub-array). Match this when generating DB migrations or types.
- **Default category hierarchy**: §4.4 lists the 8 top-level buckets (Housing, Transportation, Food, Healthcare, Personal, Financial, Income, Uncategorized). Subcategories enumerated. Don't invent new top-levels.
- **Phasing**: §8 — MVP is single-CSV + single-account + pie chart only. Multi-format (PDF/OFX/QFX), rules engine, and multi-account land in Phase 2. Don't build Phase 2+ features into MVP scaffolding.

## Working Directory Note

Path contains spaces (`My Drive/cc-projects/Budget Project`). Always quote in shell commands. Project dir was created read-only (Google Drive sync default) — `chmod u+w` was applied to allow writes.
