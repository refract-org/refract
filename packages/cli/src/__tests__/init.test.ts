import { MediaWikiClient } from "@refract-org/ingestion";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runInit } from "../commands/init.js";

describe("offline onboarding", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows changed wording, a removed citation, and returned text without fetching a wiki", async () => {
    const fetchRevisions = vi
      .spyOn(MediaWikiClient.prototype, "fetchRevisions")
      .mockRejectedValue(new Error("offline"));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await runInit();

    const output = log.mock.calls.map((args) => args.join(" ")).join("\n");
    expect(output).toContain("fictional");
    expect(output).toContain("Before: Rivergate Library is open until six every weekday");
    expect(output).toContain("After:  Rivergate Library is open until eight every weekday");
    expect(output).toContain("citation_removed");
    expect(output).toContain("https://example.org/rivergate/hours");
    expect(output).toContain("sentence_reintroduced");
    expect(fetchRevisions).not.toHaveBeenCalled();
  });

  it("exports reproducible NDJSON that a review workflow can filter offline", async () => {
    const fetchRevisions = vi
      .spyOn(MediaWikiClient.prototype, "fetchRevisions")
      .mockRejectedValue(new Error("offline"));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await runInit({ json: true });

    const lines = log.mock.calls.map((args) => args.join(" "));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((line) => line.startsWith("{"))).toBe(true);
    const events = lines.map((line) => JSON.parse(line));
    const removal = events.find((event) => event.eventType === "citation_removed");
    expect(removal).toMatchObject({
      fromRevisionId: 2,
      toRevisionId: 3,
      timestamp: "2025-01-03T12:00:00Z",
    });
    expect(removal.before).toContain("https://example.org/rivergate/hours");
    expect(events.some((event) => event.eventType === "sentence_modified" && event.before && event.after)).toBe(true);
    expect(events.some((event) => event.eventType === "sentence_reintroduced")).toBe(true);
    expect(events.every((event) => event.eventId && event.schemaVersion)).toBe(true);
    expect(events.flatMap((event) => event.deterministicFacts)).toContainEqual({
      fact: "source_kind",
      detail: "fictional_onboarding_sample",
    });
    expect(fetchRevisions).not.toHaveBeenCalled();

    log.mockClear();
    await runInit({ json: true });
    expect(log.mock.calls.map((args) => args.join(" "))).toEqual(lines);
  });
});
