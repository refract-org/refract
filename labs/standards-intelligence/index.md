# Standards Intelligence: Specification Language Change Tracking

## Problem

Standards bodies — IETF, W3C, ISO, ECMA, IEEE — publish and revise specifications. Language in these documents can shift between drafts: requirements become recommendations, "SHALL" becomes "SHOULD", scope narrows or widens.

Organizations that depend on standards (compliance, procurement, engineering) need to know when language changes. Currently, they rely on:

- Mailing list announcements
- Diff documents published alongside drafts
- Manual comparison of PDF versions

Each of these is slow, incomplete, or both.

## How Refract Applies

Standards documents on wikis or revision-tracked platforms can be monitored with Refract's diff infrastructure:

- **Requirement language changes**: "MUST" → "SHOULD", "required" → "recommended"
- **Scope changes**: Definitions added, removed, or narrowed
- **Reference updates**: Normative references added, removed, or superseded
- **Annex/Appendix changes**: Supplementary content introduced or removed
- **Editorial vs. substantive classification**: Distinguish copyedits from meaning-changing edits

## Example Scenario

An IETF RFC draft changes the status of a security requirement from "MUST implement" to "SHOULD implement" between draft versions -03 and -04. A compliance team that depends on the requirement has 60 days to respond before the RFC is published. Refract detects the change and alerts them.

## Signal Schema

| Signal | Description | Deterministic? |
|---|---|---|
| **Req language change** | MUST/SHALL/SHOULD/MAY shifts | L1 (pattern match) |
| **Scope change** | Definition or scope paragraph modified | L1 (section diff) |
| **Reference change** | Normative reference added/removed | L1 |
| **Substantive edit** | Change beyond whitespace/copyediting | L1 (word-level diff) |
| **Dissenting note** | Note about disagreement or alternative views | L1 |

## Next Steps

- Identify standards tracked in MediaWiki or revision-controlled formats
- Build a regex-based "requirement language" detector for MUST/SHALL/SHOULD patterns
- Evaluate whether IETF datatracker provides sufficient API surface without wiki parsing
- Pilot with one standards body and one enterprise compliance team
