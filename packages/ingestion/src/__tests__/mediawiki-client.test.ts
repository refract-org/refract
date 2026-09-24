import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaWikiClient, retryAfterMs } from "../mediawiki-client.js";

const MOCK_PROTECT_RESPONSE = {
  query: {
    logevents: [
      {
        logid: 100,
        title: "Test",
        timestamp: "2026-01-15T00:00:00Z",
        comment: "semi-protected",
        action: "protect",
      },
      {
        logid: 101,
        title: "Test",
        timestamp: "2026-02-01T00:00:00Z",
        comment: "extended",
        action: "modify",
      },
    ],
  },
};

const MOCK_EMPTY_RESPONSE = { query: { logevents: [] } };

const MOCK_PAGE_INFO_RESPONSE = {
  query: {
    pages: {
      "100": {
        pageid: 100,
        title: "Test",
        revisions: [
          {
            revid: 1,
            parentid: 0,
            timestamp: "2026-01-01T00:00:00Z",
            comment: "first",
            size: 100,
          },
        ],
      },
    },
  },
};

describe("MediaWikiClient", () => {
  let client: MediaWikiClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new MediaWikiClient({ apiUrl: "https://en.wikipedia.org/w/api.php", minDelayMs: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchProtectionLogs returns parsed logs", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_PROTECT_RESPONSE),
    });
    vi.stubGlobal("fetch", mockFetch);

    const logs = await client.fetchProtectionLogs("Test");
    expect(logs).toHaveLength(2);
    expect(logs[0].logId).toBe(100);
    expect(logs[0].action).toBe("protect");
    expect(logs[1].logId).toBe(101);
    expect(logs[1].action).toBe("modify");
  });

  it("fetchProtectionLogs returns empty for no logs", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_EMPTY_RESPONSE),
    });
    vi.stubGlobal("fetch", mockFetch);

    const logs = await client.fetchProtectionLogs("Nonexistent");
    expect(logs).toEqual([]);
  });

  it("revisions async iterator yields revisions", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_PAGE_INFO_RESPONSE),
    });
    vi.stubGlobal("fetch", mockFetch);

    const results: Array<{ revId: number }> = [];
    for await (const rev of client.revisions("Test", { limit: 1 })) {
      results.push(rev);
    }
    expect(results).toHaveLength(1);
    expect(results[0].revId).toBe(1);
  });

  it("revisions returns empty when page is missing", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ query: { pages: { "-1": { missing: "" } } } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const revs: Array<{ revId: number }> = [];
    for await (const rev of client.revisions("MissingPage", { limit: 1 })) {
      revs.push(rev);
    }
    expect(revs).toEqual([]);
  });
});

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function revisionsPage(revids: number[], continueToken?: string) {
  return {
    query: {
      pages: [
        {
          pageid: 7,
          title: "Test",
          revisions: revids.map((revid) => ({
            revid,
            parentid: revid - 1,
            timestamp: `2026-01-${String(revid).padStart(2, "0")}T00:00:00Z`,
            comment: "",
            size: 10,
            slots: { main: { content: `r${revid}` } },
          })),
        },
      ],
    },
    ...(continueToken ? { continue: { rvcontinue: continueToken } } : {}),
  };
}

