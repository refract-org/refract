import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { eventsInWindow, eventsOfType, countEventType } from "../lib/signals.js";
import { classifyNormativeChanges } from "./classify.js";
import { runProbe } from "../lib/runProbe.js";

interface RequirementShift {
  section: string;
  from: string;
  to: string;
  change: "strengthened" | "weakened" | "removed" | "added";
}

interface StandardsReport {
  page: string;
  generatedAt: string;
  requirementShifts: RequirementShift[];
  referenceChanges: { added: number; removed: number; replaced: number };
  classification?: {
    shifts: { section: string; direction: string; keywords: string[]; significance: number; rationale: string }[];
    modelUsed: string;
    summary: string;
  };
  summary: string;
}

function detectRfc2119Shift(before: string, after: string): { from: string; to: string } | null {
  const keywords = ["MUST", "SHOULD", "MAY", "REQUIRED", "SHALL", "RECOMMENDED", "OPTIONAL"];
  const beforeUpper = before.toUpperCase();
  const afterUpper = after.toUpperCase();

  for (const kw of keywords) {
    if (beforeUpper.includes(kw) && !afterUpper.includes(kw)) {
      const replacement = keywords.find((k) => afterUpper.includes(k));
      return { from: kw, to: replacement ?? "REMOVED" };
    }
    if (!beforeUpper.includes(kw) && afterUpper.includes(kw)) {
      return { from: "IMPLIED", to: kw };
    }
  }
  return null;
}

function deterministicAnalysis(events: EvidenceEvent[], page: string): {
  requirementShifts: RequirementShift[];
  referenceChanges: StandardsReport["referenceChanges"];
  summary: string;
} {
  const last90 = eventsInWindow(events, 90);
  const wordingEvents = eventsOfType(last90, "claim_reworded", "claim_softened", "claim_strengthened", "claim_removed");

  const shifts: RequirementShift[] = [];
  for (const e of wordingEvents) {
    if (e.before && e.after) {
      const shift = detectRfc2119Shift(e.before, e.after);
      if (shift) {
        shifts.push({
          section: e.section || "(unknown)",
          from: shift.from,
          to: shift.to,
          change: shift.to === "REMOVED" ? "removed" : shift.from === "IMPLIED" ? "added" : shift.to === "MUST" || shift.to === "REQUIRED" ? "strengthened" : "weakened",
        });
      }
    }
  }

  return {
    requirementShifts: shifts.slice(0, 10),
    referenceChanges: {
      added: countEventType(last90, "citation_added"),
      removed: countEventType(last90, "citation_removed"),
      replaced: countEventType(last90, "citation_replaced"),
    },
    summary: `${page}: ${shifts.length} requirement-language shift(s) detected in 90 days`,
  };
}

async function analyze(events: EvidenceEvent[], page: string): Promise<StandardsReport> {
  const base = deterministicAnalysis(events, page);
  const classification = await classifyNormativeChanges(events, page);
  const hasModel = classification.modelUsed !== "none (deterministic fallback)";

  return {
    page,
    generatedAt: new Date().toISOString(),
    requirementShifts: base.requirementShifts,
    referenceChanges: base.referenceChanges,
    ...(hasModel ? { classification: { shifts: classification.shifts, modelUsed: classification.modelUsed, summary: classification.summary } } : {}),
    summary: hasModel ? classification.summary : base.summary,
  };
}

async function main() {
  await runProbe(
    "Usage: node --import tsx standards-intelligence/probe.ts <events.jsonl> [page-name]",
    analyze,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
