# AI Provenance: Stability & Contestation Signals for RAG

## Problem

Retrieval-augmented generation (RAG) pipelines ingest content from public knowledge sources without understanding whether that content is stable, contested, or recently changed. A model may cite a Wikipedia paragraph that was rewritten hours ago — or one that has survived years of scrutiny unchanged. The citation looks equally credible either way.

RAG systems need a signal that separates "this fact is widely accepted" from "this fact is currently disputed" or "this fact was just inserted."

## How Refract's Observability Applies

Refract exposes three signals directly applicable to RAG provenance:

- **Stability.** How long has a given passage survived without substantial revision? A stable passage has high edit latency — few changes over a long period.
- **Contestation.** Is there a current dispute on the article's talk page? Have reverts occurred around this passage? High revert density indicates contested content.
- **Recency.** Was this passage introduced or substantially rewritten recently? Recent changes carry higher uncertainty.

These signals are deterministic (L1). They require no model — only revision history analysis.

When `REFRACT_INFERENCE_ENDPOINT` (or legacy `OPENAI_API_BASE`) is set, the probe also surfaces nuanced signals: hardening, weakening, contestation, stabilization, ratification — each with a strength score (0-1) and rationale.

## Probe Output

```json
{
  "page": "Quantum_computing",
  "signals": {
    "stability": { "status": "stable", "editsLast90Days": 3, "note": "Content has been stable. Recent edits are minor." },
    "contestation": { "status": "contested", "editsLast90Days": 2, "note": "2 revert(s) in 90 days." },
    "recency": { "status": "recently_changed", "editsLast90Days": 1, "note": "1 edit(s) in the last 14 days." }
  },
  "classification": {
    "signals": [
      { "label": "stabilization", "strength": 0.7, "rationale": "Mostly stable with isolated dispute in one section." },
      { "label": "contestation", "strength": 0.4, "rationale": "Active revert activity around benchmark claims." }
    ],
    "modelUsed": "gemma4:26b (http://localhost:11434/v1)",
    "summary": "Quantum_computing: stabilization (0.70), contestation (0.40) — stable core with contested section."
  }
}
```

The `classification` block is only present when a model is configured. Without it, the probe emits only the deterministic `signals` block.

## Usage

```bash
# Deterministic only (no model needed)
node --import tsx ai-provenance/probe.ts events.jsonl

# With local model (Ollama)
REFRACT_INFERENCE_ENDPOINT=http://localhost:11434/v1/chat/completions node --import tsx ai-provenance/probe.ts events.jsonl
```

## Use Case: Citation Trust Scoring

A RAG pipeline could weight retrieved passages by stability score, flag contested passages for corroboration, and deprioritize recently changed content. The output is a list of signals — not a truth verdict.

## Next Steps

- Build a Refract adapter that emits stability/contestation scores per passage
- Integrate with LangChain or LlamaIndex as a document transformer
- Run eval on 100 Wikipedia pages comparing human-assessed stability vs. computed signals
