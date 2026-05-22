import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { eventsInWindow, eventsOfType, countEventType } from "../lib/signals.js";
import { getProvider, callModel, type ProviderConfig } from "../lib/inference.js";

interface SignificantEvent {
  timestamp: string;
  eventType: string;
  significance: "high" | "medium" | "low";
  rationale: string;
}

interface ClassificationResult {
  significantEvents: SignificantEvent[];
  keyDates: { date: string; label: string }[];
  modelUsed: string;
  summary: string;
}

const SYSTEM_PROMPT = "You are a legal researcher reviewing a public revision chronology. Identify which events are significant for establishing a timeline of public knowledge — content changes, structural shifts, and dispute activity. This is NOT legal advice. Return only valid JSON.";

function buildPrompt(events: EvidenceEvent[], page: string): string {
  const last90 = eventsInWindow(events, 90);
  const nonTrivial = eventsOfType(last90, "sentence_first_seen", "sentence_removed", "revert_detected", "protection_changed", "section_reorganized", "talk_thread_opened");
  const sample = nonTrivial.slice(0, 15);

  return `Page: "${page}"

Notable events (last 90 days):\n${sample.map((e, i) =>
  `  ${i + 1}. ${e.timestamp} [${e.eventType}] section: ${e.section || "(unknown)"}\n     detail: ${e.deterministicFacts[0]?.fact ?? ""}`
).join("\n")}

Respond with JSON:
{"significantEvents": [{"timestamp": string, "eventType": string, "significance": enum, "rationale": string}], "keyDates": [{"date": string, "label": string}], "summary": string}
Significance: high, medium, low`;
}

async function classifyWithModel(events: EvidenceEvent[], page: string, config: ProviderConfig): Promise<ClassificationResult> {
  const prompt = buildPrompt(events, page);
  const raw = await callModel(config, SYSTEM_PROMPT, prompt, { maxTokens: 800 });
  const parsed = JSON.parse(raw);
  return {
    significantEvents: parsed.significantEvents,
    keyDates: parsed.keyDates,
    modelUsed: `${config.model} (${config.endpoint})`,
    summary: parsed.summary,
  };
}

function deterministicFallback(events: EvidenceEvent[], page: string): ClassificationResult {
  const last90 = eventsInWindow(events, 90);
  const reverts = countEventType(last90, "revert_detected");
  const protections = countEventType(last90, "protection_changed");

  const significantEvents: SignificantEvent[] = [];
  if (reverts > 0) significantEvents.push({ timestamp: last90.find((e) => e.eventType === "revert_detected")?.timestamp ?? "", eventType: "revert_detected", significance: "medium", rationale: `${reverts} revert(s) in 90 days.` });
  if (protections > 0) significantEvents.push({ timestamp: last90.find((e) => e.eventType === "protection_changed")?.timestamp ?? "", eventType: "protection_changed", significance: "high", rationale: `Protection level changed.` });

  return {
    significantEvents,
    keyDates: [],
    modelUsed: "none (deterministic fallback)",
    summary: `${page}: ${significantEvents.length} significant event(s) flagged deterministically. Enable model for detailed timeline analysis.`,
  };
}

export async function classifyTimeline(events: EvidenceEvent[], page: string): Promise<ClassificationResult> {
  if (events.length === 0) return { significantEvents: [], keyDates: [], modelUsed: "n/a", summary: "No events." };
  const config = getProvider();
  if (config) {
    try { return await classifyWithModel(events, page, config); } catch (err) { console.warn(`Model failed, falling back: ${err}`); }
  }
  return deterministicFallback(events, page);
}
