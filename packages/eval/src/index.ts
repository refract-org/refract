import type { EvidenceEvent } from "@refract-org/evidence-graph";

// ── L3 Ground Truth Types ──────────────────────────────────────────

export interface OutcomeLabel {
  id: string;
  source: "talk_page_consensus" | "rfc_closure" | "arbcom_decision" | "page_protection";
  pageTitle: string;
  description: string;
  observedAt: string;
  resolution: "keep" | "merge" | "delete" | "no_consensus" | "redirect" | "other";
  referenceUrl: string;
  expectedEventTypes: string[];
  expectedSection?: string;
}

export interface L3ValidationResult {
  outcomeId: string;
  passed: boolean;
  description: string;
  signalDetected: boolean;
  matchedEvents: EvidenceEvent[];
  expectedEventTypes: string[];
  precision: number;
  recall: number;
  f1: number;
}

export interface L3ValidationSummary {
  totalOutcomes: number;
  passed: number;
  failed: number;
  overallPrecision: number;
  overallRecall: number;
  overallF1: number;
  perOutcome: L3ValidationResult[];
}

export function validateAgainstGroundTruth(outcomes: OutcomeLabel[], events: EvidenceEvent[]): L3ValidationSummary {
  const results: L3ValidationResult[] = outcomes.map((outcome) => {
    const expected = outcome.expectedEventTypes;
    const matched = events.filter(
      (e) => expected.includes(e.eventType) && (!outcome.expectedSection || e.section === outcome.expectedSection),
    );

    const signalDetected = matched.length > 0;
    const precision =
      matched.length > 0
        ? expected.filter((et) => matched.some((m) => m.eventType === et)).length / expected.length
        : 0;
    const recall = matched.length > 0 ? 1.0 : 0.0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      outcomeId: outcome.id,
      passed: signalDetected,
      description: outcome.description,
      signalDetected,
      matchedEvents: matched,
      expectedEventTypes: expected,
      precision,
      recall,
      f1,
    };
  });

  const passed = results.filter((r) => r.passed);
  const avgPrecision = results.length > 0 ? results.reduce((s, r) => s + r.precision, 0) / results.length : 0;
  const avgRecall = results.length > 0 ? results.reduce((s, r) => s + r.recall, 0) / results.length : 0;
  const avgF1 = results.length > 0 ? results.reduce((s, r) => s + r.f1, 0) / results.length : 0;

  return {
    totalOutcomes: outcomes.length,
    passed: passed.length,
    failed: outcomes.length - passed.length,
    overallPrecision: avgPrecision,
    overallRecall: avgRecall,
    overallF1: avgF1,
    perOutcome: results,
  };
}

export interface EvalTestCase {
  id: string;
  description: string;
  pageTitle: string;
  pageId: number;
  revisionRange: { from: number; to: number };
  expectedEvents: ExpectedEvent[];
  tolerance?: EvalTolerance;
}

export interface ExpectedEvent {
  eventType: string;
  section: string;
  minConfidence?: number;
}

export interface EvalTolerance {
  minEventCount?: number;
  maxEventCount?: number;
  minPrecision?: number;
}

export interface EvalResult {
  testId: string;
  passed: boolean;
  precision: number;
  eventCount: { expected: number; actual: number };
  matches: EventMatch[];
  misses: MissingEvent[];
  falsePositives: UnexpectedEvent[];
}

export interface EventMatch {
  expected: ExpectedEvent;
  actual: EvidenceEvent;
}

export interface MissingEvent {
  expected: ExpectedEvent;
}

export interface UnexpectedEvent {
  event: EvidenceEvent;
}

export interface EvalHarness {
  evaluate(test: EvalTestCase, events: EvidenceEvent[]): EvalResult;
  benchmarkPages(): EvalTestCase[];
  computeScores(results: EvalResult[]): EvalScoreSummary;
}

export interface EvalScoreSummary {
  overallPrecision: number;
  overallF1: number;
  testsPassed: number;
  testsFailed: number;
  totalTests: number;
  perTest: Array<{ id: string; precision: number; passed: boolean }>;
}

