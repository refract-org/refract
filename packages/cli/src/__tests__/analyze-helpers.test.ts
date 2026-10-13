import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { finalizeEvents } from "../commands/analyze-helpers.js";

describe("finalizeEvents", () => {
  it("records a first --since observation without logging the missing prior file", () => {
    const obsDir = mkdtempSync(join(tmpdir(), "analyze-obs-"));
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      finalizeEvents("Earth", [], [], "2024-01-01T00:00:00Z", obsDir);
      expect(stderr.mock.calls).toEqual([["First observation — no delta available."]]);
      expect(existsSync(join(obsDir, "Earth.json"))).toBe(true);
    } finally {
      stderr.mockRestore();
      rmSync(obsDir, { recursive: true, force: true });
    }
  });

  it("neither prints nor writes an observation when the caller keeps its own", () => {
    const obsDir = mkdtempSync(join(tmpdir(), "analyze-obs-"));
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      finalizeEvents("Earth", [], [], "2024-01-01T00:00:00Z", obsDir, false);
      expect(stderr).not.toHaveBeenCalled();
      expect(existsSync(join(obsDir, "Earth.json"))).toBe(false);
    } finally {
      stderr.mockRestore();
      rmSync(obsDir, { recursive: true, force: true });
    }
  });
});
