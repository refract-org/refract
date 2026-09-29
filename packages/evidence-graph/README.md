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

A replay manifest (input revision hashes, output event hashes and their Merkle root), the events, and a Merkle inclusion proof per event hash, in one object. Nothing in a bundle is signed.

- `createVerificationBundle(...)` — package a replay manifest, its events, and Merkle proofs
- `verifyVerificationBundle(bundle)` — recompute the manifest hash and the Merkle root from the manifest's event hashes, compare the event count, and check that each proof hashes to the root it records (the events themselves are not rehashed, and a proof's root is not compared with the manifest's)
- `hashLeaf`, `getMerkleProof`, `verifyMerkleProof` — the proof primitives
- Types: `ReplayManifest`, `MerkleProof`, `VerificationBundle`

```ts
import type { EvidenceEvent, Revision } from "@refract-org/evidence-graph";
import { createClaimIdentity, createVerificationBundle } from "@refract-org/evidence-graph";
```

[Refract](https://github.com/refract-org/refract) · [Docs](https://github.com/refract-org/refract-docs) · [npm](https://www.npmjs.com/package/@refract-org/evidence-graph)
