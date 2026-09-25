import { describe, expect, it } from "vitest";
import type { EvidenceEvent, Revision } from "../index.js";
import { createReplayManifest } from "../replay-manifest.js";

const rev: Revision = {
  revId: 1,
  pageId: 100,
  pageTitle: "Test",
  timestamp: "2026-01-01T00:00:00Z",
  comment: "first edit",
  content: "Hello world",
  size: 11,
  minor: false,
};

const event: EvidenceEvent = {
  eventType: "revert_detected",
  fromRevisionId: 1,
  toRevisionId: 2,
  section: "",
  before: "",
  after: "reverted",
  deterministicFacts: [{ fact: "revert" }],
  layer: "observed",
  timestamp: "2026-01-01T00:00:00Z",
};

describe("createReplayManifest", () => {
  it("produces a manifest with expected format", () => {
    const manifest = createReplayManifest({
      pageTitle: "Test",
      analyzerVersions: { "revert-detector": "0.1.0" },
      revisions: [rev],
      events: [event],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(manifest.format).toBe("refract-replay-manifest/v1");
    expect(manifest.pageTitle).toBe("Test");
    expect(manifest.analyzerVersions["revert-detector"]).toBe("0.1.0");
  });

  it("generates a manifest hash", () => {
    const manifest = createReplayManifest({
      pageTitle: "Test",
      analyzerVersions: { "revert-detector": "0.1.0" },
      revisions: [rev],
      events: [event],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(manifest.manifestHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("includes input and output hashes", () => {
    const manifest = createReplayManifest({
      pageTitle: "Test",
      analyzerVersions: { "revert-detector": "0.1.0" },
      revisions: [rev],
      events: [event],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(manifest.inputRevisionHashes).toHaveLength(1);
    expect(manifest.outputEventHashes).toHaveLength(1);
  });

  it("is deterministic for same inputs", () => {
    const a = createReplayManifest({
      pageTitle: "Test",
      analyzerVersions: { "revert-detector": "0.1.0" },
      revisions: [rev],
      events: [event],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    const b = createReplayManifest({
      pageTitle: "Test",
      analyzerVersions: { "revert-detector": "0.1.0" },
      revisions: [rev],
      events: [event],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(a.manifestHash).toBe(b.manifestHash);
  });
});

describe("VerificationBundle", () => {
  it("creates a bundle and verifies successfully", async () => {
    const { createVerificationBundle, verifyVerificationBundle } = await import("../replay-manifest.js");
    const bundle = createVerificationBundle({
      pageTitle: "Test",
      analyzerVersions: { "revert-detector": "0.1.0" },
      revisions: [rev],
      events: [event],
    });

    expect(bundle.format).toBe("refract-verification-bundle/v1");
    expect(bundle.proofs).toHaveLength(1);

    const verification = verifyVerificationBundle(bundle);
    expect(verification.valid).toBe(true);
    expect(verification.errors).toHaveLength(0);
  });

  it("detects tampered event in bundle", async () => {
    const { createVerificationBundle, verifyVerificationBundle } = await import("../replay-manifest.js");
    const bundle = createVerificationBundle({
      pageTitle: "Test",
      analyzerVersions: { "revert-detector": "0.1.0" },
      revisions: [rev],
      events: [event],
    });

    // Tamper with the manifest root
    bundle.manifest.merkleRoot = "0".repeat(64);
    const verification = verifyVerificationBundle(bundle);
    expect(verification.valid).toBe(false);
    expect(verification.errors.length).toBeGreaterThan(0);
  });
});
