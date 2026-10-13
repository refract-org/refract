import type { Revision } from "@refract-org/evidence-graph";
import { MediaWikiClient } from "@refract-org/ingestion";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../commands/cache.js", () => ({
  loadCachedRevisions: vi.fn(async () => [rev(1), rev(2)]),
  loadLatestCachedTimestamp: vi.fn(async () => "2025-01-02T00:00:00Z"),
  saveRevisions: vi.fn(async () => {}),
}));

import { fetchRevisionsWithCache } from "../commands/analyze-helpers.js";

function rev(id: number): Revision {
  return {
    revId: id,
    parentId: id - 1,
    pageId: 1,
    pageTitle: "Page",
    timestamp: `2025-01-0${id}T00:00:00Z`,
    content: "Text",
    comment: "",
    size: 4,
    minor: false,
  };
}
const fetchRange = (cache = false, from?: number, to?: number) =>
  fetchRevisionsWithCache("Page", "detailed", from, to, undefined, cache, undefined, undefined, undefined);
describe("analysis coverage and range selection", () => {
  afterEach(() => vi.restoreAllMocks());
  it("rejects invalid bounds before fetching an unintended history", async () => {
    const fetch = vi.spyOn(MediaWikiClient.prototype, "fetchRevisions").mockResolvedValue([]);
    await expect(fetchRange(false, Number.NaN, 3)).rejects.toThrow(/revision/i);
    await expect(fetchRange(false, 4, 3)).rejects.toThrow(/before/i);
    await expect(
      fetchRevisionsWithCache(
        "Page",
        "detailed",
        undefined,
        undefined,
        "not-a-date",
        false,
        undefined,
        undefined,
        undefined,
      ),
    ).rejects.toThrow(/timestamp/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the requested range even when older revisions are cached", async () => {
    const fetch = vi.spyOn(MediaWikiClient.prototype, "fetchRevisions").mockResolvedValue([rev(3), rev(4)]);
    const result = await fetchRange(true, 3, 4);
    expect(result.revisions.map((r) => r.revId)).toEqual([3, 4]);
    expect(fetch).toHaveBeenCalledWith("Page", expect.objectContaining({ startRevId: 3, endRevId: 4 }));
    expect(result.coverage.status).toBe("complete");
  });
  it("retains a single revision and reports insufficient inputs", async () => {
    vi.spyOn(MediaWikiClient.prototype, "fetchRevisions").mockResolvedValue([rev(3)]);
    const result = await fetchRange();
    expect(result.revisions).toHaveLength(1);
    expect(result.coverage.status).toBe("insufficient");
    expect(result.coverage.observed.fromRevisionId).toBe(3);
  });
  it("reports missing bounds and parent gaps", async () => {
    vi.spyOn(MediaWikiClient.prototype, "fetchRevisions").mockResolvedValue([rev(3), rev(5)]);
    const result = await fetchRange(false, 2, 5);
    expect(result.coverage.status).toBe("partial");
    expect(result.coverage.missingRevisionIds).toEqual([2, 4]);
  });
  it("preserves MediaWiki parent IDs and distinguishes withheld content from empty text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              query: {
                pages: [
                  {
                    pageid: 1,
                    title: "Page",
                    revisions: [
                      {
                        revid: 3,
                        parentid: 2,
                        timestamp: "2025-01-03T00:00:00Z",
                        size: 0,
                        slots: { main: { content: "" } },
                      },
                      {
                        revid: 4,
                        parentid: 3,
                        timestamp: "2025-01-04T00:00:00Z",
                        size: 4,
                        texthidden: true,
                        slots: { main: {} },
                      },
                    ],
                  },
                ],
              },
            }),
          ),
      ),
    );
    try {
      const client = new MediaWikiClient({ apiUrl: "https://wiki.example/api.php" });
      const revisions = await client.fetchRevisions("Page");
      expect(revisions[0]).toMatchObject({ parentId: 2, contentAvailable: true });
      expect(revisions[1]).toMatchObject({ parentId: 3, contentAvailable: false });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
