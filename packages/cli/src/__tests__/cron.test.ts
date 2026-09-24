import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../commands/analyze.js", () => ({
  runAnalyze: vi.fn(),
  buildObservationReport: vi.fn(() => ({
    pageTitle: "",
    pageId: 0,
    observedAt: new Date().toISOString(),
    revisionRange: { from: 0, to: 0 },
    claims: {},
    eventCount: 0,
    merkleRoot: "",
    analyzerVersion: "0.3.1",
  })),
}));

import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { runAnalyze } from "../commands/analyze.js";
import { runCron } from "../commands/cron.js";

function makeEvent(overrides: Partial<EvidenceEvent> = {}): EvidenceEvent {
  return {
    eventType: "sentence_first_seen",
    fromRevisionId: 1,
    toRevisionId: 2,
    section: "lead",
    before: "",
    after: "Earth is a planet",
    deterministicFacts: [],
    layer: "observed",
    timestamp: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("cron command", () => {
  it("processes pages file and returns reports", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "Earth\nMars\n", "utf-8");

    vi.mocked(runAnalyze).mockResolvedValue({ events: [makeEvent()], revisions: [] });

    const result = await runCron(pagesFile, undefined, undefined, tmpDir);

    expect(result.pagesProcessed).toBe(2);
    expect(result.totalNewEvents).toBe(0);
    expect(result.reports).toHaveLength(2);
    expect(result.reports[0].pageTitle).toBe("Earth");
    expect(result.reports[0].deltaSummary).toBe("baseline established");
    expect(result.reports[1].pageTitle).toBe("Mars");
    expect(result.generatedAt).toBeTruthy();

    expect(existsSync(join(tmpDir, "reports", "Earth.json"))).toBe(true);
    expect(existsSync(join(tmpDir, "reports", "Mars.json"))).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reports new events when prior observation exists", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "Earth\n", "utf-8");

    const priorEvent = makeEvent({ timestamp: "2023-12-01T00:00:00Z" });
    const obsDir = join(tmpDir, "observations");
    mkdirSync(obsDir, { recursive: true });
    writeFileSync(join(obsDir, "Earth.json"), JSON.stringify([priorEvent], null, 2));

    const newEvent = makeEvent({
      eventType: "revert_detected",
      fromRevisionId: 3,
      toRevisionId: 4,
      timestamp: "2024-01-15T00:00:00Z",
    });
    vi.mocked(runAnalyze).mockResolvedValue({ events: [priorEvent, newEvent], revisions: [] });

    const result = await runCron(pagesFile, undefined, undefined, tmpDir);

    expect(result.totalNewEvents).toBe(1);
    expect(result.reports[0].eventsNew).toBe(1);
    expect(result.reports[0].eventsResolved).toBe(0);
    expect(result.reports[0].deltaSummary).toContain("1 new");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reports no changes when events are unchanged", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "Earth\n", "utf-8");

    const event = makeEvent();
    const obsDir = join(tmpDir, "observations");
    mkdirSync(obsDir, { recursive: true });
    writeFileSync(join(obsDir, "Earth.json"), JSON.stringify([event], null, 2));

    vi.mocked(runAnalyze).mockResolvedValue({ events: [event], revisions: [] });

    const result = await runCron(pagesFile, undefined, undefined, tmpDir);

    expect(result.totalNewEvents).toBe(0);
    expect(result.reports[0].eventsNew).toBe(0);
    expect(result.reports[0].deltaSummary).toBe("no changes");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("handles interval-based lookback", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "Earth\n", "utf-8");

    vi.mocked(runAnalyze).mockResolvedValue({ events: [makeEvent()], revisions: [] });

    const result = await runCron(pagesFile, 48, undefined, tmpDir);

    expect(result.pagesProcessed).toBe(1);
    expect(result.totalNewEvents).toBe(0);
    expect(result.reports[0].deltaSummary).toBe("baseline established");
    expect(runAnalyze).toHaveBeenCalledWith(
      "Earth",
      "detailed",
      undefined,
      undefined,
      expect.stringMatching(/^202/),
      false,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips comment lines in pages file", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "# This is a comment\nEarth\n\nMars\n", "utf-8");

    vi.mocked(runAnalyze).mockResolvedValue({ events: [makeEvent()], revisions: [] });

    const result = await runCron(pagesFile, undefined, undefined, tmpDir);

    expect(result.pagesProcessed).toBe(2);
    expect(result.totalNewEvents).toBe(0);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds a new event even when analysis rewrites the observation file first", async () => {
    // runAnalyze's --since path writes the events it just produced to the same
    // observations/<page>.json cron reads. Cron used to read it afterwards and
    // diff the run against itself, so it never reported a new event.
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "Earth\n", "utf-8");
    const obsFile = join(tmpDir, "observations", "Earth.json");
    mkdirSync(join(tmpDir, "observations"), { recursive: true });

    const priorEvent = makeEvent({ timestamp: "2023-12-01T00:00:00Z" });
    writeFileSync(obsFile, JSON.stringify([priorEvent], null, 2));
    const newEvent = makeEvent({
      eventType: "citation_added",
      fromRevisionId: 3,
      toRevisionId: 4,
      timestamp: "2024-01-15T00:00:00Z",
    });

    vi.mocked(runAnalyze).mockImplementation(async () => {
      writeFileSync(obsFile, JSON.stringify([priorEvent, newEvent], null, 2));
      return { events: [priorEvent, newEvent], revisions: [] };
    });

    const result = await runCron(pagesFile, undefined, undefined, tmpDir);

    expect(result.totalNewEvents).toBe(1);
    expect(result.reports[0].eventsNew).toBe(1);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("keeps its own observation, so the second run has something to compare", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "Earth\n", "utf-8");

    const first = makeEvent({ timestamp: "2024-01-01T00:00:00Z" });
    vi.mocked(runAnalyze).mockResolvedValueOnce({ events: [first], revisions: [] });
    const baseline = await runCron(pagesFile, undefined, undefined, tmpDir);
    expect(baseline.reports[0].deltaSummary).toBe("baseline established");
    expect(existsSync(join(tmpDir, "observations", "Earth.json"))).toBe(true);

    const second = makeEvent({
      eventType: "revert_detected",
      fromRevisionId: 5,
      toRevisionId: 6,
      timestamp: "2024-01-02T00:00:00Z",
    });
    vi.mocked(runAnalyze).mockResolvedValueOnce({ events: [first, second], revisions: [] });
    const next = await runCron(pagesFile, undefined, undefined, tmpDir);

    expect(next.totalNewEvents).toBe(1);
    expect(next.reports[0].deltaSummary).toBe("1 new, 0 resolved");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not count prior events outside the lookback window as resolved", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "Earth\n", "utf-8");
    mkdirSync(join(tmpDir, "observations"), { recursive: true });

    const longAgo = makeEvent({ timestamp: "2020-01-01T00:00:00Z" });
    writeFileSync(join(tmpDir, "observations", "Earth.json"), JSON.stringify([longAgo], null, 2));
    const recent = makeEvent({ eventType: "citation_added", timestamp: new Date().toISOString() });
    vi.mocked(runAnalyze).mockResolvedValue({ events: [recent], revisions: [] });

    const result = await runCron(pagesFile, 24, undefined, tmpDir);

    expect(result.reports[0].eventsResolved).toBe(0);
    expect(result.reports[0].eventsNew).toBe(1);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("keeps the last observation through a quiet run, so the next run still has its anchor", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "cron-test-"));
    const pagesFile = join(tmpDir, "pages.txt");
    writeFileSync(pagesFile, "Earth\n", "utf-8");
    const obsFile = join(tmpDir, "observations", "Earth.json");

    const seen = makeEvent({ timestamp: "2024-01-01T00:00:00Z" });
    vi.mocked(runAnalyze).mockResolvedValueOnce({ events: [seen], revisions: [] });
    await runCron(pagesFile, undefined, undefined, tmpDir);

    // A day with no edits. Analysis may still write an empty observation file.
    vi.mocked(runAnalyze).mockImplementationOnce(async () => {
      writeFileSync(obsFile, "[]");
      return { events: [], revisions: [] };
    });
    const quiet = await runCron(pagesFile, undefined, undefined, tmpDir);
    expect(quiet.reports[0].deltaSummary).toBe("no changes");

    const fresh = makeEvent({
      eventType: "citation_removed",
      fromRevisionId: 7,
      toRevisionId: 8,
      timestamp: "2024-01-03T00:00:00Z",
    });
    vi.mocked(runAnalyze).mockResolvedValueOnce({ events: [seen, fresh], revisions: [] });
    const next = await runCron(pagesFile, undefined, undefined, tmpDir);

    expect(next.reports[0].priorObservationAt).toBe("2024-01-01T00:00:00Z");
    expect(next.totalNewEvents).toBe(1);

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
