---
id: CLI-REVIEW-01
status: done
priority: high
dependencies: []
packages: ["evidence-graph", "ingestion", "persistence", "cli"]
layer: L1
effort: large
---

# Saved source review

## What

Make repeated review of known MediaWiki sources a complete CLI workflow: observe
since the last acknowledged revision, inspect full text and provenance, then
acknowledge the saved report without fetching newer edits.

## Why

A revision stream alone leaves consumers to maintain review baselines, recover
interrupted runs, add source context, and distinguish empty output from missing
history. Passage status must describe the latest observed revision.

## Implementation

- Atomic JSON state and reports with separate reviewed and fetched cursors.
- Watchlists, source-scoped entry identities, resumable pending inputs, and stale-report checks.
- Markdown/JSON reports, mechanical view filters, full text, source links, and offline sample.
- Parent and content-availability metadata, bounded cache selection, and captured explorer inputs.
- Shared passage status implementation and matching uncertainty in CLI/MCP.
- Documentation and a real-user fit assessment protocol.

## Invariants

- Deterministic observation; interpretation stays with the consumer.
- Fetching never acknowledges revisions.
- No text comparisons across known missing parents or unavailable text.
- Native event identity is preserved; review entry identity includes the source.
- Incomplete reports cannot advance a reviewed cursor.

## Acceptance

- [x] Review, resume, filtering, acknowledgment, and subsequent edits pass offline and compiled CLI checks.
- [x] Latest passage absence and uncertainty pass regression checks through CLI/MCP.
- [x] Explorer preserves captured ranges and exposes coverage.
- [x] Captured examples regenerate identically.
- [x] Core build, Biome, typecheck, boundary, tests, and packed-consumer gates pass.

Real-user demand and time savings are not established by these checks. The guide
provides a repeat-review protocol for assessing fit with actual users.

## Validation

- Core build, Biome, typecheck, architecture boundary, and packed-consumer gates passed.
- 148 suites passed with 1,109 passing tests; live suites are skipped in the default gate.
- Separate live MediaWiki contract run passed 9 tests.
- Compiled CLI watchlist tests cover filtering, acknowledgment without fetching, and later edits.
- A Node consumer installed from six local package tarballs completed the offline review, acknowledgment, and quiet next review.
- SQLite migration was checked against an actual database with the prior schema.
- All three example capture scripts passed byte-comparison checks; 99 relative documentation links and anchors passed.

The source changes have not been published. Real-user fit remains unmeasured.
