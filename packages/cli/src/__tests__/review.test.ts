import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Revision } from "@refract-org/evidence-graph";
import { MediaWikiClient } from "@refract-org/ingestion";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acknowledgeReview, observeReview, renderReview } from "../commands/review.js";

const API = "https://wiki.example/w/api.php";
const text = "Rivergate Library is open until six every weekday throughout the year.";
function rev(id: number, content = text): Revision {
  return {
    revId: id,
    parentId: id - 1,
    contentAvailable: true,
    pageId: 1,
    pageTitle: "Library",
    timestamp: `2025-01-0${id}T00:00:00Z`,
    content,
    comment: "",
    size: content.length,
    minor: false,
  };
}
let dir: string;
let history: Revision[];
let fetch: ReturnType<typeof vi.spyOn>;
const options = () => ({ stateDir: dir, apiUrl: API });
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "refract-review-"));
  history = [rev(1), rev(2, text.replace("six", "eight"))];
  fetch = vi.spyOn(MediaWikiClient.prototype, "fetchRevisions").mockImplementation(async (_title, opts) => {
    const selected = history.filter(
      (r) => (!opts?.startRevId || r.revId >= opts.startRevId) && (!opts?.endRevId || r.revId <= opts.endRevId),
    );
    if (opts?.direction === "older") selected.reverse();
    return selected.slice(0, opts?.limit);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});
const observe = (extra = {}) => observeReview(["Library"], { ...options(), ...extra });
const state = () => JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));

