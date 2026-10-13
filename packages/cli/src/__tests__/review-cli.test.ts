import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const execute = promisify(execFile);

it("runs the watchlist review, filter, acknowledgment, and subsequent delta through the compiled CLI", async () => {
  const dir = mkdtempSync(join(tmpdir(), "refract-review-cli-"));
  const content = "The library provides free printing to every member throughout the year.";
  const revisions = [1, 2].map((id) => ({
    revid: id,
    parentid: id - 1,
    timestamp: `2025-01-0${id}T00:00:00Z`,
    size: content.length,
    slots: { main: { content: id === 1 ? content : content.replace("free", "paid") } },
  }));
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    const url = new URL(req.url ?? "/", "http://localhost");
    let selected = revisions.filter(
      (r) =>
        r.revid >= Number(url.searchParams.get("rvstartid") || 0) &&
        r.revid <= Number(url.searchParams.get("rvendid") || Infinity),
    );
    if (url.searchParams.get("rvdir") === "older") selected = [...selected].reverse();
    selected = selected.slice(0, Number(url.searchParams.get("rvlimit")));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ query: { pages: [{ pageid: 1, title: "Library", revisions: selected }] } }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("port unavailable");
    const api = `http://127.0.0.1:${addr.port}/w/api.php`;
    const cli = (...args: string[]) =>
      execute(process.execPath, [resolve("packages/cli/dist/src/cli.js"), ...args], {
        env: { ...process.env, REFRACT_OAUTH_CLIENT_ID: "", REFRACT_OAUTH_CLIENT_SECRET: "" },
      });
    const watchlist = join(dir, "pages.txt");
    writeFileSync(watchlist, "# Sources\nLibrary\nLibrary\n");
    const first = JSON.parse(
      (
        await cli(
          "review",
          "--pages-file",
          watchlist,
          "--api",
          api,
          "--state-dir",
          dir,
          "--from",
          "1",
          "--format",
          "json",
          "--event-type",
          "sentence_modified",
        )
      ).stdout,
    );
    expect(first.pages).toHaveLength(1);
    expect(first.view.pages[0].entries).toHaveLength(1);
    expect(first.view.pages[0].entries[0].before).toBe(content);
    expect(first.pages[0].coverage.status).toBe("complete");
    const count = requests;
    await cli("review", "--state-dir", dir, "--ack", first.reportId);
    expect(requests).toBe(count);
    const quiet = JSON.parse(
      (await cli("review", "Library", "--api", api, "--state-dir", dir, "--format", "json")).stdout,
    );
    expect(quiet.pages[0].status).toBe("no_changes");
    revisions.push({
      ...revisions[1],
      revid: 3,
      parentid: 2,
      timestamp: "2025-01-03T00:00:00Z",
      slots: { main: { content: "The library offers a reading room with large windows." } },
    });
    const next = JSON.parse(
      (await cli("review", "Library", "--api", api, "--state-dir", dir, "--format", "json")).stdout,
    );
    expect(next.pages[0].reviewedRevisionId).toBe(2);
    expect(next.pages[0].entries.every((e: { fromRevisionId: number }) => e.fromRevisionId === 2)).toBe(true);
    await expect(cli("review", "Library", "--state-dir", dir, "--limit", "0")).rejects.toThrow(/positive integer/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
});
