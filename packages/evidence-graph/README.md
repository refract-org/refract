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

### Verification bundles (0.5.1+)

Merkle-tree proofs that an analysis output came from a given set of inputs, verifiable offline later.

- `createVerificationBundle(...)` — package a replay manifest, its events, and Merkle proofs
- `verifyVerificationBundle(bundle)` — re-check leaf hashes, manifest hash and proof chains against the Merkle root
- `hashLeaf`, `getMerkleProof`, `verifyMerkleProof` — the proof primitives
- Types: `ReplayManifest`, `MerkleProof`, `VerificationBundle`

```ts
import type { EvidenceEvent, Revision } from "@refract-org/evidence-graph";
import { createClaimIdentity, createVerificationBundle } from "@refract-org/evidence-graph";
```

[Refract](https://github.com/refract-org/refract) · [Docs](https://github.com/refract-org/refract-docs) · [npm](https://www.npmjs.com/package/@refract-org/evidence-graph)
