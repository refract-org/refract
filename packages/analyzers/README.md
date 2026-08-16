# @refract-org/analyzers

Deterministic analyzers. Byte-for-byte reproducible, no model involved.

```bash
bun add @refract-org/analyzers
```

## Exports

### Analyzers

- `sectionDiffer` — section extraction and diffing between revisions
- `citationTracker` — citation extraction, diffing, and source lineage
- `revertDetector` — revert comment matching and revert chain detection
- `templateTracker` — template extraction and diffing (citation, neutrality, BLP, etc.)
- `classifyHeuristic` — heuristic edit classification (revert, vandalism, sourcing, cosmetic, minor)

### Utilities

- `sanitizeWikitext`, `extractHeadingMap`, `deriveSectionHeading`, `countCitations`, `countKeywordMentions`, `extractAnchorSnippet` — wikitext parsing helpers

### Builders

- `buildSectionLineage` — full section ancestry chain across revisions
- `buildSourceLineage`, `buildSourceId` — citation ancestry

### Types

- `SectionDiffer`, `CitationTracker`, `RevertDetector`, `TemplateTracker` — analyzer interfaces
- `CitationRef`, `CitationChange`, `RevertChain`, `Template`, `TemplateChange`, `TemplateType` — domain types
- `HeuristicKind`, `SectionEvent`, `SectionLineage`, `HeadingPosition` — supporting types

```ts
import { sectionDiffer, citationTracker, revertDetector } from "@refract-org/analyzers";
```

[Refract](https://github.com/refract-org/refract) · [Docs](https://github.com/refract-org/refract-docs) · [npm](https://www.npmjs.com/package/@refract-org/analyzers)

### semantic-enrichment (v0.5.0+)

Deterministic text analysis for evidence events. No model, no API.

- `computeCertaintyProfile(text)` — counts certainty/hedging markers
- `computeDirectionSignal(before, after)` — strengthening/weakening/neutral
- `computeEditMagnitude(beforeLen, afterLen)` — minor/moderate/major
- `computeContentChange(eventType, before, after)` — introduction/removal/expansion/etc.
- `extractKeyTerms(text)` — significant terms from text
- `extractQuantitativeFindings(text)` — p-values, HR, n-values, CIs

Exported from `@refract-org/analyzers`.
