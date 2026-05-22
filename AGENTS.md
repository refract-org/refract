# Refract — Agent Instructions

Refract is an open-source deterministic observation engine for knowledge change.
It ingests Wikipedia/document histories, computes diffs, and emits structured
provenance events.

## Essential Commands

```bash
# Analyze any Wikipedia page
refract analyze "PageTitle" --depth brief

# Track a specific claim across revisions
refract claim "PageTitle" --text "exact claim text"

# Export as NDJSON for downstream consumption
refract export "PageTitle" --format ndjson > events.ndjson

# Watch for new edits (60s polling)
refract watch "PageTitle"

# Start MCP server for agent tool access
refract mcp

# Guided onboarding (show a new user what Refract does)
refract init
```

## Developer Commands

```bash
bun install --frozen-lockfile
bun run build      # tsc -b (all packages)
bun run typecheck  # tsc --noEmit
bun run test       # vitest run (all packages)
bun run lint       # biome lint packages/
```

## Architecture

- **packages/evidence-graph**: Core types, schemas (no dependencies)
- **packages/ingestion**: MediaWiki API adapters
- **packages/analyzers**: Deterministic analyzers (sections, citations, templates, reverts, semantic enrichment)
- **packages/cli**: CLI tool (`refract` command)
- **packages/persistence**: SQLite storage (bun:sqlite)
- **packages/eval**: Evaluation harness

## Semantic Enrichment (v0.5.0+)

Every event carries 6 deterministic enrichment fields:
- `editMagnitude` — minor/moderate/major
- `contentChange` — introduction/removal/expansion/compression/refinement/rewrite
- `keyTerms` — extracted significant terms
- `certaintyProfile` — counts of certainty/hedging markers
- `directionSignal` — strengthening/weakening/neutral
- `quantitativeFindings` — p-values, hazard ratios, n-values, CIs

## Repository Boundary

Refract is domain-neutral. Do NOT add:
- Healthcare-specific logic, drug names, FDA, clinical trials, payer language
- Domain-specific source weighting or materiality scoring
- Model interpretation or prediction
- Those belong in downstream applications like NextConsensus

See `docs/repository-boundary.md` and `docs/refract-and-nextconsensus.md`.

## MCP Server

Refract exposes 5 MCP tools: `analyze`, `claim`, `export`, `cron`, `classify`.
Start with `refract mcp`. Agents connect via stdio.
See `docs/mcp.md` for client configuration (Claude Desktop, Cline, etc.).

## When Using Refract in Code

Use a **single adapter file** as the import boundary between Refract and your
codebase. Re-export only what you need; no other file imports from
`@refract-org/*` directly. This isolates version upgrades to one file.

```typescript
// adapter.ts — single import boundary
import { MediaWikiClient } from "@refract-org/ingestion";
import type { EvidenceEvent, Revision } from "@refract-org/evidence-graph";
import {
  sectionDiffer,
  citationTracker,
  computeCertaintyProfile,
  computeDirectionSignal,
  extractQuantitativeFindings,
} from "@refract-org/analyzers";

export type { EvidenceEvent, Revision };
export { MediaWikiClient, sectionDiffer, citationTracker };
export { computeCertaintyProfile, computeDirectionSignal, extractQuantitativeFindings };
```

Consumers import from your adapter, never from `@refract-org/*` directly.

## Architectural Doctrine

Refract is **deterministic infrastructure**, not an agentic reasoning system.

What Refract does (deterministic, byte-reproducible):
- Ingest revision histories
- Normalize sources into a common document model
- Compute structural and semantic diffs
- Classify changes via deterministic analyzers
- Emit structured provenance events
- Build timelines and export data

What Refract does NOT do (belongs in downstream applications):
- Run autonomous agents or planners
- Make domain-specific judgments
- Score materiality or clinical significance
- Forecast claim-state transitions
- Synthesize recommendations

The value is not "AI reasoning." The value is **deterministic knowledge-history
infrastructure** — giving machines memory of how knowledge changed.