describe("source review", () => {
  it("supports an offline review and acknowledgment using the fictional history", async () => {
    fetch.mockRejectedValue(new Error("offline"));
    const report = await observeReview([], { stateDir: dir, sample: true, from: 1 });
    expect(report.pages[0].source.kind).toBe("fictional_sample");
    expect(report.pages[0].entries.some((e) => e.eventType === "citation_removed")).toBe(true);
    expect(renderReview(report)).toContain("Fictional sample");
    expect(renderReview(report)).toContain("```text\n<ref>");
    expect(renderReview(report)).not.toContain("[Diff](");
    await acknowledgeReview(report.reportId, dir);
    expect((await observeReview([], { stateDir: dir, sample: true })).pages[0].status).toBe("no_changes");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires explicit acknowledgment to establish the first reviewed baseline", async () => {
    const report = await observe();
    expect(report.pages[0].status).toBe("baseline_required");
    expect(Object.values(state().sources)[0]).toMatchObject({ reviewedRevisionId: null, fetchedRevisionId: 2 });
    fetch.mockClear();
    await acknowledgeReview(report.reportId, dir);
    expect(fetch).not.toHaveBeenCalled();
    expect(Object.values(state().sources)[0]).toMatchObject({ reviewedRevisionId: 2 });
  });
  it("retains pending changes across repeated observations until the report is acknowledged", async () => {
    const report = await observe({ from: 1 });
    const again = await observe();
    expect(again.reportId).toBe(report.reportId);
    const ids = again.pages[0].entries.map((e) => e.eventId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(again.pages[0].entries.some((e) => e.eventType === "sentence_modified")).toBe(true);
    await acknowledgeReview(report.reportId, dir);
    expect((await observe()).pages[0].status).toBe("no_changes");
  });
  it("acknowledges only the saved end, leaving later edits pending", async () => {
    const report = await observe({ from: 1 });
    history.push(rev(3, "Rivergate Library is closed for renovation throughout the year."));
    await acknowledgeReview(report.reportId, dir);
    const next = await observe();
    expect(next.pages[0].reviewedRevisionId).toBe(2);
    expect(next.pages[0].entries.every((e) => e.fromRevisionId >= 2)).toBe(true);
  });
  it("blocks concurrent state writers and retains the prior checkpoint", async () => {
    await observe({ from: 1 });
    const before = readFileSync(join(dir, "state.json"), "utf8");
    mkdirSync(join(dir, ".lock"));
    await expect(observe()).rejects.toThrow(/locked/i);
    expect(readFileSync(join(dir, "state.json"), "utf8")).toBe(before);
  });
  it("does not acknowledge history whose parent continuity is unverified", async () => {
    delete history[1].parentId;
    const report = await observe({ from: 1 });
    expect(report.pages[0].status).toBe("incomplete");
    await expect(acknowledgeReview(report.reportId, dir)).rejects.toThrow(/incomplete/i);
  });
  it("keeps page checkpoints when another page in the watchlist fails", async () => {
    fetch.mockImplementation(async (title, opts) => {
      if (title === "Missing") throw new Error("Unavailable source");
      return opts?.direction === "older" ? history.slice(-1) : history;
    });
    const first = await observeReview(["Library", "Missing"], { ...options(), from: 1 });
    expect(first.pages.map((p) => p.status)).toEqual(["pending", "error"]);
    await expect(acknowledgeReview(first.reportId, dir)).rejects.toThrow(/incomplete/i);
    expect((await observe()).pages[0].entries).toEqual(first.pages[0].entries);
  });

  it("reports gaps and refuses to acknowledge incomplete history", async () => {
    history = [rev(1), rev(3)];
    const report = await observe({ from: 1 });
    expect(report.pages[0].coverage.missingRevisionIds).toContain(2);
    expect(report.pages[0].entries).toEqual([]);
    await expect(acknowledgeReview(report.reportId, dir)).rejects.toThrow(/incomplete/i);
  });
  it("resumes a limited fetch without losing transitions at the cursor", async () => {
    history.push(rev(3, text.replace("six", "nine")), rev(4, text.replace("six", "ten")));
    const first = await observe({ from: 1, limit: 1 });
    expect(first.pages[0].coverage.truncated).toBe(true);
    const second = await observe({ limit: 1 });
    expect(second.pages[0].fetchedRevisionId).toBe(3);
    const third = await observe({ limit: 1 });
    expect(third.pages[0].coverage.status).toBe("complete");
    expect(third.pages[0].entries.some((e) => e.fromRevisionId === 2 && e.toRevisionId === 3)).toBe(true);
    await acknowledgeReview(third.reportId, dir);
  });
  it("includes review context and source links with full changed text", async () => {
    const report = await observe({ from: 1 });
    const rendered = renderReview(report, { eventTypes: ["sentence_modified"] });
    expect(rendered).toContain("Before");
    expect(rendered).toContain(text);
    expect(rendered).toContain("oldid=1");
    expect(rendered).toContain("diff=2");
    expect(rendered).toContain("hidden by filters");
    expect(report.pages[0].entries[0]).toMatchObject({ source: { apiUrl: API, pageTitle: "Library", pageId: 1 } });
  });
  it("does not overwrite good pending inputs when a fetch fails", async () => {
    const report = await observe({ from: 1 });
    fetch.mockRejectedValueOnce(new Error("network unavailable"));
    const failed = await observe();
    expect(failed.pages[0].status).toBe("error");
    await expect(acknowledgeReview(failed.reportId, dir)).rejects.toThrow(/incomplete/i);
    await acknowledgeReview(report.reportId, dir);
    expect((await observe()).pages[0].reviewedRevisionId).toBe(2);
  });
  it("isolates the same title and revision IDs on different wikis", async () => {
    const first = await observe({ from: 1 });
    const other = await observe({ apiUrl: "https://other.example/api.php", from: 1 });
    expect(first.pages[0].source.key).not.toBe(other.pages[0].source.key);
    expect(first.pages[0].entries[0].entryId).not.toBe(other.pages[0].entries[0].entryId);
    expect(first.pages[0].entries[0].eventId).toBe(other.pages[0].entries[0].eventId);
    expect(Object.keys(state().sources)).toHaveLength(2);
  });
  it("refuses stale acknowledgments instead of rewinding the reviewed cursor", async () => {
    const old = await observe({ from: 1 });
    history.push(rev(3, text.replace("six", "nine")));
    const latest = await observe();
    await acknowledgeReview(latest.reportId, dir);
    await expect(acknowledgeReview(old.reportId, dir)).rejects.toThrow(/stale/i);
    await acknowledgeReview(latest.reportId, dir); // idempotent
  });
  it("does not silently accept a modified report file", async () => {
    const report = await observe({ from: 1 });
    const path = join(dir, "reports", `${report.reportId}.json`);
    const changed = JSON.parse(readFileSync(path, "utf8"));
    changed.pages[0].fetchedRevisionId = 900;
    writeFileSync(path, JSON.stringify(changed));
    await expect(acknowledgeReview(report.reportId, dir)).rejects.toThrow(/hash/i);
  });
  it("reports unavailable content without treating it as a text removal", async () => {
    history[1].contentAvailable = false;
    history[1].content = "";
    const report = await observe({ from: 1 });
    expect(report.pages[0].status).toBe("incomplete");
    expect(report.pages[0].entries).toEqual([]);
  });
});
