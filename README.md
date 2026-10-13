<div align="center">

# Refract

**Refract gives mutable knowledge a memory.**

Temporal observability for knowledge: structured, deterministic observations of changes across available revision histories.

[![CI](https://github.com/refract-org/refract/actions/workflows/ci.yml/badge.svg)](https://github.com/refract-org/refract/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/release/refract-org/refract)](https://github.com/refract-org/refract/releases)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-0f172a.svg)](./LICENSE)
[![Bun](https://img.shields.io/badge/bun-%3E%3D1.3-black?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![Discussions](https://img.shields.io/badge/discussions-welcome-8b5cf6?style=flat-square)](https://github.com/refract-org/refract/discussions)

</div>

---

## What does it do?

Given a Wikipedia article or compatible MediaWiki instance, Refract analyzes revisions and emits a deterministic event stream showing **what changed, when, and how**: changes to sentences, citations, sections, and document structure.

```bash
npx @refract-org/cli analyze "Semaglutide" --depth brief
```

```txt
Analyzing "Semaglutide" at depth: brief...
Fetching revisions from Wikipedia...
Fetched 20 revisions.

────────────────────
  Analysis Results
────────────────────
  Page:    Semaglutide
  Events:  203

  ○ section changed (rev 714793761→714794084) [(lead)]
  ● sentence introduced (rev 714794084→740186843) [(lead)]
  ● sentence removed (rev 714794084→740186843) [(lead)]
  ◆ citation added (rev 740186843→781025475) [body]
```

No LLM is called in the observation pipeline. The same captured inputs, analyzer versions, and configuration produce byte-reproducible event streams. A [hash-pinned ground-truth corpus](BENCHMARK.md#ground-truth-corpus) of 15,926 events across ten benchmark pages ships as a [release asset](https://github.com/refract-org/refract/releases/tag/benchmark-corpus-2026-08-27).

---

## Quick Start

### Prerequisites

- Node.js 20+ or Bun 1.3+
- A Wikipedia or MediaWiki article title (pass `--api <url>` for non-English/private wikis)

### 1. One-shot Analysis

```bash
# Run directly via npx
npx @refract-org/cli analyze "Artificial intelligence" --depth brief

# Or install globally
npm install -g @refract-org/cli
refract analyze "Quantum computing" --depth forensic
```

### 2. Python SDK

```bash
pip install git+https://github.com/refract-org/refract-py.git
```

```python
from refract import Refract

r = Refract()
events = r.analyze("Bitcoin", depth="brief")
for event in events:
    print(event.eventType, event.timestamp)
```

### 3. Model Context Protocol (MCP)

Run the bundled MCP server for Cursor, Claude Desktop, or Antigravity:

```bash
refract mcp
```

See [docs/mcp.md](./docs/mcp.md) for client configuration snippets.

---

## Monorepo Architecture

```
refract/
├── packages/
│   ├── evidence-graph/    # Types, schemas, identity & hash verification
│   ├── ingestion/         # MediaWiki client, pagination, retries & auth
│   ├── analyzers/         # Deterministic revision diffing & enrichment
│   ├── cli/               # CLI commands, output formatters & local browser
│   ├── mcp/               # Model Context Protocol server implementation
│   ├── persistence/       # SQLite local caching and revision store
│   └── eval/              # Evaluation harness & benchmark verification
└── docs/                  # Architecture specs, recipes & boundary definitions
```

---

## Development & Testing

Build and test from source:

```bash
git clone https://github.com/refract-org/refract.git
cd refract
bun install
bun run build
bun test
bun run lint
```

Run CLI directly from source:

```bash
node packages/cli/dist/src/cli.js analyze "Machine learning" --depth brief
```

---

## Packages

| Package | Role |
| :--- | :--- |
| `@refract-org/evidence-graph` | Types, schemas, identity and verification primitives |
| `@refract-org/ingestion` | MediaWiki access, pagination, retries, and authentication |
| `@refract-org/analyzers` | Deterministic revision comparisons and enrichment |
| `@refract-org/cli` | Commands and the local browser explorer |
| `@refract-org/mcp` | MCP library; executable is `refract mcp` from CLI |
| `@refract-org/persistence` | Local SQLite persistence; not published |
| `@refract-org/eval` | Evaluation harness and independently sourced labels |

---

## Position in the Revisable Delegation Loop

Refract holds the **detect mismatch** step in the [STD-07 Revisable Delegation Record](https://ethotechnics.org/standards/std-07-revisable-delegation-record) loop. It identifies what changed without deciding whether a change matters: downstream consumers supply the predicate and domain interpretation.

- **Wired to**: [NextConsensus](https://nextconsensus.com) and [Ambit](https://github.com/zz-plant/ambit) via [`docs/refract-and-nextconsensus.md`](./docs/refract-and-nextconsensus.md) and [`docs/repository-boundary.md`](./docs/repository-boundary.md).
- **Siblings**: [Ambit](https://github.com/zz-plant/ambit) (capability and authorization), [Whether](https://github.com/zz-plant/whether) (act), [Ethotechnics](https://ethotechnics.org) (record shape and vocabulary).

---

## Documentation & Recipes

- [docs/README.md](./docs/README.md): Documentation hub
- [docs/recipes.md](./docs/recipes.md): Step-by-step recipes (inspecting historical records, building review feeds)
- [docs/events.md](./docs/events.md): Schema specifications for the 26 event types
- [docs/repository-boundary.md](./docs/repository-boundary.md): System boundaries and non-goals
- [ARCHITECTURE.md](./ARCHITECTURE.md): Verification scope, hashing, and Merkle proofs

---

## License

**AGPL-3.0**. See [LICENSE](./LICENSE).

If you modify this software and deploy it as a network service, you must release your modifications under AGPL-3.0.

**Commercial use:** NextConsensus offers commercial licenses for proprietary integration without AGPL obligations. See [nextconsensus.com](https://nextconsensus.com).
