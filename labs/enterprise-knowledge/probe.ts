import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { eventsInWindow, countEventType, eventsOfType, sectionChurn } from "../lib/signals.js";
import { classifyGovernance } from "./classify.js";
import { runProbe } from "../lib/runProbe.js";

interface KnowledgeSignal {
  signal: string;
  description: string;
  count: number;
  sections: string[];
}

interface KnowledgeReport {
  generatedAt: string;
  signals: KnowledgeSignal[];
  staleSections: string[];
  classification?: {
    sections: { section: string; classification: string; confidence: number; rationale: string }[];
    modelUsed: string;
    summary: string;
  };
  summary: string;
}

function deterministicAnalysis(events: EvidenceEvent[]): {
  signals: KnowledgeSignal[];
  staleSections: string[];
  summary: string;
} {
  const last180 = eventsInWindow(events, 180);
  const churn = sectionChurn(last180);

  const claimEvents = eventsOfType(last180, "claim_first_seen", "claim_removed", "claim_reworded", "claim_strengthened", "claim_softened");
  const citationEvents = eventsOfType(last180, "citation_added", "citation_removed", "citation_replaced");
  const structureEvents = eventsOfType(last180, "section_reorganized", "template_added", "template_removed");

  const signals: KnowledgeSignal[] = [
    {
      signal: "claim_addition_drift",
      description: "New claims or substantive rewordings indicating policy/content evolution",
      count: countEventType(last180, "sentence_first_seen"),
      sections: claimEvents.filter((e) => e.eventType === "sentence_first_seen").slice(0, 5).map((e) => e.section || "(lead)"),
    },
    {
      signal: "claim_removal_staleness",
      description: "Claims removed or deprecated, potentially indicating stale content cleanup",
      count: countEventType(last180, "sentence_removed"),
      sections: claimEvents.filter((e) => e.eventType === "sentence_removed").slice(0, 5).map((e) => e.section || "(lead)"),
    },
    {
      signal: "source_currency",
      description: "Citation additions/removals indicating reference freshness",
      count: citationEvents.length,
      sections: citationEvents.slice(0, 3).map((e) => e.section || "(lead)"),
    },
    {
      signal: "structural_reorganization",
      description: "Section splits, template changes indicating governance restructuring",
      count: structureEvents.length,
      sections: structureEvents.slice(0, 3).map((e) => e.section || "(lead)"),
    },
    {
      signal: "contradiction_flag",
      description: "Claim rewording or reverts suggesting conflicting knowledge",
      count: countEventType(last180, "claim_reworded") + countEventType(last180, "revert_detected"),
      sections: eventsOfType(last180, "claim_reworded", "revert_detected").slice(0, 3).map((e) => e.section || "(lead)"),
    },
  ];

  const avgChurn = churn.size > 0 ? Array.from(churn.values()).reduce((a, b) => a + b, 0) / churn.size : 0;
  const staleThreshold = avgChurn > 0 ? avgChurn * 2 : 5;
  const staleSections = Array.from(churn.entries()).filter(([, c]) => c > staleThreshold).map(([s]) => s);

  return {
    signals,
    staleSections,
    summary: `${events.length} total events. ${signals.map((s) => `${s.signal}: ${s.count}`).join(", ")}`,
  };
}

async function analyze(events: EvidenceEvent[], _page: string): Promise<KnowledgeReport> {
  const base = deterministicAnalysis(events);
  const classification = await classifyGovernance(events, "");
  const hasModel = classification.modelUsed !== "none (deterministic fallback)";

  return {
    generatedAt: new Date().toISOString(),
    signals: base.signals,
    staleSections: base.staleSections,
    ...(hasModel ? { classification: { sections: classification.sections, modelUsed: classification.modelUsed, summary: classification.summary } } : {}),
    summary: hasModel ? classification.summary : base.summary,
  };
}

async function main() {
  await runProbe(
    "Usage: node --import tsx enterprise-knowledge/probe.ts <events.jsonl>",
    analyze,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
