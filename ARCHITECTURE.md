# Architecture: Two-Knowledge-Split Design

Refract is the git log for public knowledge — a deterministic observation substrate
that ingests revision histories and emits structured, provenance-tagged event
streams. No model. No interpretation. Byte-for-byte reproducible.

This architecture lives in the **refract** repository (open-source, generic
public-knowledge observability). Healthcare-specific logic lives in private
repos, which consume this engine's output without modifying it.

Refract separates computation into two architecturally isolated layers. No
layer's output feeds into another layer's input in a way that would contaminate
evidence with interpretation.

## Deterministic Layer

**What it answers**: What changed, when, where, how — byte-for-byte reproducible.

**Implementation**: Wikipedia API fetch, diff computation, section extraction,
citation counting, revert detection, template tracking, pagination. No model
involved. Every run on the same revision range produces identical output.

**Output**: Evidence objects with `deterministicFacts` arrays.

**Why it matters on fandom wikis**: A Star Wars Legends page that had
`[[Category:Canon characters]]` removed and `[[Category:Legends characters]]`
added after the 2014 Disney acquisition. These are deterministic signals — no
interpretation needed, the edit itself is the event. Refract captures these as
`category_removed`/`category_added` events, byte-for-byte reproducible from
the API response.


### Semantic Enrichment (v0.5.0+)

Every `EvidenceEvent` now carries 6 deterministic enrichment fields computed from
the `before`/`after` text during the analyze pipeline. These are **not model outputs** —
they are deterministic text analysis, byte-reproducible on every run.

| Field | What it captures |
|-------|-----------------|
| `editMagnitude` | Character count thresholds (minor/moderate/major) |
| `contentChange` | Nature of the text change (introduction/removal/expansion/compression/refinement/rewrite) |
| `keyTerms` | Extracted significant terms from the edited text |
| `certaintyProfile` | Counts of certainty/hedging markers (high/medium/low/hedging) |
| `directionSignal` | Computed from certainty shift between before/after (strengthening/weakening/neutral) |
| `quantitativeFindings` | Extracted numbers (p-values, hazard ratios, n-values, confidence intervals) |

See `packages/analyzers/src/semantic-enrichment.ts` for the implementation.

Domain-specific classification (e.g., "is this edit about safety or efficacy?") belongs in
downstream consumers. Refract provides the deterministic substrate; applications add the interpretation.

## Independent Ground Truth Layer

**What it answers**: Did real-world editorial processes validate the signal?

**Implementation**: Independently sourced ground truth — talk page consensus, page protection events, RFC closures, Arbitration Committee decisions. Never redefined by observed or policy-coded layers. Stored separately from pipeline output.

**Output**: Outcome labels with public observability timestamps and source references.

**Why it matters on fandom wikis**: Fan wiki talk pages are where canon disputes
get resolved — not by authority, but by editorial consensus with timestamps and
public permalinks. A 2015 talk page consensus that "Clone Wars TV series is
canon, novelizations are secondary" might be overturned in 2024 by a new consensus
citing a different set of source policies. Refract captures both outcomes independently,
with temporal validity windows. The pipeline doesn't decide canon — it reports
that the editorial community reached a specific consensus at a specific time.
On Wikipedia the ground truth is RFC closures and ArbCom decisions; on fandom
wikis it's talk-page-archived consensus with revision links to the exact edit
that implemented the decision.

![Architecture Data Flow](https://refract-org.github.io/refract-docs/architecture-flow.svg)

## Data Flow (Text)

```
Wikipedia API
     │
     ▼
┌─────────────┐
│  Fetch       │ ← Deterministic: revisions, diffs, sections, citations
│  + Extract   │
└──────┬──────┘
       │ evidence objects
       ▼
┌─────────────┐
│  Analyze     │ ← Deterministic: section diffs, citation tracking, reverts,
│              │    templates, categories, wikilinks
└──────┬──────┘
       │ enriched evidence
       ▼
┌─────────────┐
│  Report      │ ← Assembles evidence into layered output
│  Assembly    │
└──────┬──────┘
       │ report
       ▼
┌─────────────┐
│  Validate    │ ← Independent: compares report against ground truth labels
│  + Measure   │    (eval package)
└─────────────┘
```

## Report Layers

Every user-facing output carries layer provenance:

| Label | Source | Reproducible? |
|-------|--------|---------------|
| **Observed** | Deterministic | Yes, byte-for-byte |
| **Policy-coded** | Deterministic + Wikipedia policy ontology | Yes, rules-based |

## Invariants

1. Deterministic pipeline never calls a model
2. Every event is provenance-tagged (revision, section, timestamp)
3. Output is byte-for-byte reproducible on the same revision range

## Consuming Deterministic Output

Refract's deterministic event stream is consumed by domain-specific interpretation
layers in downstream systems (e.g., NextConsensus). Those systems must:
- Never modify Refract's event types or schemas (consume, don't fork)
- Attribute provenance: "deterministic observation from Refract" vs. their own
  model-assisted interpretation
