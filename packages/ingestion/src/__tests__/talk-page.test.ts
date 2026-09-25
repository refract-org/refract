import { expect, it } from "vitest";
import { describeLive } from "../../../../tests/support/live.js";
import { MediaWikiClient } from "../mediawiki-client.js";

describeLive("Talk page fetcher", () => {
  it("fetches talk page revisions for Earth (Talk:Earth)", { timeout: 60000 }, async () => {
    const client = new MediaWikiClient({ minDelayMs: 100 });
    const revisions = await client.fetchTalkRevisions("Earth", {
      limit: 5,
      direction: "newer",
    });

    expect(revisions.length).toBeGreaterThanOrEqual(1);

    for (const rev of revisions) {
      expect(rev).toHaveProperty("revId");
      expect(rev).toHaveProperty("pageId");
      expect(rev).toHaveProperty("pageTitle");
      expect(rev).toHaveProperty("timestamp");
      expect(rev).toHaveProperty("comment");
      expect(rev).toHaveProperty("content");
      expect(rev).toHaveProperty("size");
      expect(rev).toHaveProperty("minor");

      expect(typeof rev.revId).toBe("number");
      expect(rev.revId).toBeGreaterThan(0);
      expect(typeof rev.pageId).toBe("number");
      expect(rev.pageId).toBeGreaterThan(0);
      expect(rev.pageTitle).toContain("Talk:");
      expect(typeof rev.timestamp).toBe("string");
      expect(typeof rev.size).toBe("number");
      expect(typeof rev.minor).toBe("boolean");

      expect(rev.content.length).toBeGreaterThan(0);
    }
  });

  it("accepts custom talk prefix for Project namespace talk pages", { timeout: 60000 }, async () => {
    const client = new MediaWikiClient({ minDelayMs: 100 });
    const revisions = await client.fetchTalkRevisions("About", { limit: 1, direction: "newer" }, "Wikipedia talk:");

    expect(revisions.length).toBeGreaterThanOrEqual(1);
    for (const rev of revisions) {
      expect(rev.pageTitle).toContain("Wikipedia talk:");
    }
  });
});
