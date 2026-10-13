import type { Server } from "node:http";
import type { Revision } from "@refract-org/evidence-graph";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../commands/analyze.js", () => ({ runAnalyze: vi.fn(async () => ({ events: [], revisions: [] })) }));

import { runAnalyze } from "../commands/analyze.js";
import { runExplore } from "../commands/explore.js";
import { describeCoverage } from "../coverage.js";

let server: Server | undefined;
afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  vi.restoreAllMocks();
});
describe("explorer range", () => {
  it("serves the exact captured analysis without fetching it again", async () => {
    const revisions: Revision[] = [
      {
        revId: 7,
        pageId: 1,
        pageTitle: "Page",
        content: "Example",
        timestamp: "2025-01-01T00:00:00Z",
        comment: "",
        size: 7,
        minor: false,
      },
    ];
    const coverage = describeCoverage(revisions, { fromRevisionId: 7, toRevisionId: 7 });
    const analysis = { events: [], revisions, coverage };
    server = await runExplore("Page", 0, true, undefined, undefined, undefined, false, "brief", undefined, {
      analysis,
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing port");
    const root = `http://127.0.0.1:${address.port}`;
    expect(await (await fetch(`${root}/api/revisions`)).json()).toEqual(revisions);
    expect(await (await fetch(`${root}/api/coverage`)).json()).toEqual(coverage);
    expect(await (await fetch(root)).text()).toContain("Coverage: insufficient");
    expect(runAnalyze).not.toHaveBeenCalled();
  });
  it("forwards direct explorer bounds and cache settings", async () => {
    server = await runExplore(
      "Page",
      0,
      true,
      "https://example.org/api.php",
      undefined,
      undefined,
      true,
      "detailed",
      undefined,
      { fromRevId: 2, toRevId: 3, cacheDir: "/tmp/example-cache" },
    );
    expect(runAnalyze).toHaveBeenCalledWith(
      "Page",
      "detailed",
      2,
      3,
      undefined,
      true,
      "https://example.org/api.php",
      undefined,
      "/tmp/example-cache",
      undefined,
      undefined,
    );
  });
});
