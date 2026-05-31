# Repository Boundary

Refract is open-source core observability for MediaWiki and public revision histories.
Refract observes change across time. Healthcare-specific logic lives in private repos.

## In Scope

- Fetching and replaying MediaWiki revision histories.
- Deterministic extraction of what changed between revisions.
- Provenance records for claims, sources, page structure, links, categories,
  templates, talk-page references, and page moves.
- Claim-state timelines: structured records of how claims evolved across revisions.
- Optional model-assisted interpretation that receives only extracted evidence
  and emits bounded labels with confidence.
- Generic benchmarks that check whether Refract detected publicly observable
  revision-history events.
- Connectors for public or user-controlled MediaWiki instances.

## Out of Scope

- Healthcare-specific logic: claim supportability thresholds, jurisdiction
  routing, authority-weighting, clinical source ranking, bitemporal gap
  detection, ClaimUse context mapping, and review workflow triggers.
- Claims that Refract determines truth, predicts external events, or ranks people.

## Test

A valid Refract contribution should be useful for observing public-knowledge change
on Wikipedia, Fandom, or another MediaWiki instance — across time, not just at the
current revision — without relying on healthcare context or private decision criteria.
