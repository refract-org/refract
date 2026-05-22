import { citationTracker, sectionDiffer } from "@refract-org/analyzers";
import { MediaWikiClient } from "@refract-org/ingestion";
import { describe, expect, it } from "vitest";

const API = "https://en.wikipedia.org/w/api.php";

describe("performance: pipeline throughput", () => {
  it("processes detailed analysis of a small page within memory and time bounds", { timeout: 30000 }, async () => {
    const client = new MediaWikiClient({ apiUrl: API });
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
