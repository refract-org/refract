import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { eventsInWindow, eventsOfType, countEventType } from "../lib/signals.js";
import { classifyCanonEvents } from "./classify.js";
import { runProbe } from "../lib/runProbe.js";

const CANON_EVENT_TYPES = ["claim_strengthened", "claim_softened", "claim_reworded", "claim_reintroduced", "revert_detected", "claim_removed", "section_reorganized"] as const;

interface CanonSignalReport {
  page: string;
  generatedAt: string;
  canonDisputes: { count: number; section: string; description: string }[];
  retcons: { before: string; after: string; confidence: number }[];
  powerScaling: { change: "upgraded" | "downgraded" | "uncertain"; events: number }[];
  sourceHierarchyConflicts: { section: string; oldSourceType: string; newSourceType: string }[];
  classification?: {
    classified: { eventType: string; classification: string; confidence: number; rationale: string }[];
    modelUsed: string;
    summary: string;
  };
  summary: string;
}

function deterministicAnalysis(events: EvidenceEvent[], page: string): {
  canonDisputes: CanonSignalReport["canonDisputes"];
  retcons: CanonSignalReport["retcons"];
  powerScaling: CanonSignalReport["powerScaling"];
  summary: string;
} {
  const last90 = eventsInWindow(events, 90);
  const reverts = eventsOfType(last90, "revert_detected");

  const canonDisputes = reverts.map((r) => ({
    section: r.section || "(unknown)",
    description: r.deterministicFacts[0]?.fact ?? "Revert detected",
    count: 1,
  }));

  const retcons = eventsOfType(last90, "claim_reworded", "claim_softened", "claim_reintroduced")
    .filter((e) => e.section?.toLowerCase().includes("canon"))
    .map((e) => ({
      before: e.before ?? "",
      after: e.after ?? "",
      confidence: 0,
    }));

  const strengthening = countEventType(last90, "claim_strengthened");
  const softening = countEventType(last90, "claim_softened");

  const powerScaling = [
    { change: "upgraded" as const, events: strengthening },
    { change: "downgraded" as const, events: softening },
    { change: "uncertain" as const, events: countEventType(last90, "claim_reworded") },
  ];

  return {
    canonDisputes: canonDisputes.slice(0, 5),
    retcons: retcons.slice(0, 5),
    powerScaling,
    summary: `${page}: ${canonDisputes.length} canon disputes, ${retcons.length} retcons, ${strengthening} power upgrades / ${softening} downgrades in 90 days`,
  };
}

async function analyze(events: EvidenceEvent[], page: string): Promise<CanonSignalReport> {
  const base = deterministicAnalysis(events, page);
  const classification = await classifyCanonEvents(events, page, { topEvents: 10 });
  const hasModel = classification.modelUsed !== "none (deterministic fallback)";

  return {
    page,
    generatedAt: new Date().toISOString(),
    canonDisputes: base.canonDisputes,
    retcons: base.retcons,
    powerScaling: base.powerScaling,
    sourceHierarchyConflicts: [],
    ...(hasModel ? { classification: { classified: classification.classified, modelUsed: classification.modelUsed, summary: classification.summary } } : {}),
    summary: hasModel ? classification.summary : base.summary,
  };
}

async function main() {
  await runProbe(
    "Usage: node --import tsx fandom-canon/probe.ts <events.jsonl> [page-name]",
    analyze,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
