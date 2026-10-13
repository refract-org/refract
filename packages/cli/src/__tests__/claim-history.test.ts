import { afterEach, describe, expect, it, vi } from "vitest";
import { runClaim, runClaimHistory } from "../commands/claim.js";

const API = "https://wiki.example/w/api.php";
const CLAIM = "The bridge opened to traffic in 2031.";

function revision(revid: number, content: string) {
  return {
    revid,
    parentid: revid - 1,
    timestamp: `2030-0${revid}-01T00:00:00Z`,
    comment: "",
    size: content.length,
    slots: { main: { content } },
  };
}

/**
 * A page whose first revisions predate the claim and whose latest carries it.
 * Answers rvdir=newer with the first two and rvdir=older with the latest two,
 * the way MediaWiki does when a limit is set and no start is.
 */
function pageHistory(url: URL): Response {
  const newestFirst = url.searchParams.get("rvdir") === "older";
  const revisions = newestFirst
    ? [revision(4, `Intro. ${CLAIM}`), revision(3, "Intro.")]
    : [revision(1, "Stub."), revision(2, "Intro.")];
  return new Response(JSON.stringify({ query: { pages: [{ pageid: 1, title: "Bridge", revisions }] } }), {
    headers: { "content-type": "application/json" },
  });
}

describe("claim history reads the latest revisions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports absent when the latest revision removes the passage", async () => {
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
                    title: "Bridge",
                    revisions: [
                      revision(4, "A completely unrelated description of the landscape."),
                      revision(3, CLAIM),
                    ],
                  },
                ],
              },
            }),
          ),
      ),
    );
    const result = await runClaimHistory("Bridge", CLAIM, false, API);
    expect(result.status).toBe("absent");
    expect(result.latestRevisionId).toBe(4);
    expect(result.latestMatch).toBe("none");
    expect(result.historySummary).toContain("Last present");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await runClaim("Bridge", CLAIM, false, API);
    expect(log.mock.calls.flat().join("\n")).toContain("Status:      absent");
  });

  it("marks word overlap as uncertain and retains inspectable candidate text", async () => {
    const candidate = "The bridge opened to traffic in 2032.";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              query: { pages: [{ pageid: 1, title: "Bridge", revisions: [revision(4, candidate)] }] },
            }),
          ),
      ),
    );
    const result = await runClaimHistory("Bridge", CLAIM, false, API);
    expect(result.latestMatch).toBe("partial");
    expect(result.revisions[0].match).toBe("partial");
    expect(result.revisions[0].text).toBe(candidate);
    expect(result.caveats.join(" ")).toContain("word overlap");
    expect(result.historySummary).not.toContain("Present continuously");
  });

  it("does not infer absence from withheld text", async () => {
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
                    title: "Bridge",
                    revisions: [{ ...revision(4, ""), texthidden: true }, revision(3, CLAIM)],
                  },
                ],
              },
            }),
          ),
      ),
    );
    const result = await runClaimHistory("Bridge", CLAIM, false, API);
    expect(result.status).toBe("unknown");
    expect(result.latestMatch).toBe("unavailable");
    expect(result.historySummary).not.toContain("then removed");
  });

  it("finds a claim present in the current text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => pageHistory(new URL(String(input)))),
    );

    const result = await runClaimHistory("Bridge", CLAIM, false, API, undefined, undefined, 2);

    // Reading the page's first two revisions, the claim was reported absent.
    expect(result.status).not.toBe("absent");
    expect(result.revisions.map((r) => r.revisionId)).toContain(4);
  });
});
