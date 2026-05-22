import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { eventsInWindow, eventsOfType, countEventType } from "../lib/signals.js";
import { getProvider, callModel, type ProviderConfig } from "../lib/inference.js";

interface CanonClassification {
  eventType: string;
  classification: "retcon" | "continuity_error" | "canon_dispute" | "legitimate_update" | "housekeeping" | "uncertain";
  confidence: number;
  rationale: string;
}

interface ClassificationResult {
  classified: CanonClassification[];
  modelUsed: string;
  summary: string;
}

const SYSTEM_PROMPT = "You are a fandom wiki expert classifying editorial changes. Distinguish retcons, continuity errors, canon disputes, legitimate updates, and housekeeping edits. Return only valid JSON.";

function buildPrompt(events: EvidenceEvent[], page: string, topEvents: number): string {
  const last90 = eventsInWindow(events, 90);
  const reverted = eventsOfType(last90, "revert_detected", "claim_reworded", "claim_softened", "claim_reintroduced");
  const sample = reverted.slice(0, topEvents);

  return `Page: "${page}" (fandom wiki)

Events sample (last 90 days):\n${sample.map((e, i) =>
  `  ${i + 1}. [${e.eventType}] section: ${e.section || "(unknown)"}\n     before: ${(e.before ?? "").substring(0, 200)}\n     after: ${(e.after ?? "").substring(0, 200)}`
).join("\n")}

Respond with JSON:
{"classified": [{"eventType": string, "classification": enum, "confidence": 0-1, "rationale": string}], "summary": string}
Classifications: retcon, continuity_error, canon_dispute, legitimate_update, housekeeping, uncertain`;
}

async function classifyWithModel(events: EvidenceEvent[], page: string, config: ProviderConfig, topEvents: number): Promise<ClassificationResult> {
  const prompt = buildPrompt(events, page, topEvents);
  const raw = await callModel(config, SYSTEM_PROMPT, prompt, { maxTokens: 1000 });
  const parsed = JSON.parse(raw);
  return {
    classified: parsed.classified,
    modelUsed: `${config.model} (${config.endpoint})`,
    summary: parsed.summary,
  };
}

function deterministicFallback(events: EvidenceEvent[], page: string): ClassificationResult {
  const last90 = eventsInWindow(events, 90);
  const reverts = countEventType(last90, "revert_detected");
  const reworded = eventsOfType(last90, "claim_reworded", "claim_softened");

  const classified: CanonClassification[] = reworded.slice(0, 5).map((e) => ({
    eventType: e.eventType,
    classification: e.section?.toLowerCase().includes("canon") ? "canon_dispute" : "uncertain",
    confidence: 0.3,
    rationale: `Section: ${e.section || "(unknown)"}. Deterministic only.`,
  }));

  reverts > 0 && classified.push({
    eventType: "revert_detected",
    classification: reverts > 2 ? "canon_dispute" : "continuity_error",
    confidence: 0.4,
    rationale: `${reverts} revert(s). Enable model for precise classification.`,
  });

  return {
    classified,
    modelUsed: "none (deterministic fallback)",
    summary: `${page}: ${classified.filter((c) => c.classification !== "uncertain").length} potential canon-related events. Enable model for precise classification.`,
  };
}

export async function classifyCanonEvents(events: EvidenceEvent[], page: string, options?: { topEvents?: number }): Promise<ClassificationResult> {
  if (events.length === 0) return { classified: [], modelUsed: "n/a", summary: "No events." };
  const config = getProvider();
  if (config) {
    try { return await classifyWithModel(events, page, config, options?.topEvents ?? 10); } catch (err) { console.warn(`Model failed, falling back: ${err}`); }
  }
  return deterministicFallback(events, page);
}
