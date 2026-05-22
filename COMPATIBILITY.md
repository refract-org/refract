# Cross-Repo Compatibility Matrix

When updating `@refract-org/*` packages, downstream repos must be checked for compatibility. This document defines the dependency chain and what breaks where.

## Dependency Order

```
@refract-org/evidence-graph  (types, schemas — no deps)
    ├── @refract-org/ingestion       (MediaWiki client)
    ├── @refract-org/analyzers       (deterministic analyzers)
    │       ├── @refract-org/cli              (CLI tool)
    │       │       └── refract-py            (Python SDK — wraps CLI)
    │       ├── @refract-org/persistence      (SQLite storage)
    │       └── @refract-org/eval             (evaluation harness)
    └── @refract-org/observable       (Observable data loader)
```

## Version Matrix

| Package | Version | Downstream Consumers | Breaking Change Risk |
|---|---|---|---|
| `@refract-org/evidence-graph` | 0.4.x | All packages + `labs/` | **High** — EventType changes break all consumers |
| `@refract-org/ingestion` | 0.4.x | CLI | **Medium** — API changes break CLI |
| `@refract-org/analyzers` | 0.4.x | CLI + persistence + eval + `labs/` | **Medium** — analyzer output changes break consumers |
| `@refract-org/cli` | 0.5.x | refract-py | **Low** — CLI flag changes break Python SDK |
| `@refract-org/eval` | 0.4.x | None (internal) | **Low** |
| `@refract-org/persistence` | 0.4.x | None (internal, not published) | **Low** |

## External Consumer Versions

| Repo/Dir | Depends On | Current Version | Update When |
|---|---|---|---|
| `labs/` (monorepo) | `@refract-org/evidence-graph@^0.2.0`, `@refract-org/analyzers@^0.2.0` | — | evidence-graph or analyzers bump |
| `demo-data/` (monorepo) | JSONL format matching evidence-graph types | — | EvidenceEvent schema change |
| refract-ui | Types mirrored locally from evidence-graph | — | EventType or EvidenceEvent schema change |
| refract-py | Wraps `@refract-org/cli` via subprocess | — | CLI flag additions/removals |
| refract-docs | References CLI examples and schema | — | CLI flag changes or schema version bumps |

## What Breaks When

### evidence-graph EventType changes

**If you add a new event type:**
- refract-ui: add to local type definitions in `src/types.ts`
- `labs/`: update any probe that filters by event type
- refract-docs: update schema.md and events.md
- refract-py: no change (dataclasses are generic)
- `demo-data/`: update JSONL files if they should include the new type

**If you rename an event type:**
- BREAKING for all consumers. Create a migration guide.
- `labs/` probes may use old names (e.g., `claim_first_seen` → `sentence_first_seen`)
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
| 0.5.x | 0.4.x | `"0.4.0"` |
| 0.4.x | 0.3.x | `"0.3.0"` |
| 0.3.x | 0.2.x | `"0.2.0"` |

Consumers SHOULD accept events with the same minor schema version and MAY accept across minor versions if they handle unknown EventType members gracefully.
