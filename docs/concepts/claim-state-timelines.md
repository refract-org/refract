# Claim-State Timelines

Refract turns document histories into claim-state timelines. It does not judge
whether a claim is true. It reconstructs how the claim changed and what
supported it at each point in time.

## What is a claim-state timeline?

A claim-state timeline is a structured record of how a claim evolved through
a document's revision history:

- When the claim first appeared
- How its wording changed across revisions
- What evidence supported it at each version
- Which citations were added, removed, or weakened
- When the claim was challenged, reverted, or stabilized
- How the claim's certainty and scope shifted

The timeline is deterministic: the same source produces the same events every
time. No model interpretation. Byte-reproducible.

## Why timelines, not just search

A vector search can find "the current version of this claim." A timeline
answers a different set of questions:

- What did this claim say two years ago?
- When was the caveat "in high-risk patients" removed?
- Did this claim broaden across versions?
- Which citation weakened between the 2024 and 2025 guideline?
- Was this claim challenged before it became consensus?

These are temporal questions. They require temporal infrastructure.

## Relationship to downstream systems

Refract provides the timeline. Downstream systems provide the judgment.

- **NextConsensus**: Takes claim-state timelines from Refract and evaluates
  whether a specific claim is still supportable for a specific use in a
  specific decision context.
- **Compliance systems**: Audit whether claims used in external materials
  were supportable at the time of approval.
- **Research tools**: Reconstruct the evolution of scientific consensus on
  a topic across revisions.
- **Knowledge graph pipelines**: Ingest structured claim-state events into
  graph databases for querying and analysis.

## Why vector search is not enough

A vector database can retrieve similar claims. It cannot tell you what changed
between versions, when a caveat was removed, whether a citation weakened, or
how a claim drifted across contexts.

Refract fills that gap: deterministic, temporal, provenance-backed infrastructure
for claim-state memory.

## See also

- [Repository boundary](./repository-boundary.md) — what Refract does and does not do
- [Refract and NextConsensus](./refract-and-nextconsensus.md) — how the two systems fit together
- [Quickstart](../quickstart/index.md) — get started with `refract analyze`
