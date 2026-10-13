# Roadmap

Core revision analyzers are available. Current product work focuses on repeatable source review with inspectable observations.

## Source review workflow

Implemented in the source checkout; awaiting release:

- `review`: watchlists, separate fetched/reviewed cursors, resumable inputs, and acknowledgment of saved reports.
- Markdown and JSON reports with full changed text, source links, filters, and coverage.
- Shared captured analysis in the explorer and consistent bounded cache selection.
- Latest-revision passage status, candidate text, and explicit matching uncertainty through CLI and MCP.

[Workflow and fit assessment](./docs/review.md) · [Acceptance record](./.github/workqueue/CLI-REVIEW-01.md)

Real-user fit remains to be assessed with repeated reviews of sources people already depend on. The offline fixture and automated checks demonstrate implementation behavior.

## Agent Workstream Mapping

| Package | Workstream | Purpose |
|---------|-----------|---------|
| `evidence-graph` | Agent F | Event schema, 29 event types, deterministic hashing, replay manifests |
| `ingestion` | Agent A | MediaWiki REST client, rate limiter, XML dumps, Wikidata entity mapping |
| `analyzers` | Agents B/C/D/E | Section differ, citation tracker, revert detector, template tracker, claim differ, wikilink/category extractors, talk correlator, talk thread parser, edit cluster detector, talk activity spike detector, protection tracker, page move detector, heuristic classifier, observation differ |
| `cli` | Agent G | Commands for source review, analysis, comparison, export, and agent access |
| `persistence` | Agent G | SQLite storage (bun:sqlite) |
| `eval` | — | Evaluation harness: L3 ground truth validation (public) |
| `observable` | — | Observable Framework data loader (internal use) |

## What Refract Observes

Refract is a generic MediaWiki observation engine. The `--api` flag accepts any
`api.php` endpoint — Wikipedia, Fandom.com wikis, independent fan wikis, any
public MediaWiki instance. Revision history, diffs, talk pages, page moves,
categories, wikilinks — all extracted deterministically from the API response,
byte-for-byte reproducible.

Fandom wikis are the hardest public-domain stress test for the architecture:

**Canon disputes.** Multiple official canons coexist — Star Wars Legends vs.
Disney canon, DC Rebirth vs. New 52. Edits change which reality a page describes.
Tracking claims across revisions and correlating with talk page
discussions about sourcing reveals which canon an edit aligns with.

**Warring wikis.** The same topic has competing wikis — a Game of Thrones wiki
on Fandom.com vs. an independent Song of Ice and Fire wiki. Editors split and
fork. Cross-wiki diff distinguishes a fork event from parallel
independent development.

**Headcanon drift.** A contributor's personal interpretation seeps into article
text. Another editor reverts it citing no source. But "source" itself is
contested: is an author tweet canon? The revert detector fires, but the talk
page reveals the dispute is about what constitutes a source.

**Doctrinal edit wars.** "Darth Vader turned because of fear of loss" vs.
"...because of pride and ambition" — both supported by the same films, both
contradictory. The revision history shows back-and-forth edits; the talk page
reveals it's a dispute about character interpretation. Talk page correlation
surfaces the pattern.

**Time-deep.** 15+ year revision histories, decade-spanning talk page archives.
A 2008 consensus about what's canon gets overturned in 2023. L3 outcome labels
must carry temporal validity windows — a label that was correct in
2015 may be incomplete today.

Wikipedia's editorial norms suppress most of these dynamics. Fandom wikis don't.
That makes them the proving ground — if the engine handles fandom, it handles
anything.

## Status

**Phase 1: Complete.** All 18 workqueue items (L1-01 through L1-09, CW-01 through CW-05, INFRA-01 through INFRA-04) are shipped. See `.github/workqueue/` for task details.

**Phase 2: Complete.** Recent additions:
- `edit_cluster_detected` and `talk_activity_spike` event types (evidence-graph)
- Edit cluster detector and talk activity spike detector (analyzers)
- Wikidata entity mapping — page-to-entity Q-ID lookup (ingestion)
- `explore` CLI command — local web server with timeline, evidence table, diff viewer
- `@refract-org/eval` made public with full exports
- `Revision` type now includes optional `user` field
- Ingestion `fetch()` calls now have 30s timeouts
- CI pinned to bun 1.2.x, all 264 tests pass (33 test files)

**Current state:** Maintenance mode. Bug fixes, polish, and boundary hardening.

See [COMPATIBILITY.md](./COMPATIBILITY.md) for the cross-repo version matrix and dependency chain.
Active workqueue task: [MAINT-01](./.github/workqueue/MAINT-01.md) — Cross-repo compatibility audit.

## Completed — L1 Deterministic

- **L1-01:** Talk Page Fetcher — `fetchTalkRevisions()` in MediaWikiClient
- **L1-02:** Talk Page Correlation — `correlateTalkRevisions()` + `talk_page_correlated` events
- **L1-03:** Wikilink Extractor — `extractWikilinks` + `diffWikilinks` + events
- **L1-04:** Page Move Detector — `buildPageMoveEvents` via logevents API
- **L1-05:** Category Tracker — `extractCategories` + `diffCategories` + events
- **L1-06:** Claim Direction Classification — claim_softened, claim_strengthened, claim_moved
- **L1-07:** Re-Observation / Temporal Diff — `--since` flag, observation differ
- **L1-08:** Talk Page Section Extractor — `parseTalkThreads` + thread/reply events
- **L1-09:** Template Parameter Differ — `diffTemplateParams` + `template_parameter_changed` events

## Completed — Cross-Wiki

- **CW-01:** Cross-Wiki Diff — `refract diff` with 2+ wikis, z-score outlier detection
- **CW-02:** Multi-Workset Diff — N-way comparison table (extends CW-01)
- **CW-03:** Evidence Graph Visualization — `refract visualize` (mermaid/dot)
- **CW-04:** Non-English Wikipedia Support — tested against de, fr, ja wikipedias
- **CW-05:** Private MediaWiki Instance Support — bearer, basic, OAuth2 auth

## Completed — Infrastructure

- **INFRA-01:** Real L3 Eval — ground truth labels, calibration, benchmark pages
- **INFRA-02:** Scheduled Re-Observation — `refract watch` + `cron` with notifications
- **INFRA-04:** Watch Channels — Slack, email, webhook notifications

## 0.5.0 — Semantic Enrichment ✅ COMPLETE (2026-05-18)

- [x] 6 deterministic enrichment fields on every EvidenceEvent: `editMagnitude`, `contentChange`, `keyTerms`, `certaintyProfile`, `directionSignal`, `quantitativeFindings`
- [x] New types: `EditMagnitude`, `ContentChange`, `CertaintyProfile`, `DirectionSignal`, `QuantitativeFinding`
- [x] `semantic-enrichment.ts` analyzer with extraction functions
- [x] Integrated into analyze pipeline — all events enriched before return
- [x] All fields are deterministic — no model, no API, byte-reproducible
- [x] Domain-specific classification (safety, efficacy, dosing…) stays in downstream consumers
