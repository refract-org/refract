# Standards Intelligence: Observability Signals

This probe tracks language changes in specification documents published by standards bodies. Refract's deterministic layer detects structural and lexical edits that may affect how a standard is implemented or enforced.

## Signal Definitions

| Signal | What Refract Detects | Layer |
|---|---|---|
| **Requirement language shift** | MUST → SHOULD, SHALL → MAY, "required" → "recommended", or inverse | policy_coded |
| **Scope change** | Definition paragraph modified, scope section expanded or narrowed | observed |
| **Normative reference change** | Normative reference added, removed, or downgraded to informative | observed |
| **Deprecation marker** | Section tagged deprecated, algorithm marked superseded, feature flagged for removal | observed |
| **Version diff signal** | Change between draft versions that exceeds editorial noise threshold | observed |
| **Compatibility break** | API signature change, wire format change, behavior change under existing inputs | observed / model_interpretation |
| **Dissenting position** | Note, appendix, or inline text recording an alternative view or explicit disagreement | observed |
| **Editorial vs substantive** | Classification: is the change formatting/copyediting, or does it alter meaning? | observed / model_interpretation |

## Not Evaluated

- Whether a requirement change is justified by the working group's charter
- Compliance consequences for a specific organization
- Correctness of a technical specification
- Which interpretation of ambiguous language is preferred

## Signal Scope

Signals operate at section and paragraph level. Cross-draft comparison requires at least two revisions in a revision-tracked format. Compatibility break detection (model interpretation) requires model assistance where the spec describes behavior rather than a formal interface. This probe is exploratory — it investigates whether specification language monitoring can be built on Refract's general-purpose diff infrastructure.
