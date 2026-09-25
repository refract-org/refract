import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FAKE_API, installFakeMediaWiki } from "../../../../tests/support/fake-mediawiki.js";

vi.mock("../commands/cache.js", () => ({
  loadCachedRevisions: vi.fn(() => []),
  saveRevisions: vi.fn(),
}));

import { runDiff } from "../commands/diff.js";

/**
 * Every test here is a self-diff: the same wiki compared against itself, two or
 * three times over. What is asserted is that identical inputs produce identical
 * output — arithmetic over whatever came back, not anything about what
 * Wikipedia returns. Reaching en.wikipedia.org three times per test (at a
 * 120-second timeout each) added a network dependency to a tautology, and in a
 * sandbox without egress these five failed on a 403.
 */
describe("diff command", () => {
  let restore: () => void;

  beforeAll(() => {
    restore = installFakeMediaWiki();
  });

  afterAll(() => {
    restore();
  });

  it("self-diff produces zero differences", async () => {
    const result = await runDiff("Earth", [FAKE_API, FAKE_API], "brief");

    const { totalEvents, eventTypeDiffs } = result.comparison;

    expect(totalEvents[0]).toBe(totalEvents[1]);

    for (const d of eventTypeDiffs) {
      expect(d.diffs[1]).toBe(0);
    }
  });

  it("runs without error for same wiki self-diff", async () => {
    const result = await runDiff("Earth", [FAKE_API, FAKE_API], "brief");

    expect(result.pageTitle).toBe("Earth");
    expect(result.wikis[0].url).toBe(FAKE_API);
    expect(result.wikis[1].url).toBe(FAKE_API);
    expect(result.generatedAt).toBeTruthy();
  });

  it("handles 3-way diff", async () => {
    const result = await runDiff("Earth", [FAKE_API, FAKE_API, FAKE_API], "brief");

    expect(result.wikis).toHaveLength(3);
    expect(result.comparison.totalEvents).toHaveLength(3);
    expect(result.comparison.totalEvents[0]).toBe(result.comparison.totalEvents[1]);
    expect(result.comparison.totalEvents[1]).toBe(result.comparison.totalEvents[2]);

    for (const d of result.comparison.eventTypeDiffs) {
      expect(d.counts).toHaveLength(3);
    }
  });

  it("returns empty outliers for 2 or fewer wikis", async () => {
    const result = await runDiff("Earth", [FAKE_API, FAKE_API], "brief");
    expect(result.outliers).toHaveLength(0);
  });

  it("returns outliers for 3+ wikis with identical data", async () => {
    const result = await runDiff("Earth", [FAKE_API, FAKE_API, FAKE_API], "brief");

    const outlierEvents = result.outliers.filter((o) => Math.abs(o.zScore) > 2);
    for (const o of outlierEvents) {
      expect(o.count).toBeGreaterThanOrEqual(0);
    }
  });
});
