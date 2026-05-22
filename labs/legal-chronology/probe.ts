import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { classifyTimeline } from "./classify.js";
import { runProbe } from "../lib/runProbe.js";

interface TimelineEntry {
  revisionId: number;
  timestamp: string;
  section: string;
  eventType: string;
  before: string;
  after: string;
}

interface ChronologyReport {
  generatedAt: string;
  disclaimer: string;
  timeline: TimelineEntry[];
  classification?: {
    significantEvents: { timestamp: string; eventType: string; significance: string; rationale: string }[];
    keyDates: { date: string; label: string }[];
    modelUsed: string;
    summary: string;
  };
  summary: string;
}

async function analyze(events: EvidenceEvent[], _page: string): Promise<ChronologyReport> {
  const timeline: TimelineEntry[] = events.map((e) => ({
    revisionId: e.fromRevisionId,
    timestamp: e.timestamp,
    section: e.section || "(unknown)",
    eventType: e.eventType,
    before: (e.before ?? "").substring(0, 500),
    after: (e.after ?? "").substring(0, 500),
  }));

  const baseSummary = `${timeline.length} revision events across ${new Set(timeline.map((t) => t.section)).size} sections`;

  const classification = await classifyTimeline(events, "");
  const hasModel = classification.modelUsed !== "none (deterministic fallback)";

  return {
    generatedAt: new Date().toISOString(),
    disclaimer: "This is a public revision chronology, not legal advice. Content reflects Wikipedia editing activity, not verified facts. See disclaimer.md for details.",
    timeline,
    ...(hasModel ? { classification: { significantEvents: classification.significantEvents, keyDates: classification.keyDates, modelUsed: classification.modelUsed, summary: classification.summary } } : {}),
    summary: hasModel ? classification.summary : baseSummary,
  };
}

async function main() {
  await runProbe(
    "Usage: node --import tsx legal-chronology/probe.ts <events.jsonl>",
    analyze,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
