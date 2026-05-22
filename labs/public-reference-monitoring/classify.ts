import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { eventsInWindow, eventsOfType } from "../lib/signals.js";
import { getProvider, callModel, type ProviderConfig } from "../lib/inference.js";

interface ClassifiedSignal {
  signalName: string;
  status: "stable" | "contested" | "elevated_risk" | "needs_review" | "source_fragile";
  strength: number;
  rationale: string;
}

interface ClassificationResult {
  signals: ClassifiedSignal[];
  modelUsed: string;
  summary: string;
}

const SYSTEM_PROMPT = "You are a brand monitoring analyst reviewing Wikipedia edit data. Classify each signal with status, strength (0-1), and rationale. Return only valid JSON.";

function buildPrompt(events: EvidenceEvent[], page: string): string {
  const last90 = eventsInWindow(events, 90);
  const negative = eventsOfType(last90, "claim_removed", "claim_softened", "revert_detected", "talk_thread_opened");
  const reverts = eventsOfType(last90, "revert_detected").length;
  const talks = eventsOfType(last90, "talk_thread_opened", "talk_reply_added").length;
  const citationChanges = eventsOfType(last90, "citation_added", "citation_removed", "citation_replaced").length;
  const negativeCount = negative.length;

  return `Page: "${page}"

Metrics (last 90 days):
- Total negative-claim events: ${negativeCount}
- Reverts: ${reverts}
- Talk activity: ${talks}
- Citation changes: ${citationChanges}

Sample negative events:\n${negative.slice(0, 5).map((e) => `  [${e.eventType}] ${e.section}: ${e.deterministicFacts[0]?.fact ?? ""}`).join("\n")}

Respond with JSON:
{"signals": [{"signalName": string, "status": enum, "strength": 0-1, "rationale": string}], "summary": string}
Signal names: negative_claims, controversy_sections, source_quality, source_fragility, revert_activity, dispute_activity, source_churn, recent_changes
Statuses: stable, contested, elevated_risk, needs_review, source_fragile`;
}

async function classifyWithModel(events: EvidenceEvent[], page: string, config: ProviderConfig): Promise<ClassificationResult> {
  const prompt = buildPrompt(events, page);
  const raw = await callModel(config, SYSTEM_PROMPT, prompt, { maxTokens: 800 });
  const parsed = JSON.parse(raw);
  return {
    signals: parsed.signals,
    modelUsed: `${config.model} (${config.endpoint})`,
    summary: parsed.summary,
  };
}

function deterministicFallback(events: EvidenceEvent[], page: string): ClassificationResult {
  const last90 = eventsInWindow(events, 90);
  const negative = eventsOfType(last90, "claim_removed", "claim_softened", "revert_detected", "talk_thread_opened");
  const reverts = eventsOfType(last90, "revert_detected").length;
  const talks = eventsOfType(last90, "talk_thread_opened", "talk_reply_added").length;
  const referenceChanges = eventsOfType(last90, "citation_added", "citation_removed", "citation_replaced").length;

  const signals: ClassifiedSignal[] = [
    { signalName: "negative_claims", status: negative.length > 2 ? "contested" : "stable", strength: Math.min(1, negative.length / 10), rationale: `${negative.length} negative-claim events.` },
    { signalName: "revert_activity", status: reverts >= 2 ? "contested" : reverts > 0 ? "needs_review" : "stable", strength: Math.min(1, reverts / 5), rationale: `${reverts} revert(s).` },
    { signalName: "dispute_activity", status: talks > 0 ? "contested" : "stable", strength: Math.min(0.7, talks / 5), rationale: `${talks} talk event(s).` },
    { signalName: "source_quality", status: referenceChanges > 3 ? "elevated_risk" : referenceChanges > 0 ? "needs_review" : "stable", strength: Math.min(1, referenceChanges / 10), rationale: `${referenceChanges} reference change(s).` },
    { signalName: "source_fragility", status: "needs_review", strength: 0.5, rationale: "Deterministic estimate. Enable model for detailed assessment." },
    { signalName: "controversy_sections", status: "stable", strength: 0, rationale: "Section-level analysis requires model." },
    { signalName: "source_churn", status: last90.length > 50 ? "elevated_risk" : "stable", strength: Math.min(1, last90.length / 100), rationale: `${last90.length} total events.` },
    { signalName: "recent_changes", status: eventsInWindow(events, 14).length > 3 ? "needs_review" : "stable", strength: 0, rationale: "Recent activity." },
  ];

  return { signals, modelUsed: "none (deterministic fallback)", summary: `${page}: deterministic assessment with ${signals.filter((s) => s.status !== "stable").length} non-stable signals.` };
}

export async function classifyReference(events: EvidenceEvent[], page: string): Promise<ClassificationResult> {
  if (events.length === 0) return { signals: [], modelUsed: "n/a", summary: "No events." };
  const config = getProvider();
  if (config) {
    try { return await classifyWithModel(events, page, config); } catch (err) { console.warn(`Model failed, falling back: ${err}`); }
  }
  return deterministicFallback(events, page);
}
