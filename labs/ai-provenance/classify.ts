import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { eventsInWindow, countEventType, sectionChurn } from "../lib/signals.js";
import { getProvider, callModel, type ProviderConfig } from "../lib/inference.js";

interface NuancedSignal {
  label: "hardening" | "weakening" | "contestation" | "stabilization" | "ratification";
  strength: number;
  rationale: string;
}

interface ClassificationResult {
  signals: NuancedSignal[];
  modelUsed: string;
  summary: string;
}

const SYSTEM_PROMPT = "You are analyzing Wikipedia edit history for provenance signals. Return only valid JSON.";

function buildPrompt(events: EvidenceEvent[], page: string, topEvents: number): string {
  const window = eventsInWindow(events, 90);
  const churn = sectionChurn(window);
  const reverts = countEventType(window, "revert_detected");
  const talks = countEventType(window, "talk_thread_opened");

  const topChurn = Array.from(churn.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, topEvents)
    .map(([s, c]) => `${s}: ${c} edits`);

  const sampleEdits = window.slice(-5).map(
    (e) => `  [${e.eventType}] ${e.section || "(lead)"} at ${e.timestamp}`
  );

  return `Page: "${page}"

Metrics (last 90 days):
- Total edits: ${window.length}
- Reverts: ${reverts}
- Talk thread activity: ${talks}
- High-churn sections:\n${topChurn.map((s) => "  - " + s).join("\n")}

Sample recent edits:\n${sampleEdits.join("\n")}

Respond with JSON: {"signals": [{"label": enum, "strength": 0-1, "rationale": "..."}], "summary": "one sentence"}
Labels: hardening, weakening, contestation, stabilization, ratification`;
}

async function classifyWithModel(events: EvidenceEvent[], page: string, config: ProviderConfig, topEvents: number): Promise<ClassificationResult> {
  const prompt = buildPrompt(events, page, topEvents);
  const raw = await callModel(config, SYSTEM_PROMPT, prompt);
  const parsed = JSON.parse(raw);
  return {
    signals: parsed.signals,
    modelUsed: `${config.model} (${config.endpoint})`,
    summary: parsed.summary,
  };
}

function deterministicFallback(events: EvidenceEvent[], page: string): ClassificationResult {
  const window = eventsInWindow(events, 90);
  const reverts = countEventType(window, "revert_detected");
  const talks = countEventType(window, "talk_thread_opened");
  const editCount = window.length;

  const signals: NuancedSignal[] = [];

  if (editCount < 5) {
    signals.push({ label: "stabilization", strength: 0.8, rationale: "Fewer than 5 edits in 90 days." });
  } else if (editCount < 20) {
    signals.push({ label: "stabilization", strength: 0.4, rationale: "Moderate edit activity." });
  } else {
    signals.push({ label: "weakening", strength: Math.min(0.9, editCount / 100), rationale: `${editCount} edits in 90 days.` });
  }

  if (reverts > 0) {
    signals.push({ label: "contestation", strength: Math.min(0.9, reverts / 5), rationale: `${reverts} revert(s) detected.` });
  }
  if (talks > 0) {
    signals.push({ label: "contestation", strength: Math.min(0.7, talks / 3), rationale: `${talks} talk thread(s) opened.` });
  }

  if (signals.length === 0) {
    signals.push({ label: "ratification", strength: 0.6, rationale: "No significant change signals detected." });
  }

  const primary = signals.reduce((a, b) => (a.strength > b.strength ? a : b));
  return {
    signals,
    modelUsed: "none (deterministic fallback)",
    summary: `${page}: ${primary.label} (strength ${primary.strength.toFixed(2)}) — ${primary.rationale}`,
  };
}

export async function classifyEvents(events: EvidenceEvent[], page: string, options?: { topEvents?: number }): Promise<ClassificationResult> {
  if (events.length === 0) {
    return { signals: [], modelUsed: "n/a", summary: "No events to analyze." };
  }

  const config = getProvider();
  if (config) {
    try {
      return await classifyWithModel(events, page, config, options?.topEvents ?? 5);
    } catch (err) {
      console.warn(`Model inference failed, falling back to deterministic: ${err}`);
    }
  }

  return deterministicFallback(events, page);
}
