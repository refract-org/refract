# How Refract Relates to NextConsensus

Refract replays how a claim changed over time. NextConsensus judges what that history means for a specific decision.

## The Split

| | Refract | NextConsensus |
|---|---------|--------------|
| **Type** | Open infrastructure (AGPL-3.0) | Commercial healthcare platform |
| **Scope** | Generic source observation | Healthcare claim review |
| **Primitive** | Claim-state / source events | Scored claim postures |
| **Object** | Citation, wording, section, and template changes | Dated claim assessments pinned to evidence |
| **Output** | Deterministic event stream | Review-ready briefs and evidence maps |
| **Question** | "How did this claim or source change over time?" | "Does this claim still hold up — and what would change that?" |
| **User** | Developer / AI system | Coverage, formulary, market-access, and diligence teams |
| **Moat** | Open substrate + ecosystem | Claim-to-evidence mapping and review workflows |

## The Principle

Refract replays claim history. NextConsensus judges what that history means now.

Refract is domain-neutral. It works on Wikipedia, fan wikis, policy documents, regulatory feeds, and any versioned source. It does not know what a "coverage decision" or a "market-access claim" is. It knows that a sentence appeared, a citation changed, a section moved, a dispute marker was added — across time.

NextConsensus adds healthcare-specific sources, review workflows, and decision-context mapping. It turns "a citation was removed" into "the evidence binding for this coverage claim may need review."

## Why the Boundary Matters

Refract is open to make the observation layer verifiable. Anyone can inspect, test, extend, or fork it. This builds trust in the underlying provenance.

NextConsensus is proprietary because it contains healthcare-specific source coverage, customer annotations, and review workflows — assets that compound with use and are expensive to replicate.

The split also protects NextConsensus customers. A pharma or payer organization using NextConsensus can verify that the underlying observation events are correct by inspecting Refract. They cannot access another customer's proprietary claim reviews.

## What Refract Does Not Do

Refract is not a truth engine, fact-checker, medical device, investment model, or replacement for domain review. It observes and structures how knowledge changes. Domain-specific interpretation belongs in applications built on top of Refract — including NextConsensus.

## For Developers

If you want to build a provenance-aware system on top of Refract, start with the [README](../README.md) and [architecture docs](./ARCHITECTURE.md). The event schema is published. The analyzer pipeline is deterministic and byte-reproducible. The CLI, adapters, and replay primitives are documented.

If you want to check whether a healthcare claim still holds up against the current evidence, visit [nextconsensus.com](https://nextconsensus.com).
