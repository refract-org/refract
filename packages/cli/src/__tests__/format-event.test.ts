import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { describe, expect, it } from "vitest";
import { formatEvent } from "../render.js";

const event = (eventType: string, before: string, after: string) =>
  ({
    eventType,
    fromRevisionId: 1,
    toRevisionId: 2,
    section: "(lead)",
    before,
    after,
    deterministicFacts: [],
  }) as unknown as EvidenceEvent;

describe("formatEvent", () => {
  it("shows the changed wording of a sentence event", () => {
    const line = formatEvent(event("sentence_modified", "Pluto is a planet", "Pluto was a planet"));
    expect(line).toContain("Before: Pluto is a planet");
    expect(line).toContain("After:  Pluto was a planet");
  });

  it("omits a side the event does not have", () => {
    const line = formatEvent(event("citation_removed", "<ref>A</ref>", ""));
    expect(line).toContain("Before: <ref>A</ref>");
    expect(line).not.toContain("After:");
  });

  it("flattens and shortens long passages", () => {
    const line = formatEvent(event("sentence_first_seen", "", `Line one\n\n${"word ".repeat(100)}`));
    expect(line).toContain("After:  Line one word");
    expect(line).toContain("…");
    expect(line).not.toContain("Line one\n");
  });

  it("does not print whole sections", () => {
    const line = formatEvent(event("section_reorganized", "whole section before", "whole section after"));
    expect(line).not.toContain("whole section");
  });
});
