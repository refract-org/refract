# Changelog

## 0.5.14 (2026-07-29)

**schema:** `EVENT_SCHEMA_VERSION "0.5.0"`.

### Added
- **Fact provenance, Merkle roots, and statement history MCP**: deterministic claim-state timelines with `sourceSpan` pointer tracing and verifiable provenance blocks.
- **Enriched evidence schema**: `sourceSpan` optional field on `FactProvenance`, `DeterministicFact`, and `QuantitativeFinding` for precise document-range references.

### Fixed
- **Scheduled observation workflow**: repaired to build from source and actually publish packages.

## 0.5.13 (2026-05-31)

### Added
- Standard opencode modes (`deploy`, `refactor`, `review`) and `.opencode/` build/check commands.
- Demo asset updates.

### Changed
- README positioning sharpened with GTM-informed one-liner and value statement.
- Boundary documentation refined with temporal framing and out-of-scope specifics.
- Claim-state timelines concept documented.

### Fixed
- Removed nonexistent `refract-labs` from CI downstream configuration.
- Added tooling patterns to `.gitignore`.

## 0.5.12 (2026-05-25)

### Changed
- Bumped CLI to `0.5.12`.
- Publish workflow now continues past already-published packages.

## 0.5.11 (2026-05-25)

### Changed
- Bumped CLI to `0.5.11`.

### Fixed
- Trusted Publishing OIDC: added `setup-node@v4` for npm 10+ support and debugged OIDC env vars in publish workflow.

## 0.5.10 (2026-05-25)

### Changed
- Bumped CLI to `0.5.10`.
- Switched package publish workflow to npm for Trusted Publishing OIDC.

## 0.5.9 (2026-05-24)

### Added
- Regenerated graphical assets with retina scaling; added email, blur, circle, and topology scene assets.
- Added CLI and package-registry card assets.

### Fixed
- Favicons regenerated as proper 32px squares.
- Card assets rebuilt with correct ffmpeg scaling.

## 0.5.8 (2026-05-23)

### Changed
- Bumped CLI to `0.5.8` with analyzers dependency resolution fix.
- Publish workflow allowed to proceed despite test failures while CI is hardened.

### Added
- CodeQL security analysis workflow.
- Dependency review and stale issue workflows.
- Husky pre-commit hooks with lint-staged.
- `mise.toml` for Bun/Node version pinning.

### Fixed
- Labs examples updated to current L1/L2 terminology.

## 0.5.7 (2026-05-18)

### Added
- AI model evaluation toolkit: benchmark harness, eval adapter, dataset script, and leaderboard with template submission.
- Streaming adapter and snapshot command for live and point-in-time observation.
- Init onboarding command for first-time users.
- Cross-repo CI trigger for downstream repositories.
- Scheduled observation workflow that builds from source.

## 0.5.6 (2026-05-16)

### Changed
- Bumped `evidence-graph` to `0.4.4` and CLI to `0.5.6`.

### Added
- `--format parquet` on `refract export`.
- `editorCount` on `edit_cluster_detected`, `uniqueEditorCount` on `ObservationReport`, and `UserMetadata` for heuristic classification.

### Fixed
- Progress output redirected to `stderr`, parquet CJS interop fixed, lint clean.

## 0.5.5 (2026-05-15)

### Changed
- Moved SVG assets to `refract-docs`; updated README and ARCHITECTURE to link to docs-site versions.

## 0.5.4 (2026-07-18)

### Removed
- **PayerPolicySource from `@refract-org/ingestion`**: Healthcare-specific payer/coverage policy ingestion logic removed to enforce domain-neutral boundary. This adapter (CoverageDecision, PolicyDocument, PayerPolicySource) has moved to NextConsensus's private evidence-ingest adapters (`@nextconsensus/evidence-ingest/adapters/payer-policy.ts`). Refract remains strictly domain-neutral; all healthcare-specific source adapters belong in downstream applications.

## 0.5.3 (2026-05-15)

