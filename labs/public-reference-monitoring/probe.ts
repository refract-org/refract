import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { eventsInWindow, countEventType, eventsOfType, sectionChurn } from "../lib/signals.js";
import { classifyReference } from "./classify.js";
import { runProbe } from "../lib/runProbe.js";

type StabilityStatus = "stable" | "contested" | "recently_changed" | "source_fragile" | "high_source_churn";

interface ProbeSignal {
  status: StabilityStatus;
  description: string;
  evidence: string[];
}

interface ProbeReport {
  page: string;
  generatedAt: string;
  signals: {
    negativeClaims: ProbeSignal;
    controversySections: ProbeSignal;
    sourceQuality: ProbeSignal;
    sourceFragility: ProbeSignal;
    revertActivity: ProbeSignal;
    disputeActivity: ProbeSignal;
    sourceChurn: ProbeSignal;
    recentChanges: ProbeSignal;
  };
  sectionBreakdown: Record<string, { events: number; dispute: boolean }>;
  classification?: {
    signals: { signalName: string; status: string; strength: number; rationale: string }[];
    modelUsed: string;
    summary: string;
  };
  summary: string;
}

function deterministicAnalysis(events: EvidenceEvent[], page: string): {
  signals: ProbeReport["signals"];
  sectionBreakdown: Record<string, { events: number; dispute: boolean }>;
  summary: string;
} {
  const last90 = eventsInWindow(events, 90);
  const last14 = eventsInWindow(events, 14);

  const negativeClaimTypes = ["claim_removed", "claim_softened", "revert_detected", "talk_thread_opened"];
  const negativeEvents = eventsOfType(last90, ...negativeClaimTypes);

  const controversySectionMatches = events.filter(
    (e) =>
      e.section?.toLowerCase().includes("controvers") ||
      e.section?.toLowerCase().includes("criticism") ||
      e.section?.toLowerCase().includes("reception")
  );

  const citationEvents = eventsOfType(last90, "citation_added", "citation_removed", "citation_replaced");
  const addedCitations = countEventType(last90, "citation_added");
  const removedCitations = countEventType(last90, "citation_removed");
  const replacedCitations = countEventType(last90, "citation_replaced");

  const revertCount = countEventType(last90, "revert_detected");

  const talkEvents = eventsOfType(last90, "talk_thread_opened", "talk_thread_archived", "talk_reply_added", "talk_page_correlated");

  const churn = sectionChurn(last90);
  const avgChurn = churn.size > 0 ? Array.from(churn.values()).reduce((a, b) => a + b, 0) / churn.size : 0;

  const recentNeg = negativeEvents.filter((e) => last14.includes(e)).length;

  const signals: ProbeReport["signals"] = {
    negativeClaims: {
      status: recentNeg > 0 ? "recently_changed" : negativeEvents.length > 2 ? "contested" : "stable",
      description: `${negativeEvents.length} negative-claim events in 90 days${recentNeg > 0 ? ` (${recentNeg} in last 14 days)` : ""}`,
      evidence: negativeEvents.slice(0, 5).map((e) => `${e.eventType}: ${e.deterministicFacts[0]?.fact ?? e.section}`),
    },
    controversySections: {
      status: controversySectionMatches.length > 0 ? "contested" : "stable",
      description: `${controversySectionMatches.length} events in controversy/criticism sections`,
      evidence: controversySectionMatches.slice(0, 3).map((e) => `${e.section}: ${e.eventType}`),
    },
    sourceQuality: {
      status: replacedCitations > 3 ? "high_source_churn" : replacedCitations > 0 ? "recently_changed" : "stable",
      description: `${addedCitations} added, ${removedCitations} removed, ${replacedCitations} replaced in 90 days`,
      evidence: citationEvents.slice(0, 3).map((e) => `${e.eventType} in ${e.section}`),
    },
    sourceFragility: {
      status: "stable",
      description: "Source-fragility analysis requires model interpretation (L2). Not computed deterministically.",
      evidence: [],
    },
    revertActivity: {
      status: revertCount >= 2 ? "contested" : revertCount > 0 ? "recently_changed" : "stable",
      description: `${revertCount} revert${revertCount !== 1 ? "s" : ""} detected in 90 days`,
      evidence: eventsOfType(last90, "revert_detected").slice(0, 3).map((e) => `${e.section}: ${e.deterministicFacts[0]?.fact}`),
    },
    disputeActivity: {
      status: talkEvents.length > 0 ? "contested" : "stable",
      description: `${talkEvents.length} talk-page events in 90 days`,
      evidence: talkEvents.slice(0, 3).map((e) => `${e.eventType}: ${e.deterministicFacts[0]?.fact ?? e.section}`),
    },
    sourceChurn: {
      status: avgChurn > 4 ? "high_source_churn" : avgChurn > 1 ? "recently_changed" : "stable",
      description: `Avg ${avgChurn.toFixed(1)} events per section in 90 days`,
      evidence: [],
    },
    recentChanges: {
      status: last14.length > 3 ? "recently_changed" : last14.length > 0 ? "recently_changed" : "stable",
      description: `${last14.length} events in last 14 days`,
      evidence: last14.slice(0, 5).map((e) => `${e.timestamp}: ${e.eventType} in ${e.section}`),
    },
  };

  const sectionBreakdown: Record<string, { events: number; dispute: boolean }> = {};
  for (const [section, count] of churn) {
    const hasDispute = talkEvents.some((e) => e.section?.includes(section)) || eventsOfType(last90, "revert_detected").some((e) => e.section === section);
    sectionBreakdown[section] = { events: count, dispute: hasDispute };
  }

  const statuses = Object.values(signals).map((s) => s.status);
  const contestedCount = statuses.filter((s) => s === "contested").length;
  const changedCount = statuses.filter((s) => s === "recently_changed" || s === "high_source_churn").length;
  const stableCount = statuses.filter((s) => s === "stable").length;

  const summary = page
    ? `${page}: ${contestedCount} signal(s) contested, ${changedCount} recently changed, ${stableCount} stable. ${recentNeg > 0 ? `${recentNeg} negative-claim events in last 14 days. ` : ""}${revertCount >= 2 ? `${revertCount} reverts detected. ` : ""}${talkEvents.length > 0 ? `Active talk page discussion. ` : ""}`.trim()
    : `Contested: ${contestedCount}, Recently changed: ${changedCount}, Stable: ${stableCount}`;

  return { signals, sectionBreakdown, summary };
}

async function analyze(events: EvidenceEvent[], page: string): Promise<ProbeReport> {
  const base = deterministicAnalysis(events, page);
  const classification = await classifyReference(events, page);
  const hasModel = classification.modelUsed !== "none (deterministic fallback)";

  return {
    page,
    generatedAt: new Date().toISOString(),
    signals: base.signals,
    sectionBreakdown: base.sectionBreakdown,
    ...(hasModel ? { classification: { signals: classification.signals, modelUsed: classification.modelUsed, summary: classification.summary } } : {}),
    summary: hasModel ? classification.summary : base.summary,
  };
}

async function main() {
  await runProbe(
    "Usage: node --import tsx public-reference-monitoring/probe.ts <events.jsonl> [page-url]",
    analyze,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