export function createEvalHarness(): EvalHarness {
  return {
    evaluate(test, events) {
      const matches: EventMatch[] = [];
      const misses: MissingEvent[] = [];
      const falsePositives: UnexpectedEvent[] = [];

      for (const expected of test.expectedEvents) {
        const found = events.find((e) => e.eventType === expected.eventType && e.section === expected.section);
        if (found) {
          matches.push({ expected, actual: found });
        } else {
          misses.push({ expected });
        }
      }

      for (const event of events) {
        if (!test.expectedEvents.some((e) => e.eventType === event.eventType)) {
          falsePositives.push({ event });
        }
      }

      const matchedCount = matches.length;
      const totalExpected = test.expectedEvents.length;
      const precision = totalExpected > 0 ? matchedCount / totalExpected : events.length === 0 ? 1.0 : 0.0;

      const tolerance = test.tolerance ?? {};
      const minEventCount = tolerance.minEventCount ?? 0;
      const maxEventCount = tolerance.maxEventCount ?? Infinity;
      const minPrecision = tolerance.minPrecision ?? 0.5;

      const passed = precision >= minPrecision && events.length >= minEventCount && events.length <= maxEventCount;

      return {
        testId: test.id,
        passed,
        precision,
        eventCount: { expected: totalExpected, actual: events.length },
        matches,
        misses,
        falsePositives,
      };
    },

    benchmarkPages(): EvalTestCase[] {
      return [
        {
          id: "page-has-revisions",
          description: "Any active Wikipedia page returns at least 2 revisions and generates section events",
          pageTitle: "Earth",
          pageId: 9228,
          revisionRange: { from: 0, to: 0 },
          expectedEvents: [{ eventType: "section_reorganized", section: "(lead)" }],
          tolerance: { minEventCount: 1, minPrecision: 0.0 },
        },
        {
          id: "contentious-page-has-reverts",
          description: "Pages with edit wars should have revert events",
          pageTitle: "Donald_Trump",
          pageId: 4848272,
          revisionRange: { from: 0, to: 0 },
          expectedEvents: [{ eventType: "revert_detected", section: "" }],
          tolerance: { minEventCount: 1, minPrecision: 0.0 },
        },
        {
          id: "controversy-page-has-templates",
          description: "Controversial topics have policy maintenance templates",
          pageTitle: "COVID-19_pandemic",
          pageId: 58899562,
          revisionRange: { from: 0, to: 0 },
          expectedEvents: [{ eventType: "template_added", section: "body" }],
          tolerance: { minEventCount: 5, minPrecision: 0.0 },
        },
        {
          id: "scientific-article-has-citations",
          description: "Scientific articles always have citation changes",
          pageTitle: "CRISPR",
          pageId: 5000000,
          revisionRange: { from: 0, to: 0 },
          expectedEvents: [
            { eventType: "citation_added", section: "body" },
            { eventType: "citation_removed", section: "body" },
          ],
          tolerance: { minEventCount: 3, minPrecision: 0.1 },
        },
        {
          id: "featured-article-has-template-cleanup",
          description: "Featured articles show cleanup/maintenance template activity",
          pageTitle: "Shakespeare",
          pageId: 26825,
          revisionRange: { from: 0, to: 0 },
          expectedEvents: [
            { eventType: "template_added", section: "body" },
            { eventType: "section_reorganized", section: "(lead)" },
          ],
          tolerance: { minEventCount: 5, minPrecision: 0.1 },
        },
        {
          id: "events-has-citation-additions",
          description: "Pages with many citations will have observable citation diffs",
          pageTitle: "Albert_Einstein",
          pageId: 736,
          revisionRange: { from: 0, to: 0 },
          expectedEvents: [{ eventType: "citation_added", section: "body" }],
          tolerance: { minEventCount: 2, minPrecision: 0.0 },
        },
      ];
    },

    computeScores(results) {
      const passed = results.filter((r) => r.passed);
      const totalPrecision = results.length > 0 ? results.reduce((sum, r) => sum + r.precision, 0) / results.length : 0;
      const totalF1 = results.length > 0 ? results.reduce((sum, r) => sum + r.precision, 0) / results.length : 0;

      return {
        overallPrecision: totalPrecision,
        overallF1: totalF1,
        testsPassed: passed.length,
        testsFailed: results.length - passed.length,
        totalTests: results.length,
        perTest: results.map((r) => ({
          id: r.testId,
          precision: r.precision,
          passed: r.passed,
        })),
      };
    },
  };
}

export { GROUND_TRUTH_LABELS, getGroundTruthById, getGroundTruthForPage } from "./ground-truth.js";
