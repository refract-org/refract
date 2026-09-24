import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../commands/analyze.js", () => ({
  runAnalyze: vi.fn(async () => ({ events: [], revisions: [] })),
}));

import { runExport } from "../commands/export.js";

describe("export with nothing to export", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes nothing to stdout, so an empty NDJSON file stays empty", async () => {
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    await runExport("Earth", "ndjson");

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith("No events to export.");
  });
});
