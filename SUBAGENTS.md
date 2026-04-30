# Subagent Routing Rules

Spawn subagents (Agent tool) to isolate context, parallelize independent work, or offload bulk mechanical tasks. Don't spawn when the parent needs the reasoning, when synthesis requires holding things together, or when spawn overhead dominates.

**Avoid sprawl.** Each spawn may surface an approval prompt depending on the permission settings. Batch related work into one subagent rather than fanning out into many.

**Subagent context is fresh.** No parent conversation, no parent tool results. Pack what matters into the prompt string. Project CLAUDE.md is loaded automatically.

**Pack the strategic why, not just the task.** Tell the subagent what the parent is trying to decide, not only what to fetch. A subagent that knows "we're choosing between A and B" can flag a third option or surface that the question itself is wrong. A subagent told only "research A and B" can't. The fresh context cuts both ways: without the strategic frame, the child can't recognize a curveball, can't flag a pivot, can't separate signal from noise mid-research.

**The brief is the entire reality.** A subagent given "find top posts from competitor_x" returns post text and engagement — it doesn't verify whether competitor_x actually ships what those posts claim. If the synthesis depends on a specific claim being true ("none of them shipped X"), put it in the brief and ask the subagent to confirm or refute against primary sources (announcement pages, docs, changelogs). Treat absence claims as extraordinary — verify load-bearing claims before drafting, not after pushback. Surface data ≠ underlying reality. Different question, different fetch.

Pick the cheapest agent that can do the subtask well:
- Haiku: bulk mechanical work, no judgment (file renames, csv parsing, log scans)
- Sonnet: scoped research, code/file exploration, in-scope synthesis
- Opus: rare. Strive to keep judgment in the parent.

If a subagent realizes the task needs more reasoning than its tier provides, return to the parent rather than burning tokens trying.

Parent owns final output and cross-spawn synthesis. User instructions override.