describe("MediaWikiClient failure handling", () => {
  let client: MediaWikiClient;
  let sleep: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new MediaWikiClient({ apiUrl: "https://wiki.example/w/api.php", minDelayMs: 0 });
    // Waits are asserted, not taken.
    sleep = vi.fn().mockResolvedValue(undefined);
    (client as unknown as { sleep: typeof sleep }).sleep = sleep;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("throws an API error from a 200 body instead of returning the pages read so far", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(revisionsPage([1, 2], "2|3")))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "badcontinue", info: "Invalid continue param." } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.fetchRevisions("Test")).rejects.toMatchObject({
      name: "MediaWikiApiError",
      code: "badcontinue",
    });
  });

  it("retries a maxlag refusal after the server's Retry-After, then returns the data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: "maxlag", info: "Waiting for a database server: 6 seconds lagged." } },
          { headers: { "Retry-After": "5" } },
        ),
      )
      .mockResolvedValueOnce(jsonResponse(revisionsPage([1, 2])));
    vi.stubGlobal("fetch", fetchMock);

    const revisions = await client.fetchRevisions("Test");

    expect(revisions.map((r) => r.revId)).toEqual([1, 2]);
    expect(sleep).toHaveBeenCalledWith(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up on a maxlag refusal that never clears", async () => {
    const lagged = () =>
      jsonResponse({ error: { code: "maxlag", info: "lagged" } }, { headers: { "Retry-After": "1" } });
    const fetchMock = vi.fn().mockImplementation(async () => lagged());
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.fetchRevisions("Test")).rejects.toMatchObject({ code: "maxlag" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("sends maxlag when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(revisionsPage([1])));
    vi.stubGlobal("fetch", fetchMock);
    const polite = new MediaWikiClient({ apiUrl: "https://wiki.example/w/api.php", minDelayMs: 0, maxlag: 5 });

    await polite.fetchRevisions("Test");

    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get("maxlag")).toBe("5");
  });

  it("honours an HTTP-date Retry-After on a 503", async () => {
    // An HTTP-date has one-second resolution, so the wait lands a little under 7s.
    const retryAt = new Date(Date.now() + 7000).toUTCString();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503, headers: { "Retry-After": retryAt } }))
      .mockResolvedValueOnce(jsonResponse(revisionsPage([1])));
    vi.stubGlobal("fetch", fetchMock);

    const revisions = await client.fetchRevisions("Test");

    expect(revisions).toHaveLength(1);
    const waited = sleep.mock.calls[0][0] as number;
    expect(waited).toBeGreaterThan(5000);
    expect(waited).toBeLessThanOrEqual(7000);
  });

  it("retries a dropped connection instead of ending the run", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse(revisionsPage([1])));
    vi.stubGlobal("fetch", fetchMock);

    const revisions = await client.fetchRevisions("Test");

    expect(revisions).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns no more revisions than the limit when a page overshoots it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(revisionsPage([1, 2, 3], "3|4")))
      .mockResolvedValueOnce(jsonResponse(revisionsPage([4, 5, 6], "6|7")));
    vi.stubGlobal("fetch", fetchMock);

    const revisions = await client.fetchRevisions("Test", { limit: 4 });

    expect(revisions.map((r) => r.revId)).toEqual([1, 2, 3, 4]);
  });

  it("asks for the protection log's ids, titles and timestamps, and reads the level from details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        query: {
          logevents: [
            {
              logid: 55,
              title: "Test",
              timestamp: "2026-03-01T00:00:00Z",
              comment: "vandalism",
              type: "protect",
              action: "protect",
              params: { details: [{ type: "edit", level: "autoconfirmed", expiry: "infinite" }] },
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const logs = await client.fetchProtectionLogs("Test");

    const leprop = new URL(fetchMock.mock.calls[0][0] as string).searchParams.get("leprop")?.split("|");
    expect(leprop).toEqual(expect.arrayContaining(["ids", "title", "timestamp", "comment", "type", "details"]));
    expect(logs).toEqual([
      {
        logId: 55,
        pageTitle: "Test",
        timestamp: "2026-03-01T00:00:00Z",
        comment: "vandalism",
        action: "protect",
        level: "autoconfirmed",
      },
    ]);
  });
});

describe("retryAfterMs", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");

  it("reads delta-seconds", () => {
    expect(retryAfterMs("21", now)).toBe(21_000);
  });

  it("reads an HTTP-date", () => {
    expect(retryAfterMs("Thu, 01 Jan 2026 00:00:30 GMT", now)).toBe(30_000);
  });

  it("treats a date in the past as no wait", () => {
    expect(retryAfterMs("Wed, 31 Dec 2025 23:59:00 GMT", now)).toBe(0);
  });

  it("caps a long wait", () => {
    expect(retryAfterMs("3600", now)).toBe(60_000);
  });

  it("returns undefined for a missing or unreadable header", () => {
    expect(retryAfterMs(null, now)).toBeUndefined();
    expect(retryAfterMs("soon", now)).toBeUndefined();
  });
});
