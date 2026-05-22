import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { eventsInWindow, eventsOfType } from "../lib/signals.js";
import { getProvider, callModel, type ProviderConfig } from "../lib/inference.js";

interface NormativeShift {
  section: string;
  direction: "strengthened" | "weakened" | "added" | "removed" | "scope_change" | "exception_carved";
  keywords: string[];
  significance: number;
  rationale: string;
}

interface ClassificationResult {
  shifts: NormativeShift[];
  modelUsed: string;
  summary: string;
}

const SYSTEM_PROMPT = "You are a standards analyst tracking normative language changes in specifications. Detect subtle shifts beyond keyword matching — scope changes, exception carving, tense changes. Return only valid JSON.";

function buildPrompt(events: EvidenceEvent[], page: string): string {
  const last90 = eventsInWindow(events, 90);
  const wording = eventsOfType(last90, "claim_reworded", "claim_softened", "claim_strengthened", "claim_removed");
  const sample = wording.slice(0, 8);

  return `Page: "${page}" (standards/specification document)

Wording changes (last 90 days):\n${sample.map((e, i) =>
  `  ${i + 1}. [${e.eventType}] section: ${e.section || "(unknown)"}\n     before: ${(e.before ?? "").substring(0, 300)}\n     after: ${(e.after ?? "").substring(0, 300)}`
).join("\n")}

Respond with JSON:
{"shifts": [{"section": string, "direction": enum, "keywords": string[], "significance": 0-1, "rationale": string}], "summary": string}
Directions: strengthened, weakened, added, removed, scope_change, exception_carved`;
}

async function classifyWithModel(events: EvidenceEvent[], page: string, config: ProviderConfig): Promise<ClassificationResult> {
  const prompt = buildPrompt(events, page);
  const raw = await callModel(config, SYSTEM_PROMPT, prompt, { maxTokens: 1000 });
  const parsed = JSON.parse(raw);
  return {
    shifts: parsed.shifts,
    modelUsed: `${config.model} (${config.endpoint})`,
    summary: parsed.summary,
  };
}

function deterministicFallback(events: EvidenceEvent[], page: string): ClassificationResult {
  const last90 = eventsInWindow(events, 90);
  const wording = eventsOfType(last90, "claim_reworded", "claim_softened", "claim_strengthened", "claim_removed");
  const rfcKeywords = ["MUST", "SHOULD", "MAY", "REQUIRED", "SHALL", "RECOMMENDED", "OPTIONAL"];

  const shifts: NormativeShift[] = [];
  for (const e of wording.slice(0, 10)) {
    if (!e.before || !e.after) continue;
    for (const kw of rfcKeywords) {
      const inBefore = e.before.toUpperCase().includes(kw);
      const inAfter = e.after.toUpperCase().includes(kw);
      if (inBefore && !inAfter) { shifts.push({ section: e.section || "(unknown)", direction: "removed", keywords: [kw], significance: 0.6, rationale: `${kw} removed.` }); break; }
      if (!inBefore && inAfter) { shifts.push({ section: e.section || "(unknown)", direction: "added", keywords: [kw], significance: 0.7, rationale: `${kw} added.` }); break; }
    }
  }

  return {
    shifts,
    modelUsed: "none (deterministic fallback)",
    summary: `${page}: ${shifts.length} RFC 2119 keyword shift(s) detected deterministically. Enable model for scope and exception detection.`,
  };
}

export async function classifyNormativeChanges(events: EvidenceEvent[], page: string): Promise<ClassificationResult> {
  if (events.length === 0) return { shifts: [], modelUsed: "n/a", summary: "No events." };
  const config = getProvider();
  if (config) {
    try { return await classifyWithModel(events, page, config); } catch (err) { console.warn(`Model failed, falling back: ${err}`); }
  }
  return deterministicFallback(events, page);
}
