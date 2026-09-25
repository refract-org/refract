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
  detection, claim-context mapping, and review workflow triggers.
- Claims that Refract determines truth, predicts external events, or ranks people.

## Test

A valid Refract contribution should be useful for observing public-knowledge change
on Wikipedia, Fandom, or another MediaWiki instance — across time, not just at the
current revision — without relying on healthcare context or private decision criteria.

## Enforcement

This boundary is not a convention. `scripts/check-boundaries.ts` runs as
`bun run check:boundaries`, in the `gate` job of `.github/workflows/ci.yml`, on every
pull request and every push to `main`. A violation exits non-zero and fails the build.

It enforces two separate rules:

1. **No domain vocabulary in the open-source tree.** A word list — `payer`, `clinical`,
   `guideline`, `formulary`, `FDA`, `PubMed`, `pharma`, `ticker`, `materiality` and
   others — is rejected anywhere under `packages/`, `examples/` or `scripts/`, in code,
   JSON, shell and Markdown alike. `docs/` is outside the scan, which is the only reason
   this file can name the terms it forbids. The list lives at the top of the script;
   extend it there when a new domain term starts leaking rather than arguing the case in
   review.

2. **No upward imports from ingestion.** `packages/ingestion` may not import
   `@refract-org/analyzers` at all, nor `@refract-org/evidence-graph` at runtime — types
   are fine. Raw data access must not depend on the interpreted layers above it.

The first rule is why this document can be believed by someone who has not read the
code: the terms it forbids are the terms a healthcare fork would have to introduce, and
introducing one turns the build red rather than starting a discussion.