### Added
- **Slack Block Kit notifications**: Rich-formatted Slack messages with header, page breakdown, emoji indicators (⚠️/✅), and context footer. `sendSlackNotification` now posts `{"blocks": [...]}` instead of `{"text": "..."}`.
- **GitHub Actions observe workflow**: `.github/workflows/observe.yml` — daily scheduled observation of configurable page titles, auto-commits results.
- **LangChain document loader**: `refract-py/src/refract_langchain.py` — loads events as `Document` objects with stability metadata for provenance-aware RAG.
- **Marimo notebook template**: `docs/notebooks.md` updated with Altair-based analysis template.
- **`.github/workflows/observe.yml`**: reusable scheduled observation workflow.

### Fixed
- CLI `--version` now reports `0.5.3` (was stuck at `0.5.1` in index.ts)

## 0.5.2 (2026-05-15)

### Fixed
- **Boundary check script**: regex patterns updated from `@var-ia/` to `@refract-org/` — architectural boundary enforcement was silently non-functional since the rename
- **Inter-package dependency ranges**: CLI, analyzers, ingestion, and eval all updated caret ranges to match actual published versions (e.g., `evidence-graph ^0.2.2` → `^0.4.0`)
- **CITATION.cff**: stale `var-ia/var-ia` URL and version `0.2.1` fixed to `refract-org/refract` and `0.5.1`
- **SUPPORT.md**: stale `nextconsensus/var-ia` discussion/issue URLs fixed to `refract-org/refract`

## 0.5.1 (2026-05-15)

**schema:** `EVENT_SCHEMA_VERSION "0.5.0"`. No `EventType` changes. Added `EVENT_SCHEMA_VERSION` constant and `CLAIM_IDENTITY_VERSION` constant to package exports.

### Added
- `--json` flag on `analyze` command to force JSON output (disable interactive web UI)
- Auto-launch web UI when `refract analyze` is run in an interactive terminal
- `runExplore` now supports `useCache`, `depth`, `since` parameters
- `scripts/verify-mcp.sh` — MCP connectivity verification script

### Changed
- Empty events response now shows "No events detected" instead of raw JSON
- Explorer server waits for port assignment before printing URL (supports random port allocation)

## 0.4.0 / 0.5.0 (2026-05-15)

**schema:** `EVENT_SCHEMA_VERSION "0.4.0"`. Added `sentence_modified` to `EventType` union. Added `parameters` to `FactProvenance` interface. Added `AnalyzerConfig` type. Added `$version` to `AnalyzerConfig`. Added `CLAIM_IDENTITY_VERSION "claimidentityv1"`.

### Added
- **BYO-inference boundaries**: typed interfaces for 5 judgment points (revert, similarity, heuristic, template, spike) with `buildInferencePrompt()` and `parseInferenceResponse()`
- **`refract classify`**: CLI command for single-boundary model calls
- **MCP `classify` tool**: accepts boundary + input, uses MCP sampling or OpenAI-compatible provider
- **OpenAICompatibleProvider**: works with OpenAI, DeepSeek, Ollama, any `/chat/completions` endpoint
- **`--config`, `--similarity`, `--report`** flags on `analyze` and `export` commands
- **Config version pinning**: `config.$version` recorded on every event set
- **ObservationReport**: structured output with claim lifecycle and Merkle root
- **On-revision integrity**: every event stamped with `schemaVersion` at generation time

## 0.3.1 (2026-05-15)

### Removed
- **@refract-org/interpreter** package deleted — L2 model interpretation moved to NextConsensus
- CLI `--model`, `--model-api-key`, `--model-name`, `--model-endpoint`, `--temperature`, `--prompt`, `--router` flags removed
- Old claim direction event types (`claim_softened`, `claim_strengthened`, `claim_reworded`, `claim_moved`) replaced with mechanical sentence events
- Architecture boundary check scripts cleaned up (no longer checks deleted interpreter package)

