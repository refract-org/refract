import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { eventsInWindow, eventsOfType, countEventType, sectionChurn } from "../lib/signals.js";
import { getProvider, callModel, type ProviderConfig } from "../lib/inference.js";

interface GovernanceClassification {
  section: string;
  classification: "policy_drift" | "normal_evolution" | "cleanup" | "restructuring" | "contradiction" | "uncertain";
  confidence: number;
  rationale: string;
}

interface ClassificationResult {
  sections: GovernanceClassification[];
  modelUsed: string;
  summary: string;
}

const SYSTEM_PROMPT = "You are a knowledge governance analyst reviewing enterprise wiki changes. Classify whether changes represent policy drift, normal evolution, cleanup, restructuring, or contradiction. Return only valid JSON.";

function buildPrompt(events: EvidenceEvent[], page: string): string {
  const last180 = eventsInWindow(events, 180);
  const churn = sectionChurn(last180);
  const topSections = Array.from(churn.entries()).sort(([, a], [, b]) => b - a).slice(0, 8);

  return `Page: "${page}" (enterprise knowledge base)

Sections by edit activity (last 180 days):\n${topSections.map(([s, c], i) => {
  const sectionEvents = last180.filter((e) => (e.section || "(lead)") === s).slice(0, 3);
  return `  ${i + 1}. "${s}" — ${c} edits\n${sectionEvents.map((e) => `     [${e.eventType}] ${e.deterministicFacts[0]?.fact ?? ""}`).join("\n")}`;
}).join("\n")}

Respond with JSON:
{"sections": [{"section": string, "classification": enum, "confidence": 0-1, "rationale": string}], "summary": string}
Classifications: policy_drift, normal_evolution, cleanup, restructuring, contradiction, uncertain`;
}

async function classifyWithModel(events: EvidenceEvent[], page: string, config: ProviderConfig): Promise<ClassificationResult> {
  const prompt = buildPrompt(events, page);
  const raw = await callModel(config, SYSTEM_PROMPT, prompt, { maxTokens: 800 });
  const parsed = JSON.parse(raw);
  return {
    sections: parsed.sections,
    modelUsed: `${config.model} (${config.endpoint})`,
    summary: parsed.summary,
  };
}

function deterministicFallback(events: EvidenceEvent[], page: string): ClassificationResult {
  const last180 = eventsInWindow(events, 180);
  const churn = sectionChurn(last180);
  const avgChurn = churn.size > 0 ? Array.from(churn.values()).reduce((a, b) => a + b, 0) / churn.size : 0;

  const sections: GovernanceClassification[] = Array.from(churn.entries())
    .filter(([, c]) => c > avgChurn * 2)
    .slice(0, 5)
    .map(([section, count]) => ({
      section,
      classification: countEventType(last180, "revert_detected") > 0 ? "contradiction" : count > 10 ? "restructuring" : "normal_evolution",
      confidence: 0.4,
      rationale: `${count} edits in 180 days. Enable model for precise classification.`,
    }));

  return {
    sections,
    modelUsed: "none (deterministic fallback)",
    summary: `${page}: ${sections.length} high-churn section(s) flagged. Enable model for governance classification.`,
  };
}

export async function classifyGovernance(events: EvidenceEvent[], page: string): Promise<ClassificationResult> {
  if (events.length === 0) return { sections: [], modelUsed: "n/a", summary: "No events." };
  const config = getProvider();
  if (config) {
    try { return await classifyWithModel(events, page, config); } catch (err) { console.warn(`Model failed, falling back: ${err}`); }
  }
  return deterministicFallback(events, page);
}
