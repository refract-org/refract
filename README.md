<div align="center">

# Refract

**A deterministic observation engine for revision histories. It reads a page's edits and emits a typed event for each change.**

[![CI](https://github.com/refract-org/refract/actions/workflows/ci.yml/badge.svg)](https://github.com/refract-org/refract/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/release/refract-org/refract)](https://github.com/refract-org/refract/releases)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-0f172a.svg)](./LICENSE)
[![Discussions](https://img.shields.io/badge/discussions-welcome-8b5cf6?style=flat-square)](https://github.com/refract-org/refract/discussions)

</div>

> **v0.5.0+**: Events now carry 6 deterministic enrichment fields (editMagnitude, directionSignal, certaintyProfile, etc.) — byte-reproducible, no model.

## What does it do?

Given a Wikipedia page, Refract produces a structured event stream showing **what changed, when, and how** — every sentence that appeared, was removed, or was modified; every citation that shifted.

```bash
npx @refract-org/cli analyze "Semaglutide" --depth brief
```

Output:

```
Analyzing "Semaglutide" at depth: brief...
Fetching revisions from Wikipedia...
Fetched 20 revisions.
Correlated 4 talk page discussions.

────────────────────
  Analysis Results
────────────────────
  Page:    Semaglutide
  Events:  203

  ○ section changed (rev 714793761→714794084) [(lead)]
    change=modified
  ◇ template added (rev 714793761→714794084) [body]
    name=R with possibilities type=added
  ◇ wikilink added (rev 714794084→740186843) [body]
    target=glucagon-like peptide-1 receptor agonist
  ◇ wikilink removed (rev 714794084→740186843) [body]
    target=glucagon-like peptide-1 agonist
  ○ section changed (rev 714794084→740186843) [(lead)]
    change=modified
  ● sentence introduced (rev 714794084→740186843) [(lead)]
    sentence_length=50
  ● sentence removed (rev 714794084→740186843) [(lead)]
    sentence_length=40
  ◆ citation added (rev 740186843→781025475) [body]
    type=added
  … 195 more events
```

No model is called, and the same source produces the same events on every run. A [hash-pinned ground-truth corpus](BENCHMARK.md#ground-truth-corpus) of 16,146 events across ten benchmark pages ships as a [release asset](https://github.com/refract-org/refract/releases/tag/benchmark-corpus-2026-08-27), reproducible byte-for-byte from the manifest bounds.

Refract ingests versioned sources (MediaWiki, text files), computes structural and semantic change events, tracks claims and citations across time, and emits structured provenance data that downstream systems can query, replay, and audit.

Works on any versioned text source: Wikipedia, regulatory documents, clinical guidelines, trial registries, policy archives, and legal texts. Refract replays how a claim changed over time. Downstream systems — like [NextConsensus](https://nextconsensus.com) — decide what that history means.

Most knowledge systems answer *what does this source say now?* Refract helps answer: *what changed, when, where, and what did the record say at a specific point in time?*

Built and maintained by [NextConsensus](https://nextconsensus.com) and [Kanav Jain](https://kanav.net). Domain-neutral — Refract observes change, applications interpret relevance.

[Repository boundary](./docs/repository-boundary.md)

---

## Quick start

### Prerequisites

- Node.js 20+ or Bun 1.3+
- A page title. English Wikipedia is the default; for any other MediaWiki (Wikibooks, a Fandom wiki, a private wiki) pass its `api.php` URL with `--api`. A page URL is not parsed — it is looked up as a title and finds nothing.

> **npm status, 2026-09-24:** `@refract-org/cli@0.5.7`, the newest CLI on npm, does not start. It was published against analyzer and ingestion code that never reached npm (its `^0.3.0` range on analyzers means 0.3.x only). Until the next release is published, run the CLI [from source](#from-source). The library packages on npm — `evidence-graph`, `ingestion`, `analyzers` — install and import normally. `bun run check:release` now fails a release that would repeat this; see [CHANGELOG](./CHANGELOG.md).

### One-shot analysis

```bash
# Using npx (no install required)
npx @refract-org/cli analyze "Artificial intelligence" --depth brief

# Or install globally
npm install -g @refract-org/cli
refract analyze "Quantum computing" --depth forensic
```

### Using the Python SDK

The Python SDK lives at [refract-org/refract-py](https://github.com/refract-org/refract-py) and installs from source (it is not on PyPI yet):

```bash
pip install git+https://github.com/refract-org/refract-py.git
```

```python
from refract import Refract

r = Refract()
events = r.analyze("Bitcoin", depth="brief")
for event in events:
    print(event.eventType, event.timestamp)

# As a DataFrame
df = r.analyze("Ethereum", depth="forensic", as_frame=True)
print(df.groupby("event_type").size())
```

### From source

```bash
git clone https://github.com/refract-org/refract.git
cd refract
bun install
bun run build
node packages/cli/dist/src/cli.js analyze "Machine learning" --depth brief
```

---

## What Refract captures

Refract emits **26 deterministic event types** from versioned sources:

| Category | Events |
|----------|--------|
| **Appearance** | `sentence_first_seen`, `sentence_removed`, `sentence_modified`, `sentence_reintroduced` |
| **Citations** | `citation_added`, `citation_removed`, `citation_replaced` |
| **Templates** | `template_added`, `template_removed`, `template_parameter_changed` |
| **Sections** | `section_reorganized`, `lead_promotion`, `lead_demotion` |
| **Reverts** | `revert_detected`, `edit_cluster_detected` |
| **Links & categories** | `wikilink_added`, `wikilink_removed`, `category_added`, `category_removed` |
| **Page metadata** | `page_moved`, `protection_changed` |
| **Talk page** | `talk_page_correlated`, `talk_thread_opened`, `talk_thread_archived`, `talk_reply_added`, `talk_activity_spike` |

## Who this is for

- **Investigative journalists** — trace how a claim about a public figure evolved
  across revision history: when it was added, who softened it, when sources
  appeared or disappeared
- **Wikipedia editors** — audit how policy templates (NPOV, BLP, due-weight)
  correlate with content changes over time
- **Data scientists & researchers** — deterministic features for edit-quality
  models, sourcing-behavior studies, content-drift measurement
- **OSINT analysts** — structured event streams from public editorial history,
  reproducible on request
- **Fan wiki communities** — canon disputes, headcanon drift, content-fork
  detection across MediaWiki instances
- **AI/ML teams** — training data curation (include stable, well-sourced claims; exclude contested or source-fragile ones), provenance-aware RAG, temporal leakage detection in training corpora
- **Regulatory & compliance monitors** — track changes to drug safety pages, guideline entries, and policy language for early signals of institutional shifts
- **Knowledge graph engineers** — extract entity and relationship changes across revision history for evolving ontologies
- **Publishers & platform trust teams** — monitor how claims spread, get cited, and stabilize across the public record

## What downstream systems build

Each consumer brings their own interpretation layer on top of Refract's deterministic event stream:

| Consumer | They build | How they use Refract |
|----------|-----------|---------------------|
| **Healthcare claim review** | Review-ready briefs answering "does this claim still hold up against the current evidence?" | Feed structured events (wording, citations, guidelines, labels, and policies) into claim-review workflows. |
| **AI training data curation** | Training datasets filtered by claim stability | Score each claim by revert count, citation churn, talk page correlation, and template dispute history from the event stream. Include only claims above a stability threshold. |
| **Provenance-aware RAG** | Retrieval that weights results by claim stability | Enrich each retrieved chunk with its claim history — stable, recently changed, source-fragile, contested. The RAG system uses the signal to filter or demote low-confidence results. |
| **Regulatory monitoring** | Early-warning dashboards for policy changes | Run `refract cron` on drug pages, guideline entries, and regulatory topics. When new events fire (citation removal, template dispute, section reorganization), alert the monitoring team with the structured diff. |
| **Competitive intelligence** | Cross-jurisdiction claim divergence maps | Use `refract diff` to compare the same topic across wikis (English vs German Wikipedia, Fandom vs independent wiki). Track how framing differs and when it diverged. |
| **Fact-checking** | Claim provenance timelines | Given a claim text, query its lifecycle across the event stream — first appearance, source additions, revert history, talk page correlation, stabilization time. Return a verifiable timeline. |
| **Academic research** | Large-scale knowledge dynamics studies | Export `ObservationReport` with Merkle-verifiable claim histories. Run cohort analyses on claim stability across topics, time periods, and editorial environments. |
| **Journalism forensics** | Edit pattern analysis for public figures | Track how a specific claim about a person or topic evolved. Look for coordinated editing, source softening, or removal without replacement. |
| **Fan wiki canon tracking** | Canon divergence detection across competing wikis | Compare the same fictional universe's page across Fandom and independent wikis. Detect when one wiki retcons content while the other doesn't — and by how much. |
| **Knowledge graph engineering** | Evolving ontologies from category and link changes | Use `refract analyze --depth forensic` to capture category_added/removed and wikilink_added/removed events. Build an entity graph that evolves with the public record. |

The common architecture: **Refract extracts the mechanical facts. The downstream system interprets what those facts mean for its domain.** No interpretation enters Refract's pipeline; no consumer re-extracts from raw revision history.


## Why Refract over raw Wikipedia API?

You could write a script that calls the Wikipedia API and parses diffs.
Many people do. Here is what Refract gives you that a raw script does not:

| Raw API script | Refract |
|---------------|---------|
| You parse revision diffs | 26 deterministic event types, already classified |
| You track citations manually | Citation add/remove/replace with source lineage |
| You guess at section changes | Section-aware diffs with movement, promotion, demotion |
| You detect reverts by pattern matching | 6 regex patterns + edit cluster detection |
| You correlate talk pages by hand | Automatic talk-page correlation and activity spikes |
| Your output format is ad-hoc | Standardized JSON/NDJSON with deterministic event IDs |
| You write your own replay logic | Replay manifests with Merkle proofs for auditability |
| You maintain your own Wikipedia client | Rate limiting, retries, auth, pagination — built in |
| Your results change when you re-run | Byte-reproducible — same input, same output every time |
| You build your own timeline | Timeline builder with claim lifecycle tracking |

Refract is the Wikipedia analysis code you would otherwise write and maintain
yourself — a revision fetcher, section, citation and template parsers, a revert
detector — packaged as versioned, tested libraries.
`examples/04-from-scratch-to-refract.ts` lists those pieces and then runs the
Refract analyzers that replace them.


## Complementary technologies

The event stream is standard NDJSON — anything that reads JSON or speaks HTTP can consume it. See the [integrations docs](https://refract-org.github.io/refract-docs/integrations/) for full details.

| Category | Technology | How they fit |
|----------|-----------|-------------|
| **Python / data science** | pandas, Jupyter, matplotlib | `refract-py` wraps the CLI and exports typed DataFrames. [Tutorial](https://refract-org.github.io/refract-docs/tutorials/python-sdk/) |
| **Vector databases** | Pinecone, Weaviate, pgvector | Store claim embeddings alongside stability metadata. Query: "find claims like X that are stable and well-sourced." |
| **RAG frameworks** | LangChain, LlamaIndex | Use Refract's stability signals as retrieval filters or reranking features. [LangChain loader](https://github.com/refract-org/refract-py/blob/main/src/refract_langchain.py) available in refract-py. |
| **AI coding agents** | Claude Code, Cline, Codex CLI, OpenClaw | Agents connect via Refract's built-in MCP server (`refract mcp`) to read claim history and cite provenance. |
| **MCP (Model Context Protocol)** | Any MCP client | `refract mcp` is a native MCP server with tools for analyze, claim, export, cron, and classify. |
| **Data query** | DuckDB, ClickHouse | Query NDJSON output with SQL: `SELECT event_type, count(*) FROM 'events.jsonl' GROUP BY event_type;` |
| **Monitoring** | Slack, Email, Webhooks, GitHub Actions | `refract cron` + `--notify-slack` for scheduled monitoring with alerts. [Tutorial](https://refract-org.github.io/refract-docs/tutorials/scheduled-monitoring/) |
| **Streaming** | Kafka, Redpanda, Cloudflare Queues | Each `EvidenceEvent` is a message keyed by claimId for real-time monitoring. |
| **Visualization** | Observable Framework, Mermaid, D3 | `refract visualize --format mermaid` produces Mermaid diagrams. |
| **Model serving** | OpenAI API, DeepSeek, Ollama, vLLM, Workers AI | Any OpenAI-compatible endpoint plugs into `refract classify`. Workers AI runs at the edge. |
| **Local inference** | WebGPU, MLX, llama.cpp | Run detection models on-device — no API key needed. Refract defaults are mechanical; any boundary can use a local model via Ollama or MCP sampling. |
| **Notebooks** | Jupyter, Marimo, Observable | Load events into a DataFrame: `pd.read_json("events.jsonl", lines=True)`. |
| **Serverless** | Cloudflare Workers, D1, R2 | Import the library packages in a Worker (`nodejs_compat`; `evidence-graph` uses `node:crypto`). The CLI needs Node or Bun, so a Worker cannot run it — schedule it on a runner and load its NDJSON into D1 or R2. |

## More commands

```bash
# 1. Run the guided onboarding (recommended first step)
npx @refract-org/cli init

# 2. Analyze any page
npx @refract-org/cli analyze "Bitcoin" --depth brief

# 3. Open the local web explorer (starts a server at localhost:8899)
npx @refract-org/cli explore "Bitcoin"

# 4. Print events as JSON lines for your own tools (one event per line)
npx @refract-org/cli analyze "Bitcoin" --depth brief --json | head -1 | jq .

# 5. Export as structured data
npx @refract-org/cli export "Bitcoin" --format ndjson > bitcoin-events.ndjson
```

> **What you're seeing**: Refract reports deterministic, reproducible claim and citation changes. It does not decide whether a change is true or important — that's for downstream applications.


> For repeated use, install the package once with `bun add @refract-org/cli`
> rather than resolving it through `npx` on every run.

### Other install options

| Method | Command |
|--------|---------|
| **Bun** | `bunx @refract-org/cli analyze "Bitcoin"` |
| **Local install** | `bun add @refract-org/cli && refract analyze "Bitcoin"` (or `wikihistory`) |
| **Build from source** | `git clone https://github.com/refract-org/refract && cd refract && bun install && bun run build` |

### Use individual packages

```bash
bun add @refract-org/evidence-graph @refract-org/analyzers
```

```ts
import type { EvidenceEvent, Revision } from "@refract-org/evidence-graph";
import { sectionDiffer, citationTracker } from "@refract-org/analyzers";
```

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| `@refract-org/evidence-graph` | [![npm](https://img.shields.io/npm/v/@refract-org/evidence-graph)](https://www.npmjs.com/package/@refract-org/evidence-graph) | Core types, schemas, BYO-inference boundaries |
| `@refract-org/ingestion` | [![npm](https://img.shields.io/npm/v/@refract-org/ingestion)](https://www.npmjs.com/package/@refract-org/ingestion) | Wikimedia API adapters — fetching, diffing, rate limits |
| `@refract-org/analyzers` | [![npm](https://img.shields.io/npm/v/@refract-org/analyzers)](https://www.npmjs.com/package/@refract-org/analyzers) | Deterministic analyzers — sections, citations, reverts, templates |
| `@refract-org/mcp` | — (first published with the next release) | MCP tool definitions and server; the executable is `refract mcp` from `@refract-org/cli` |
| `@refract-org/cli` | [![npm](https://img.shields.io/npm/v/@refract-org/cli)](https://www.npmjs.com/package/@refract-org/cli) | CLI tool — `refract` / `wikihistory` commands, `classify` inference |
| `@refract-org/persistence` | — | Local SQLite persistence (bun:sqlite, not published) |
| `@refract-org/eval` | [![npm](https://img.shields.io/npm/v/@refract-org/eval)](https://www.npmjs.com/package/@refract-org/eval) | Evaluation harness — ground truth validation and benchmarks |

## How it compares

Refract tracks **claim provenance** — structured evidence linking a claim's lifecycle
to specific revisions, sources, and policy signals. It complements existing tools:

| Tool | What it does | What Refract adds |
|------|-------------|-----------------|
| **WikiWho** | Sentence-level authorship (who wrote which token) | Sentence lifecycle: when a sentence first appeared, was removed, rewrote, or was reintroduced |
| **ORES** | ML edit quality scores (likely damaging, good-faith) | Deterministic edit classification + policy-coded signals |
| **XTools** | Edit stats, page history summaries, top editors | Structured event stream: section changes, citation turnover, template diffs, page moves, category shifts |
| **PetScan** | Category intersection queries across pages | Category evolution per-page over time |

## Architecture

The engine follows a two-knowledge-split:

1. **Deterministic**: Wikipedia API ingestion, diff computation, section
   extraction, citation tracking, template classification, revert detection —
   byte-reproducible, no model involved.
2. **Outcome labels**: Independently sourced ground truth (talk page
   consensus, page protection events) — never redefined by the pipeline.

[Full architecture](./ARCHITECTURE.md)

## Configurable heuristics / BYO-inference boundaries

Every analyzer threshold is a typed function signature where a model can replace the default heuristic. The defaults work offline with no configuration required:

| Boundary | Default (mechanical) | Plug in a model to decide |
|----------|----------------------|---------------------------|
| Sentence similarity | Word-overlap ratio (0.8) | "Are these two sentences the same claim?" |
| Revert detection | 6 regex patterns | "Is this edit comment a revert?" |
| Template classification | Name-to-type lookup | "What policy signal does this template represent?" |
| Edit cluster detection | Time window + min size | "Are these edits semantically related?" |
| Heuristic classification | Size thresholds + comment patterns | "What kind of edit is this?" |

Pass overrides via `--config` file or inline CLI flags (`--similarity`, `--spike-factor`, `--cluster-window`, etc.). The effective parameters are recorded in each event's `FactProvenance.parameters` when non-default values are used.

```bash
# Domain-tuned: Fandom wikis have tighter edit clusters
refract analyze "Darth_Vader" --api https://starwars.fandom.com/api.php --cluster-window 30 --similarity 0.85
```

## Private instances

Refract connects to any MediaWiki instance — corporate wikis, institutional
knowledge bases, private fan wikis. Use the `--api` flag with the wiki's
`api.php` URL.

### Authentication

| Method | CLI flags | Description |
|--------|-----------|-------------|
| Bearer token | `--api-key <token>` | Sends `Authorization: Bearer <token>` with every request |
| Basic auth | `--api-user <user> --api-password <pass>` | Sends HTTP basic auth credentials |
| Client credentials | `REFRACT_OAUTH_CLIENT_ID` + `REFRACT_OAUTH_CLIENT_SECRET` env vars | Sends `X-OAuth-Client-Id` and `X-OAuth-Client-Secret` headers (custom headers for wikis behind a gateway that expects them; not an OAuth 2.0 flow) |

All three methods work with every command:

```bash
# Bearer token
refract analyze "Page" --api https://corp-wiki.example.com/w/api.php --api-key "sk-..."

# Basic auth
refract analyze "Page" --api https://corp-wiki.example.com/w/api.php --api-user "admin" --api-password "..."

# Client-credential headers (via env vars)
REFRACT_OAUTH_CLIENT_ID="..." REFRACT_OAUTH_CLIENT_SECRET="..." \
  refract analyze "Page" --api https://corp-wiki.example.com/w/api.php
```

Credentials are never logged or exposed in error messages.

### Local Docker testing

A Docker Compose setup is available for testing against a local MediaWiki
instance with auth:

```bash
cd docker
docker compose up -d
DOCKER_TESTS=true bun run test
```

This starts MediaWiki at `http://localhost:8080` and an nginx proxy with basic
auth at `http://localhost:8081`. The auth integration tests validate bearer
token, basic auth, and OAuth2 paths.

## Beyond Wikipedia

Refract works on any public MediaWiki instance — Fandom.com, independent fan wikis,
private wikis. Wikipedia's editorial norms suppress the most interesting dynamics;
fandom wikis don't.

| Dynamic | What Refract captures |
|---------|-------------------|
| **Canon disputes** | `category_removed`: `Canon characters` → `category_added`: `Legends characters` after the 2014 Disney acquisition |
| **Headcanon drift** | "Vader turned because of fear of loss" vs "pride and ambition" — reversibly edited, both cite the same films |
| **Warring wikis** | Cross-wiki diff detects a Game of Thrones Fandom wiki fork vs parallel evolution on an independent ASOIAF wiki |
| **Decade-spanning consensus** | 2008 talk page consensus about what's canon, overturned in 2023 — L3 outcome labels with temporal validity windows |

## Why it exists

A snapshot of a page cannot tell you:

1. **Where it appeared** — when a claim first entered the public record
2. **How it changed** — every addition, removal, reintroduction, and in-place modification
3. **What was tagged** — policy templates, dispute signals, maintenance markers
4. **What was reverted** — every revert, edit cluster, concentrated contestation
5. **What moved** — section reorganization, lead promotion, category shifts, page moves
6. **What was discussed** — correlated talk page activity, thread lifecycle, activity spikes

Refract emits an event type for each of these; see [What Refract captures](#what-refract-captures).

---

## What it is not

| Category | Why |
|----------|-----|
| Truth detector | Reports what changed, not whether the change is accurate |
| Model interpreter | No LLM in the pipeline — interpretation lives downstream in consumers |
| Editor quality judge | No scoring, ranking, or profiling of individual editors |
| Prediction engine | No forecasting, no sentiment analysis, no trend extrapolation |
| Live monitor | Polling-based, not real-time — use `cron` mode for scheduled observation |
| Healthcare scorer | Domain-agnostic by design — no clinical, regulatory, or payer logic |

## License

AGPL-3.0. See [LICENSE](./LICENSE).

If you modify this software and deploy it as a network service, you must release
your modifications.

**Commercial use:** NextConsensus offers commercial licenses for proprietary
integration without AGPL obligations. See [nextconsensus.com](https://nextconsensus.com).

## Community

- [Contributing](./CONTRIBUTING.md) — how to get started
- [Good first tasks](./ROADMAP.md) — ready-to-pick-up work items
- [Discussions](https://github.com/refract-org/refract/discussions) — questions, ideas
- [Code of Conduct](./.github/CODE_OF_CONDUCT.md)
- [Security](./.github/SECURITY.md)
- [Changelog](./CHANGELOG.md)
- [Cite this software](./CITATION.cff)

## Ecosystem

These repos extend the core engine:

| Repo | Purpose |
|------|---------|
| [refract-docs](https://github.com/refract-org/refract-docs) | Public documentation site — [integrations](https://refract-org.github.io/refract-docs/integrations/), quickstart, CLI, SDK, tutorials |
| [refract-labs](https://github.com/refract-org/refract-labs) | Experimental probes applying the engine to adjacent verticals |
| [refract-ui](https://github.com/refract-org/refract-ui) | Standalone visualization — load JSONL, render timelines, diffs, citations |
| [refract-demo-data](https://github.com/refract-org/refract-demo-data) | Safe, fictional datasets for the eval harness (no real PII or medical data) |
| [refract-py](https://github.com/refract-org/refract-py) | Python SDK — typed dataclasses and pandas integration for ML workflows |

### Position in the revisable-delegation loop

Refract is one of five systems that each hold a step of the loop an institution runs when it delegates consequential work to machines: believe, know what can be done, decide what authority is justified, act, detect mismatch, revise. Refract holds the **detect mismatch** step: it reports that a source changed, and nothing more. The shared record shape for the loop is [STD-07, the Revisable Delegation Record](https://ethotechnics.org/standards/std-07-revisable-delegation-record).

- **Canonical export**: `EvidenceEvent`, the versioned event schema (see [`SCHEMA_VERSIONING.md`](./SCHEMA_VERSIONING.md)), as NDJSON or a Merkle-manifested bundle. In STD-07 terms an `EvidenceEvent` is the raw material for a `discrepancy` record: what the prior revision said, what the new one says, and the revision that is the source.
- **Refract still does not decide which change matters**, and the conversion is built so that it cannot. `toDiscrepancyStream(events, decide)` in `@refract-org/evidence-graph` takes a callback that returns, per event, either the context for a discrepancy record or `null`. That callback is the judgment and it belongs to the caller: the `expected` clause is the assumption that was violated, which lives in the record that made it, and the `subject` is the name the *receiving* system knows the thing by, which Refract cannot know either. **No default is shipped for `decide`**, because a default would be Refract deciding after all — quietly, and for everyone. What the package supplies is the shape, the canonical hashing, and the `prior_hash` chaining, so a consumer does not reimplement STD-07 §5 from the specification.
- **`refract delegation <page> --subject --expected --when [--section] [--out]`** is that judgment made once by an operator and then applied repeatably. All three of `--subject`, `--expected` and `--when` are required and none has a default; `--when` names a predicate over fields the event already carries (`weakening`, `strengthening`, `direction-changed`, `citation-removed`, `any`), and the operator picks one. `--when any` is a legitimate answer — every change on this page violates that expectation — and it is still a choice someone made rather than a behaviour that arrived switched on. With `--out` it writes the file a consumer reads on a schedule.
- **A detect-only stream stops at conformance Level 1, and that is not a defect.** Measured against the [published checker](https://ethotechnics.org/diagnostics/record-conformance), a stream of nothing but discrepancies is held below Level 2 by "a discrepancy was never answered" — correctly, because answering is what the system that made the assumption does, and Refract is not that system. The level describes a loop, not a component; a Refract stream reaches Level 2 in the company of the answers its consumer writes.
- **Wired to**: [NextConsensus](https://nextconsensus.com), which consumes the `@refract-org/analyzers`, `@refract-org/evidence-graph`, and `@refract-org/ingestion` packages through one adapter file — documented in [`docs/refract-and-nextconsensus.md`](./docs/refract-and-nextconsensus.md) and [`docs/repository-boundary.md`](./docs/repository-boundary.md). A second edge now runs on its own once two declarations are made: `refract delegation … --out <file>` writes the stream, and [Ambit](https://github.com/zz-plant/ambit)'s `ambit delegation source add` declares that file, after which every `ambit verify` reads it. Nothing in this repository schedules the write — a cron or CI job on the operator's side does — and Ambit deliberately does not fetch, so the file is the seam between them.
- **Siblings**: [Ambit](https://github.com/zz-plant/ambit) (capability and authorization), [Whether](https://github.com/zz-plant/whether) (act), [Ethotechnics](https://ethotechnics.org) (the record shape and the vocabulary).

### Related projects

- [**Stims**](https://github.com/zz-plant/stims) — Browser music visualizer inspired by MilkDrop
- [**sabnzbd-mcp**](https://github.com/zz-plant/sabnzbd-mcp) — MCP server for SABnzbd (zero deps)
- [**neckass**](https://github.com/zz-plant/neckass) — Privacy-first headline generator
- [**ethotechnics.org**](https://github.com/zz-plant/ethotechnics.org) — Open framework for the operational accountability of high-stakes AI systems; publishes the record shape Refract's siblings share (see below)
