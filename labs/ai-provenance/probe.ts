/**
 * AI Provenance Probe
 *
 * Assesses stability, contestation, and recency signals for passages cited by
 * RAG pipelines and LLM applications. Helps determine whether a Wikipedia-sourced
 * passage should be treated as stable reference material or flagged for review.
 *
 * Deterministic analysis always runs. Optional model inference adds nuanced
 * hardening/weakening/contestation/stabilization/ratification signals.
 *
 * Env var conventions (matching refract core):
 *   REFRACT_INFERENCE_ENDPOINT  — any OpenAI-compatible endpoint (default: unset → deterministic only)
 *   REFRACT_INFERENCE_API_KEY   — API key (optional, passes through to provider)
 *   REFRACT_INFERENCE_MODEL     — model name (default: gemma4:26b)
 *
 * Legacy aliases (also accepted):
 *   OPENAI_API_BASE             — base URL (appends /chat/completions)
 *   OPENAI_API_KEY              — API key
 *   INFERENCE_MODEL             — model name
 *
 * Usage:
 *   node --import tsx ai-provenance/probe.ts <events.jsonl>              # deterministic only
 *   REFRACT_INFERENCE_ENDPOINT=http://localhost:11434/v1/chat/completions node --import tsx ai-provenance/probe.ts <events.jsonl>
 */

import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { eventsInWindow, countEventType, eventsOfType, sectionChurn } from "../lib/signals.js";
import { classifyEvents } from "./classify.js";
import { runProbe } from "../lib/runProbe.js";

interface PassageSignal {
  status: "stable" | "contested" | "recently_changed";
  passageAgeDays: number | null;
  editsLast90Days: number;
  editLatencyPercentile: number | null;
  note: string;
}

interface ClassificationSignal {
  label: string;
  strength: number;
  rationale: string;
}

interface ProvenanceReport {
  page: string;
  timestamp: string;
  generatedAt: string;
  signals: {
    stability: PassageSignal;
    contestation: PassageSignal;
    recency: PassageSignal;
  };
  classification?: {
    signals: ClassificationSignal[];
    modelUsed: string;
    summary: string;
  };
  summary: string;
}

function deterministicAnalysis(events: EvidenceEvent[], page: string): {
  signals: ProvenanceReport["signals"];
  churn: Map<string, number>;
  summary: string;
} {
  const last90 = eventsInWindow(events, 90);
  const last14 = eventsInWindow(events, 14);

  const reverts = countEventType(last90, "revert_detected");
  const talkEvents = countEventType(last90, "talk_thread_opened");
  const recentEdits = last90.length;

  const stabilitySignal: PassageSignal = {
    status: recentEdits < 5 ? "stable" : "recently_changed",
    passageAgeDays: events.length > 0 ? Math.floor((Date.now() - new Date(events[0].timestamp).getTime()) / 86400000) : null,
    editsLast90Days: recentEdits,
    editLatencyPercentile: null,
    note: recentEdits < 5 ? "Content has been stable. Recent edits are minor." : "Moderate edit activity detected. Review before citing.",
  };

  const contestationSignal: PassageSignal = {
    status: reverts > 0 || talkEvents > 0 ? "contested" : "stable",
    passageAgeDays: null,
    editsLast90Days: reverts,
    editLatencyPercentile: null,
    note: reverts > 0 ? `${reverts} revert(s) in 90 days. Active talk page: ${talkEvents > 0}.` : "No active disputes detected.",
  };

  const recencySignal: PassageSignal = {
    status: last14.length > 0 ? "recently_changed" : "stable",
    passageAgeDays: last14.length > 0 ? Math.floor((Date.now() - new Date(last14[last14.length - 1].timestamp).getTime()) / 86400000) : null,
    editsLast90Days: last14.length,
    editLatencyPercentile: null,
    note: last14.length > 0 ? `${last14.length} edit(s) in the last 14 days. Verify content freshness.` : "No recent edits.",
  };

  const churn = sectionChurn(last90);
  const highChurnSections = Array.from(churn.entries()).filter(([, c]) => c > 3).map(([s]) => s);

  return {
    signals: { stability: stabilitySignal, contestation: contestationSignal, recency: recencySignal },
    churn,
    summary: `${page}: ${stabilitySignal.status}, ${contestationSignal.status}, ${recencySignal.status}. ${highChurnSections.length > 0 ? `High-churn sections: ${highChurnSections.join(", ")}` : ""}`,
  };
}

async function analyze(events: EvidenceEvent[], page: string): Promise<ProvenanceReport> {
  const base = deterministicAnalysis(events, page);

  const classification = await classifyEvents(events, page, { topEvents: 5 });

  const hasModel = classification.modelUsed !== "none (deterministic fallback)";

  return {
    page,
    timestamp: events[events.length - 1]?.timestamp ?? new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    signals: base.signals,
    ...(hasModel ? { classification: { signals: classification.signals, modelUsed: classification.modelUsed, summary: classification.summary } } : {}),
    summary: hasModel ? classification.summary : base.summary,
  };
}

async function main() {
  await runProbe(
    "Usage: node --import tsx ai-provenance/probe.ts <events.jsonl> [page-url]\n  Set REFRACT_INFERENCE_ENDPOINT for optional model inference (Ollama/DeepSeek/etc)",
    analyze,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
