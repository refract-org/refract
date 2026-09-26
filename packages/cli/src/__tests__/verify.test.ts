import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVerificationBundle } from "@refract-org/evidence-graph";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runVerify } from "../commands/verify.js";

describe("runVerify", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "refract-verify-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("verifies a valid verification bundle and generates HTML receipt", async () => {
    const bundle = createVerificationBundle({
      pageTitle: "Test Article",
      analyzerVersions: { refract: "0.5.15" },
      revisions: [
        {
          revId: 1,
          pageId: 1,
          pageTitle: "Test Article",
          timestamp: "2026-01-01T00:00:00Z",
          comment: "Initial revision",
          content: "Initial content here.",
          size: 21,
          minor: false,
        },
      ],
      events: [
        {
          eventType: "sentence_first_seen",
          fromRevisionId: 0,
          toRevisionId: 1,
          after: "Initial content here.",
          layer: "observed",
          timestamp: "2026-01-01T00:00:00Z",
        },
      ],
    });

    const bundlePath = join(tmpDir, "bundle.json");
    const htmlPath = join(tmpDir, "receipt.html");
    writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf-8");

    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});

    await runVerify(bundlePath, htmlPath);

    expect(stdout).toHaveBeenCalled();
    const htmlContent = readFileSync(htmlPath, "utf-8");
    expect(htmlContent).toContain("Refract Verification Receipt");
    expect(htmlContent).toContain("Test Article");
    expect(htmlContent).toContain("VERIFIED VALID");
  });
});
