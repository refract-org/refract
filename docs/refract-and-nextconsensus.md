# How Refract Relates to NextConsensus

Refract records how a public source changed. [NextConsensus](https://nextconsensus.com), which builds and maintains Refract, is the first system downstream of it. This page says what crosses the boundary between the two and what does not. What NextConsensus does with the record is described by NextConsensus, on its own site, not here.

## The Split

| | Refract | NextConsensus |
|---|---------|--------------|
| **Type** | Open infrastructure (AGPL-3.0) | Commercial, closed |
| **Scope** | Domain-neutral observation of versioned sources | Healthcare: specific claims and the institutions that act on them |
| **Writes** | A deterministic, byte-reproducible event stream | Its own record, in its own repositories |
| **Question** | "How did this source change, and when?" | Its own — see [nextconsensus.com](https://nextconsensus.com) |
| **User** | Developers and AI systems | NextConsensus's customers |

Refract's events are observations. Which change matters, to whom, and what might follow from it is decided downstream — in NextConsensus or in any other consumer — and Refract is built so that it cannot make that call: see [repository boundary](./repository-boundary.md).

## How NextConsensus Consumes Refract

- **Three library packages.** NextConsensus imports `@refract-org/evidence-graph`, `@refract-org/ingestion` and `@refract-org/analyzers` from npm (`^0.5.0`, `^0.3.1`, `^0.5.0`) and nothing else from Refract. Some of its scripts also shell out to the `refract` CLI; those cannot run from npm until the next release, because the published `@refract-org/cli@0.5.7` does not start (see [COMPATIBILITY.md](../COMPATIBILITY.md)).
- **One adapter file per repository.** In each NextConsensus repository that uses Refract, a single file is the only place `@refract-org/*` is imported, and everything else imports from that file. This is the pattern [AGENTS.md](../AGENTS.md) recommends to every consumer: an upgrade touches one file, and a diff of that file is the whole of what changed at the boundary.
- **What stays downstream.** Source weighting, name anonymization, domain classification of edits, and anything else that interprets an event live in those adapter files and the code behind them. None of it comes back into Refract, and `bun run check:boundaries` fails the build if domain vocabulary appears in this repository's packages.
- **Versions.** A consumer should read `schemaVersion` off each event rather than infer it from a package version — see [SCHEMA_VERSIONING.md](../SCHEMA_VERSIONING.md) for why the published evidence-graph 0.5.0 still stamps `"0.4.0"`.

## Why the Boundary Matters

Refract is open so that the observation layer can be inspected rather than trusted. Anyone can read, test, extend or fork it.

NextConsensus keeps its domain-specific source coverage, customer annotations and review workflows closed, because they are its business and compound with use.

The split also protects the people NextConsensus works with. Anyone can take the same source revisions, run the same Refract version, and get the same events — the record is checkable rather than a black box. That is tamper-evidence over an observation, not a claim that any reading of it is correct, and it gives no one access to another customer's work.

## What Refract Does Not Do

Refract is not a truth engine, fact-checker, medical device, investment model, or replacement for domain review. It observes and structures how knowledge changes. Domain-specific interpretation belongs in applications built on top of Refract — including NextConsensus.

## For Developers

To build a provenance-aware system on top of Refract, start with the [README](../README.md) and the [architecture notes](../ARCHITECTURE.md). The event schema is published and versioned, the analyzer pipeline is deterministic, and the CLI, adapters and replay primitives are documented. [COMPATIBILITY.md](../COMPATIBILITY.md) lists which versions are on npm and which consumers depend on them.
