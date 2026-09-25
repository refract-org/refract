import { expect, it } from "vitest";
import { describeLive } from "../../../../tests/support/live.js";
import { MediaWikiClient } from "../mediawiki-client.js";

describeLive("Page move fetcher", () => {
  it("fetches page moves and returns correctly shaped results", { timeout: 30000 }, async () => {
    const client = new MediaWikiClient({ minDelayMs: 100 });
    const moves = await client.fetchPageMoves("Earth");

    expect(Array.isArray(moves)).toBe(true);

    for (const move of moves) {
      expect(move).toHaveProperty("oldTitle");
      expect(move).toHaveProperty("newTitle");
      expect(move).toHaveProperty("timestamp");
      expect(move).toHaveProperty("revId");
      expect(move).toHaveProperty("comment");

      expect(typeof move.oldTitle).toBe("string");
      expect(typeof move.newTitle).toBe("string");
      expect(typeof move.timestamp).toBe("string");
      expect(typeof move.revId).toBe("number");
      expect(typeof move.comment).toBe("string");
    }
  });

  it("returns empty array for a non-existent page", { timeout: 30000 }, async () => {
    const client = new MediaWikiClient({ minDelayMs: 100 });
    const moves = await client.fetchPageMoves("ThisPageDoesNotExistXYZ123!!!");
    expect(moves).toEqual([]);
  });
});
