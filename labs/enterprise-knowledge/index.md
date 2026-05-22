# Enterprise Knowledge Governance

Internal knowledge bases — Confluence, Notion, SharePoint, GitBook, internal wikis — accumulate content over time. Unlike code, there is no systematic diff review for knowledge base changes. Content drifts. Outdated procedures survive. Contradictions go unnoticed.

## Problem

- A policy page is rewritten but no one is notified
- A procedure section contradicts another team's page
- A decision rationale is silently removed
- Old content persists as authoritative when it was superseded

These are knowledge governance failures. They cost time, create errors, and erode trust in internal documentation.

## How Refract Applies

Refract's observability engine generalizes to any revision-tracked content:

- **Section-level change detection** — what content changed, and where
- **Contradiction surfacing** — two pages making incompatible claims (requires L2 model assistance)
- **Removal detection** — content deleted without replacement or explanation
- **Churn analysis** — which sections change most often, and by whom
- **Staleness signals** — content that hasn't been reviewed or updated past a threshold

Refract does not judge whether a change is correct. It surfaces that a change occurred, with before/after diff and attribution.

## Important: Not the Open-Source Core

This enterprise knowledge probe is **separately governed** from the open-source Refract core (`@refract-org/*` packages). The open-source core is domain-neutral. Enterprise knowledge governance is a potential product direction that would require:

- Authentication and access control
- Integration with internal APIs (Confluence, Notion, SharePoint)
- Organizational permission models
- Compliance and audit trail requirements

These features are not part of the open-source Refract project. This lab explores whether they should be.

## Example Scenario

A compliance team updates a data retention policy in Confluence. Six months later, the engineering team references an older version of the policy that was never explicitly superseded — it just wasn't updated. Refract detects that the engineering team's page cites a superseded policy URL and flags the contradiction.

## Next Steps

- Map the delta between Refract's MediaWiki-centric architecture and generic KB APIs
- Prototype a Confluence webhook → Refract ingest pipeline
- Evaluate whether the open-source core should remain decoupled from enterprise features