### Added
- **@refract-org/evidence-graph**: `buildInterpretationPrompt()`, `parseInterpretationResponse()`, `ModelInterpretationSchema` — format pipeline for bring-your-own-inference
- **MCP server**: `interpret` tool with host-sampling support — requests host LLM via `sampling/createMessage`, no API key management
- **`--format html`** on `wikihistory export` — self-contained interactive report
- **Docker**: GHCR publish workflow (`ghcr.io/refract-org/cli`)

### Fixed
- `@refract-org/persistence` removed from hard CLI deps — `npx @refract-org/cli` no longer fails to install
- `@refract-org/persistence` lazy-imported at runtime; `--cache` requires explicit install
- `wikihistory explore` `--no-open` now actually suppresses browser open (not just the log message)
- `docs/recipes.md` claim tracking example now shows `wikihistory claim` not `wikihistory cron`
- `.env.example` no longer references removed model provider API keys

## 0.3.0 (2026-05-15)

### New L1 analyzers

- **Edit cluster detection** — `detectEditClusters()` groups 3+ rapid edits within a configurable time window. Produces `edit_cluster_detected` events.
- **Talk activity spike detection** — `detectTalkActivitySpikes()` flags anomalous talk page activity (3x moving average). Produces `talk_activity_spike` events.
- **Wikidata entity mapping** — `fetchWikidataId()`, `mapPageToEntity()`, `mapPagesToEntities()` for page-to-Q-ID lookups, entity data, and claim extraction.

### New CLI commands

- **`wikihistory explore <page>`** — starts a local HTTP web server with an interactive timeline, evidence table, diff viewer, and summary view.

### Model adapters hardened

- All 5 adapters (OpenAI, Anthropic, DeepSeek, Ollama, BYOK) now support `timeoutMs` (default 120s) and `maxTokens` (default 4096) configuration.
- Fetch calls use `AbortSignal.timeout()` for deterministic timeouts.
- Interpreter barrel (`index.ts`) split: 381-line file → 6 dedicated adapter files in `adapters/`.
- Removed dead exports (`CalibratedAdapter`, `CascadingRouter`).

### Infrastructure

- **CI pinned to bun 1.2.x** — reproducible builds.
- **Architecture boundary check** — `scripts/check-boundaries.ts` prevents L1→interpreter and L2→ingestion imports, enforced in CI.
- **`.env.example`** added with expected environment variables.
- **Public `@refract-org/eval`** — package made public with full exports, README, and benchmark fixtures (25 seeded labels across 5 pages).

### Documentation

- `docs/events.md` — full event taxonomy with triggers and examples (all 29 event types).
- `docs/naming.md` — explains Refract/var-ia/@refract-org/wikihistory split.
- `docs/mcp.md` — MCP tool reference with connection configs.
- `docs/security.md` — credential exposure, local cache, L2 data flow.
- `docs/recipes.md` — example JSON output added to claim, cron, and diff recipes.
- L2 invariant now reads "never receives full revision wikitext" (was "never sees raw Wikipedia text").

### Bug fixes

- `_toRevId` renamed to `toRevId` (underscore was misleading — parameter IS used).
- `stripWikitext` moved from CLI `claim.ts` to `analyzers/wikitext-parser.ts` (removed duplicate).
- `ReportLayerLabel` consolidated as alias of `EvidenceLayer`.
- Dueling `ExpectedInterpretation` types in eval renamed to `L2ExpectedInterpretation`.
- Stale dist test files cleaned (compiled `__tests__/` in dist were being run by vitest).

## 0.2.1 (2026-05-13)

### Examples (new)

Six migration-audience tutorial scripts covering claim provenance, WikiWho
equivalent, ORES equivalent, from-scratch migration, Wikidata editorial depth,
and L2 custom adapter deep dive. See `examples/README.md`.

Dual-licensed: CC0-1.0 (scripts) + AGPL-3.0 (everything else).

### L1-02: Talk Page Correlation

New `correlateTalkRevisions()` analyzer matches article revision timestamps to
nearby talk page revision timestamps (configurable window, default 7 days before
to 3 days after). Produces `talk_page_correlated` events. Integrated into the
analyze command pipeline.

