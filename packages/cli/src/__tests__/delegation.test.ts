import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { describe, expect, it } from "vitest";

import { isWhenRule, matchesRule, WHEN_RULES } from "../commands/delegation.js";

const event = (overrides: Partial<EvidenceEvent> = {}): EvidenceEvent => ({
  eventId: "evt-1",
  eventType: "claim_modified",
  fromRevisionId: 100,
  toRevisionId: 101,
  section: "Efficacy",
  before: "a",
  after: "b",
  deterministicFacts: [],
  layer: "deterministic",
  timestamp: "2026-09-01T00:00:00.000Z",
  directionSignal: "weakening",
  ...overrides,
});

describe("the rule the operator picks", () => {
  it("every rule names a predicate over fields the event already carries", () => {
    // If a rule ever needs something the event does not have, it is a judgment
    // being computed here rather than one the operator made.
    for (const rule of Object.keys(WHEN_RULES)) {
      expect(isWhenRule(rule)).toBe(true);
      expect(() => matchesRule(event(), rule as never)).not.toThrow();
    }
  });

  it("separates the direction rules from each other", () => {
    expect(matchesRule(event(), "weakening")).toBe(true);
    expect(matchesRule(event(), "strengthening")).toBe(false);
    expect(matchesRule(event({ directionSignal: "strengthening" }), "strengthening")).toBe(true);
    expect(matchesRule(event({ directionSignal: "neutral" }), "direction-changed")).toBe(false);
    expect(matchesRule(event(), "direction-changed")).toBe(true);
  });

  it("matches a removed citation by event type, not by text", () => {
    expect(matchesRule(event({ eventType: "citation_removed" }), "citation-removed")).toBe(true);
    expect(matchesRule(event(), "citation-removed")).toBe(false);
  });

  it("lets the operator say every event counts", () => {
    // A legitimate answer, and still a choice someone made rather than a
    // behaviour that arrived switched on.
    expect(matchesRule(event({ directionSignal: "neutral" }), "any")).toBe(true);
  });

  it("rejects anything that is not a rule", () => {
    expect(isWhenRule("whatever")).toBe(false);
    expect(isWhenRule("")).toBe(false);
  });
});
