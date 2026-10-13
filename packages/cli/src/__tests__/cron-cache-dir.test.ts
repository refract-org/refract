import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FAKE_API, installFakeMediaWiki } from "../../../../tests/support/fake-mediawiki.js";

// Every homedir() the CLI calls resolves to an empty temp directory, so a write
// to the default ~/.wikihistory lands where this test can see it and not in
// the real one.
vi.mock("node:os", async (importOriginal) => {
  const os = await importOriginal<typeof import("node:os")>();
  const { mkdtempSync } = await import("node:fs");
  const home = mkdtempSync(`${os.tmpdir()}/cron-home-`);
  return { ...os, default: { ...os, homedir: () => home }, homedir: () => home };
});

import { runCron } from "../commands/cron.js";

/**
 * cron.test.ts replaces analysis with a mock, which cannot show what the real
 * analysis writes. These run cron over the actual pipeline against the fake
 * MediaWiki API. Analysis's --since path used to read and overwrite
 * ~/.wikihistory/observations/<page>.json whatever --cache-dir said, and print
 * a delta against that file.
 */
describe("cron --cache-dir", () => {
  const fakeHome = homedir();
  let restore: () => void;

  beforeAll(() => {
    restore = installFakeMediaWiki();
  });

  afterAll(() => {
    restore();
    // Only ever the directory the mock made; never a real home.
    if (basename(fakeHome).startsWith("cron-home-")) rmSync(fakeHome, { recursive: true, force: true });
  });

  it("keeps a real analysis's state inside the cache dir, across two runs", async () => {
    expect(basename(fakeHome)).toMatch(/^cron-home-/);
    const cacheDir = mkdtempSync(join(tmpdir(), "cron-cache-"));
    const pagesFile = join(mkdtempSync(join(tmpdir(), "cron-pages-")), "pages.txt");
    writeFileSync(pagesFile, "Earth\n", "utf-8");
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const first = await runCron(pagesFile, 720, FAKE_API, cacheDir);
      const second = await runCron(pagesFile, 720, FAKE_API, cacheDir);

      expect(first.reports[0].deltaSummary).toBe("baseline established");
      expect(second.reports[0].deltaSummary).toBe("no changes");
      expect(readdirSync(fakeHome)).toEqual([]);
      expect(existsSync(join(cacheDir, "observations", "Earth.json"))).toBe(true);
      expect(existsSync(join(cacheDir, "reports", "Earth.json"))).toBe(true);

      const printed = stderr.mock.calls.map((args) => args.map(String).join(" ")).join("\n");
      expect(printed).not.toContain("Re-observation delta");
      expect(printed).not.toContain("ENOENT");
    } finally {
      stderr.mockRestore();
      stdout.mockRestore();
      rmSync(cacheDir, { recursive: true, force: true });
      rmSync(join(pagesFile, ".."), { recursive: true, force: true });
    }
  });
});
