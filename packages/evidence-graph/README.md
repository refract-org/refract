# @refract-org/evidence-graph

Core types and schemas. Zero runtime dependencies.

```bash
bun add @refract-org/evidence-graph
```

## Exports

### Types

- `ClaimIdentity`, `ClaimLineage`, `ClaimState`, `ClaimObject` — claim tracing
- `EvidenceEvent`, `DeterministicFact`, `EvidenceLayer` — event model
- `SourceRecord`, `SourceLineage`, `SourceReplacement`, `SourceType`, `SourceAuthority` — citation tracking
- `Report`, `ReportLayer`, `ReportLayerLabel`, `ExportFormat`, `Depth`, `PageTimeline`, `TimelineEvent`, `PolicySignal` — report assembly
- `Revision`, `DiffResult`, `DiffLine`, `Section`, `SectionChange` — revision model

### Functions

- `createClaimIdentity(pageTitle, claimText)` — deterministic hash for claim dedup
- `createEventIdentity(pageTitle, eventType, revisionRange)` — deterministic event fingerprint

```ts
import type { EvidenceEvent, Revision } from "@refract-org/evidence-graph";
import { createClaimIdentity } from "@refract-org/evidence-graph";
```

[Refract](https://github.com/refract-org/refract) · [Docs](https://github.com/refract-org/refract-docs) · [npm](https://www.npmjs.com/package/@refract-org/evidence-graph)
