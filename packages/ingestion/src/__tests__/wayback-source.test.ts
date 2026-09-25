import { describe, expect, it } from "vitest";
import { WaybackRevisionSource } from "../wayback-source.js";

describe("WaybackRevisionSource", () => {
  it("fetches snapshots and yields parsed revisions", async () => {
    const mockCdx = [
      ["timestamp", "original", "digest"],
      ["20250101000000", "https://example.com/policy", "digest1"],
      ["20260101000000", "https://example.com/policy", "digest2"],
    ];

    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/cdx/search/cdx")) {
        return new Response(JSON.stringify(mockCdx), { status: 200 });
      }
      if (url.includes("20250101000000")) {
        return new Response("<html><body><h1>Original</h1><p>First version.</p></body></html>", {
          status: 200,
        });
      }
      if (url.includes("20260101000000")) {
        return new Response("<html><body><h1>Updated</h1><p>Second version with edits.</p></body></html>", {
          status: 200,
        });
      }
      return new Response("Not found", { status: 404 });
    };

    const source = new WaybackRevisionSource({
      fetchFn: mockFetch,
      rateLimitMs: 0,
    });

    const revs = [];
    for await (const rev of source.revisions("https://example.com/policy")) {
      revs.push(rev);
    }

    expect(revs).toHaveLength(2);
    expect(revs[0].timestamp).toBe("2025-01-01T00:00:00Z");
    expect(revs[0].content).toContain("Original\nFirst version.");
    expect(revs[1].timestamp).toBe("2026-01-01T00:00:00Z");
    expect(revs[1].content).toContain("Updated\nSecond version with edits.");
  });

  it("deduplicates snapshots with identical digests", async () => {
    const mockCdx = [
      ["timestamp", "original", "digest"],
      ["20250101000000", "https://example.com/policy", "same-digest"],
      ["20250102000000", "https://example.com/policy", "same-digest"],
    ];

    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/cdx/search/cdx")) {
        return new Response(JSON.stringify(mockCdx), { status: 200 });
      }
      return new Response("<html><body><p>Content</p></body></html>", { status: 200 });
    };

    const source = new WaybackRevisionSource({
      fetchFn: mockFetch,
      rateLimitMs: 0,
    });

    const revs = [];
    for await (const rev of source.revisions("https://example.com/policy")) {
      revs.push(rev);
    }

    expect(revs).toHaveLength(1);
  });
});
