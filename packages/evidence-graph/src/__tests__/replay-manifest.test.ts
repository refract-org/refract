import { describe, expect, it } from "vitest";
import { createEventIdentity } from "../hash-identity.js";
import type { EvidenceEvent, Revision } from "../index.js";
import { createReplayManifest, createVerificationBundle, verifyVerificationBundle } from "../replay-manifest.js";

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

  it("detects a tampered manifest Merkle root", async () => {
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

describe("verifyVerificationBundle binds events and proofs to the manifest", () => {
  const events: EvidenceEvent[] = ["first", "second", "third"].map((after, i) => ({
    ...event,
    eventType: "sentence_first_seen",
    toRevisionId: i + 2,
    after,
  }));

  // A fresh bundle per test, round-tripped through JSON as `refract verify` reads it.
  function bundleOf(bundleEvents: EvidenceEvent[] = events) {
    const bundle = createVerificationBundle({
      pageTitle: "Test",
      analyzerVersions: { "revert-detector": "0.1.0" },
      revisions: [rev],
      events: bundleEvents,
    });
    return JSON.parse(JSON.stringify(bundle)) as typeof bundle;
  }

  it("passes an untouched bundle, with every event and proof marked as passing", () => {
    const verification = verifyVerificationBundle(bundleOf());
    expect(verification.errors).toEqual([]);
    expect(verification.valid).toBe(true);
    expect(verification.events).toEqual(events.map(() => ({ hashMatches: true, proof: "pass" })));
  });

  it("passes events that carry their eventId, and ignores modelInterpretation, as createReplayManifest does", () => {
    const withIds = events.map((e) => ({
      ...e,
      eventId: createEventIdentity(e),
      modelInterpretation: { semanticChange: "added", confidence: 0.5 },
    }));
    const bundle = bundleOf(withIds);
    bundle.events[0].modelInterpretation = { semanticChange: "rewritten", confidence: 0.9 };

    expect(verifyVerificationBundle(bundle).errors).toEqual([]);
  });

  it("detects an event whose text was edited", () => {
    const bundle = bundleOf();
    bundle.events[1].after = "second, edited";

    const verification = verifyVerificationBundle(bundle);
    expect(verification.valid).toBe(false);
    expect(verification.errors).toEqual([
      expect.stringMatching(/^Event index 1 hashes to [0-9a-f]{16}; the manifest lists [0-9a-f]{16} at that index$/),
    ]);
    expect(verification.events.map((e) => e.hashMatches)).toEqual([true, false, true]);
  });

  it("detects an event whose type and eventId were both replaced", () => {
    const bundle = bundleOf();
    bundle.events[2].eventType = "sentence_removed";
    bundle.events[2].eventId = createEventIdentity(bundle.events[2]);

    const verification = verifyVerificationBundle(bundle);
    expect(verification.valid).toBe(false);
    expect(verification.errors).toHaveLength(1);
    expect(verification.errors[0]).toMatch(/^Event index 2 hashes to /);
  });

  it("detects an edited event that carries the original hash as its eventId", () => {
    const bundle = bundleOf();
    bundle.events[0].after = "first, edited";
    bundle.events[0].eventId = bundle.manifest.outputEventHashes[0];

    const verification = verifyVerificationBundle(bundle);
    expect(verification.valid).toBe(false);
    expect(verification.errors).toEqual([
      `Event index 0 carries eventId ${bundle.manifest.outputEventHashes[0]}, but its content hashes to ${createEventIdentity(bundle.events[0])}`,
    ]);
  });

  it("detects reordered events", () => {
    const bundle = bundleOf();
    bundle.events.reverse();

    const verification = verifyVerificationBundle(bundle);
    expect(verification.valid).toBe(false);
    expect(verification.errors).toHaveLength(2);
    expect(verification.errors[0]).toMatch(/^Event index 0 hashes to /);
    expect(verification.errors[1]).toMatch(/^Event index 2 hashes to /);
    expect(verification.events.map((e) => e.hashMatches)).toEqual([false, true, false]);
  });

  it("detects a bundle with no proofs", () => {
    const bundle = bundleOf();
    bundle.proofs = [];

    const verification = verifyVerificationBundle(bundle);
    expect(verification.valid).toBe(false);
    expect(verification.errors).toEqual(["Proof count (0) does not match manifest hashes count (3)"]);
    expect(verification.events.map((e) => e.proof)).toEqual(["missing", "missing", "missing"]);
  });

  it("detects a missing proof", () => {
    const bundle = bundleOf();
    bundle.proofs.pop();

    const verification = verifyVerificationBundle(bundle);
    expect(verification.valid).toBe(false);
    expect(verification.errors).toEqual(["Proof count (2) does not match manifest hashes count (3)"]);
    expect(verification.events[2].proof).toBe("missing");
  });

  it("reports a bundle without a proofs array instead of throwing", () => {
    const bundle = bundleOf() as Partial<ReturnType<typeof bundleOf>>;
    delete bundle.proofs;

    const verification = verifyVerificationBundle(bundle as ReturnType<typeof bundleOf>);
    expect(verification.valid).toBe(false);
    expect(verification.errors).toEqual(["Bundle is missing its manifest event hashes, its events or its proofs"]);
  });

  it("detects a self-consistent proof whose root is not the manifest's", () => {
    const bundle = bundleOf();
    const fakeLeaf = "f".repeat(16);
    bundle.proofs[1] = { leafHash: fakeLeaf, leafIndex: 1, siblings: [], rootHash: fakeLeaf };

    const verification = verifyVerificationBundle(bundle);
    expect(verification.valid).toBe(false);
    expect(verification.errors).toEqual([
      "Proof leaf hash for event index 1 does not match the manifest's hash at that index",
      "Proof root for event index 1 does not match the manifest Merkle root",
    ]);
    expect(verification.events.map((e) => e.proof)).toEqual(["pass", "fail", "pass"]);
  });

  it("detects a valid proof taken from another bundle", () => {
    const bundle = bundleOf();
    const other = bundleOf(events.map((e) => ({ ...e, section: "Elsewhere" })));
    bundle.proofs[0] = other.proofs[0];

    const verification = verifyVerificationBundle(bundle);
    expect(verification.valid).toBe(false);
    expect(verification.errors).toEqual([
      "Proof leaf hash for event index 0 does not match the manifest's hash at that index",
      "Proof root for event index 0 does not match the manifest Merkle root",
    ]);
  });

  it("detects proofs swapped between indexes", () => {
    const bundle = bundleOf();
    [bundle.proofs[0], bundle.proofs[1]] = [bundle.proofs[1], bundle.proofs[0]];

    const verification = verifyVerificationBundle(bundle);
    expect(verification.valid).toBe(false);
    expect(verification.errors).toEqual([
      "Proof leaf hash for event index 0 does not match the manifest's hash at that index",
      "Proof for event index 0 records leaf index 1",
      "Proof leaf hash for event index 1 does not match the manifest's hash at that index",
      "Proof for event index 1 records leaf index 0",
    ]);
  });

  // The event hash covers type, revisions, section, before, after, timestamp and
  // each fact's text and detail. The docs name what it leaves out; if this starts
  // failing, the hash has grown and they need updating.
  it("does not detect edits to fields outside the event hash", () => {
    const bundle = bundleOf();
    bundle.events[0].layer = "policy_coded";
    bundle.events[0].keyTerms = ["inserted"];
    bundle.events[0].deterministicFacts[0].sourceSpan = "0:10";

    expect(verifyVerificationBundle(bundle).valid).toBe(true);
  });
});
