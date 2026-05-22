# Enterprise Knowledge: Observability Signals

This probe tracks what changes in enterprise knowledge bases and what those changes might indicate. Refract's L1 layer detects structural and content-level edits without evaluating correctness.

## Signal Definitions

| Signal | What Refract Detects | Layer |
|---|---|---|
| **Claim addition** | New assertion, policy statement, or procedural step inserted into a page | L1 |
| **Claim removal** | Assertion, policy statement, or procedural step deleted without explicit deprecation | L1 |
| **Policy wording drift** | Key terms replaced (e.g., "must notify within 24h" → "should notify promptly") | L1 (regex + diff) |
| **Compliance language change** | Regulatory references added/removed, obligation verbs shifted (shall/must/should) | L1 |
| **Procedural step change** | Numbered sequence modified — step inserted, removed, or reordered | L1 |
| **Contradiction flag** | Two pages in the same namespace make incompatible claims | L2 (model-assisted) |
| **Staleness** | Page not edited beyond a configurable threshold (default: 180 days) | L1 |
| **Churn hotspot** | Section or page exceeding edit velocity threshold | L1 |
| **Attribution gap** | Content change with no associated author identity, ticket, or review record | L1 |

## Not Evaluated

- Whether a policy change is correct or justified
- Whether compliance language is sufficient for a given regulatory regime
- Author intent behind a change
- Priority or severity of a detected signal

## Signal Scope

All signals are page-level and section-level. Cross-page contradiction detection (L2) requires a model call after L1 identifies candidate pairs with overlapping claims. The open-source Refract core does not include enterprise connectors — this probe investigates whether the signal pipeline generalizes to internal KB formats.
