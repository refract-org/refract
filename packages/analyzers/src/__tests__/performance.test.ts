import { citationTracker, sectionDiffer } from "@refract-org/analyzers";
import { MediaWikiClient } from "@refract-org/ingestion";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FAKE_API, installFakeMediaWiki } from "../../../../tests/support/fake-mediawiki.js";

/**
 * The measured window starts after the fetch and covers only section and
 * citation diffing, so the network was never part of what this asserts — it was
 * just where the wikitext came from. Serving that from a fixture makes the
 * timing bound mean what it says, and stops a 5,000 ms assertion from sharing a
 * test with an unbounded HTTP request.
 */
describe("performance: pipeline throughput", () => {
  let restore: () => void;

  beforeAll(() => {
    restore = installFakeMediaWiki();
  });

  afterAll(() => {
    restore();
  });

  it("processes detailed analysis of a small page within memory and time bounds", async () => {
    const client = new MediaWikiClient({ apiUrl: FAKE_API });
    const revisions = await client.fetchRevisions("Earth", { limit: 10 });

    const startTime = performance.now();
    const memBefore = process.memoryUsage().heapUsed;

    const allEvents: unknown[] = [];
    for (let i = 1; i < revisions.length; i++) {
      const prev = revisions[i - 1];
      const curr = revisions[i];

      allEvents.push(
        ...sectionDiffer.diffSections(
          sectionDiffer.extractSections(prev.content),
          sectionDiffer.extractSections(curr.content),
        ),
      );
      allEvents.push(
        ...citationTracker.diffCitations(
          citationTracker.extractCitations(prev.content),
          citationTracker.extractCitations(curr.content),
        ),
      );
    }

    const memAfter = process.memoryUsage().heapUsed;
    const elapsed = performance.now() - startTime;
    const memDelta = memAfter - memBefore;

    expect(revisions.length).toBeGreaterThanOrEqual(2);
    expect(allEvents.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5000);
    expect(memDelta).toBeLessThan(50 * 1024 * 1024);
  });
});
