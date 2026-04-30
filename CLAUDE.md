# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Subagents v1.0

Spawn subagents to isolate context, parallelize independent work, or offload bulk mechanical tasks. Don't spawn when the parent needs the reasoning, when synthesis requires holding things together, or when spawn overhead dominates.

Pick the cheapest model that can do the subtask well:
- Haiku: bulk mechanical work, no judgment
- Sonnet: scoped research, code exploration, in-scope synthesis
- Opus: subtasks needing real planning or tradeoffs

If a subagent realizes it needs a higher tier than itself, return to the parent.

Parent owns final output and cross-spawn synthesis. User instructions override.

## Project Status

Pre-implementation. No source code, build system, package manifest, or tests exist yet. The repo currently contains:

- `personal_finance_tracker_prd.md` — full product spec (canonical source of truth for scope, features, data model, phasing).
- `Budget Project input files/*.csv` — 12 months of real Amex statement exports (Dec 2024 → Dec 2025) used as reference/test fixtures for parser work.

When asked to "build", "scaffold", or "start" the app, treat the PRD as the authoritative requirements doc. Confirm framework/stack choices with the user before generating code — the PRD lists *options* (React or Vue, Node or Django, etc.), not decisions.

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
