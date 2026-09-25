# Cross-Repo Compatibility Matrix

When updating `@refract-org/*` packages, downstream repos must be checked for compatibility. This document defines the dependency chain and what breaks where.

## Dependency Order

```
@refract-org/evidence-graph      (types, schemas, hashing — no deps)
    ├── @refract-org/ingestion   (MediaWiki client, stream client, XML dumps)
    ├── @refract-org/analyzers   (deterministic analyzers)
    ├── @refract-org/eval        (evaluation harness)
    ├── @refract-org/mcp         (MCP tool definitions and server — also needs ingestion, analyzers)
    └── @refract-org/cli         (the `refract` command — needs all of the above; eval optional)
            └── refract-py       (Python SDK — wraps the CLI)

@refract-org/persistence         (bun:sqlite cache — private, loaded lazily by the CLI's --cache)
```

`bun run check:release` checks this order and the ranges along it: every internal
dependency names the sibling's version in this tree (`^x.y.z`), nothing published
depends on a private package, and a version already on npm carries the same source
as this tree. `publish.yml` publishes in the order the script prints.

## Version Matrix

| Package | In this tree | On npm (2026-09-25) | Downstream consumers |
|---|---|---|---|
| `@refract-org/evidence-graph` | 0.5.1 | 0.5.1 | every package; NextConsensus; refract-ui (mirrored types) |
| `@refract-org/ingestion` | 0.3.2 | 0.3.2 | mcp, cli; NextConsensus |
| `@refract-org/analyzers` | 0.5.1 | 0.5.1 | mcp, cli; NextConsensus |
| `@refract-org/mcp` | 0.1.0 | not published — blocks the cli publish | cli |
| `@refract-org/eval` | 0.2.2 | 0.2.1 | cli (optional) |
| `@refract-org/cli` | 0.5.16 | 0.5.7 — cannot start | refract-py, Docker image, operators |
| `@refract-org/persistence` | 0.1.1 | private | cli `--cache` from a source checkout |

**The CLI on npm does not run.** `@refract-org/cli@0.5.7` declares
`@refract-org/analyzers@^0.3.0` (0.3.x only, under npm's rule for 0.x) and imports
code that only exists in analyzers 0.5.0; forcing 0.5.0 fails on an ingestion export
that no published ingestion has. The 0.5.16 publish is pending on bootstrapping
`@refract-org/mcp` on npm (a new package — trusted publishing cannot authenticate it
until it exists), so until that lands, run the CLI from a source checkout. The three
library packages on npm — 0.5.1, 0.3.2, 0.5.1 — install and import normally and carry
the source of this tree.

## External Consumer Versions

| Repo/Dir | Depends On | Current Version | Update When |
|---|---|---|---|
| NextConsensus (`nextconsensus`, `nextconsensus-app`) | `@refract-org/analyzers@^0.5.0`, `@refract-org/evidence-graph@^0.5.0`, `@refract-org/ingestion@^0.3.1`, each through one adapter file per repo | 0.5.0 / 0.5.0 / 0.3.1 | any library release; see [docs/refract-and-nextconsensus.md](./docs/refract-and-nextconsensus.md) |
| `demo-data/` (monorepo) | JSONL format matching evidence-graph types | — | EvidenceEvent schema change |
| refract-ui | Types mirrored locally from evidence-graph | — | EventType or EvidenceEvent schema change |
| refract-py | Wraps `@refract-org/cli` via subprocess | — | CLI flag additions/removals |
| refract-docs | References CLI examples and schema | — | CLI flag changes or schema version bumps |

## What Breaks When

### evidence-graph EventType changes

**If you add a new event type:**
- refract-ui: add to local type definitions in `src/types.ts`
- refract-docs: update schema.md and events.md
- refract-py: no change (dataclasses are generic)
- `demo-data/`: update JSONL files if they should include the new type

**If you rename an event type:**
- BREAKING for all consumers. Create a migration guide.
- refract-ui type mirrors must be updated
- refract-docs schema reference must be updated

### CLI flag changes

- refract-py `_run()` method calls CLI with flags — any flag rename breaks the SDK
- refract-docs CLI reference page must be updated

### AnalyzerConfig changes

- `AnalyzerConfig` is exported from evidence-graph and used by CLI + eval
- New config fields are backward-compatible (optional)
- Renamed/removed config fields are breaking

## Schema Version Negotiation

See [SCHEMA_VERSIONING.md](./SCHEMA_VERSIONING.md) for the full policy on breaking vs. non-breaking changes.

As documented in `schema.md`:

| refract CLI | `@refract-org/evidence-graph` | `EVENT_SCHEMA_VERSION` |
|---|---|---|
| 0.5.15–0.5.16 | 0.5.1 | `"0.5.0"` |
| 0.5.0–0.5.7 | 0.4.x–0.5.0 | `"0.4.0"` |
| 0.4.x | 0.3.x | `"0.3.0"` |
| 0.3.x | 0.2.x | `"0.2.0"` |

Consumers SHOULD accept events with the same minor schema version and MAY accept across minor versions if they handle unknown EventType members gracefully.