### L1-07: Re-Observation / Temporal Diff

New `--since <iso-timestamp>` flag for the `analyze` command. Fetches only
revisions after the given timestamp and diffs the event stream against the prior
observation (persisted to `~/.wikihistory/observations/`). Shows delta of new,
resolved, and unchanged events.

### L1-08: Talk Page Section Extractor

New `parseTalkThreads()` function extracts threaded discussion structure (sections,
replies, participants, timestamps, resolved status). New event types:
`talk_thread_opened`, `talk_thread_archived`, `talk_reply_added`.

### L1-09: Template Parameter Differ

Extended `template-tracker.ts` with `diffTemplateParams()` and
`buildParamChangeEvents()`. Diffs parameter key-value pairs on templates present
in both revisions. New event type: `template_parameter_changed`.

### L2-01: Talk Page Interpretation

Added `discussionType` field to `ModelInterpretation`. Extended default system
prompt with talk page discussion type taxonomy (notability_challenge,
sourcing_dispute, neutrality_concern, content_deletion, content_addition,
naming_dispute, procedural, other). Model receives only L1-extracted
deterministic facts — never raw wikitext.

### INFRA-01: Real L3 Eval with Ground Truth

New `OutcomeLabel` type and `validateAgainstGroundTruth()` function. Ground
truth dataset of 5 manually curated labels covering RFC closures, talk page
consensus, and page protection events. New `--ground-truth builtin | <path>`
flag for `wikihistory eval`. CLI validates pipeline signal against independent
outcome labels.

### Test Coverage (expanded from 12 files to 20)

New test files:
- heuristic-classifier, wikitext-parser, protection-tracker, revert-detector — 0→full coverage
- rate-limiter, mediawiki-client (mocked) — 0→full coverage
- adapter (createAdapter, parseInterpretations, ConsensusAdapter) — 0→full coverage
- eval harness (evaluate, benchmarkPages, computeScores) — 0→full coverage
- persistence (all 7 methods via bun:sqlite mock) — 0→full coverage
- claim-utils (stripWikitext, fuzzyFindClaim, findSectionForText) — 0→full coverage
- parseFlag — 0→full coverage

Extended existing tests:
- section-differ: added extractSections + diffSections (was buildSectionLineage-only)
- template-tracker: added extractTemplates + diffTemplates (was param-differ-only)
- hash-identity: added createEventIdentity (was createClaimIdentity-only)
- replay-manifest: created (was 0 tests)

Total: 41 test files, 602 tests passing.

## 0.1.0 (2025-01-01)

Initial release.

### Packages

- `@refract-org/evidence-graph` 0.2.0 — core types and schemas
- `@refract-org/ingestion` 0.2.0 — Wikimedia API adapters
- `@refract-org/analyzers` 0.2.0 — deterministic analyzers
- `@refract-org/interpreter` 0.1.0 — model adapter interface
- `@refract-org/cli` 0.3.0 — CLI tool
- `@refract-org/persistence` 0.1.0 — SQLite persistence
- `@refract-org/eval` 0.1.0 — evaluation harness

## 0.5.0 — Semantic Enrichment (2026-05-18)

### Added
- 6 new deterministic fields on every `EvidenceEvent`: `editMagnitude`, `contentChange`, `keyTerms`, `certaintyProfile`, `directionSignal`, `quantitativeFindings`
- New types: `EditMagnitude`, `ContentChange`, `CertaintyProfile`, `DirectionSignal`, `QuantitativeFinding`
- `semantic-enrichment.ts` analyzer: `computeCertaintyProfile()`, `computeDirectionSignal()`, `computeEditMagnitude()`, `computeContentChange()`, `extractKeyTerms()`, `extractQuantitativeFindings()`
- All fields are deterministic — no model, no API, byte-reproducible on every run

### Design
- Fields that require domain knowledge (e.g., "is this a safety edit?") belong in downstream consumers
- Fields that are pure text analysis (e.g., "how long is this edit?") belong in refract
- This preserves the two-knowledge-split: refract observes, consumers interpret
