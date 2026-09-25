import { describe, expect, it } from "vitest";

import {
  canonicalizeDelegationRecord,
  hashDelegationRecord,
  toDelegationNdjson,
  toDiscrepancyRecord,
  toDiscrepancyStream,
} from "../delegation.js";
import type { EvidenceEvent } from "../schemas/evidence.js";

const event = (overrides: Partial<EvidenceEvent> = {}): EvidenceEvent => ({
  eventId: "evt-1",
  eventType: "claim_modified",
  fromRevisionId: 100,
  toRevisionId: 101,
  section: "Efficacy",
  before: "the trial reported a 40% response rate",
  after: "the trial reported a 22% response rate",
  deterministicFacts: [],
  layer: "deterministic",
  timestamp: "2026-09-01T00:00:00.000Z",
  directionSignal: "weakening",
  ...overrides,
});

const context = {
  subject: "claim:response-rate",
  expected: "the reported response rate is stable",
  recordedAt: "2026-09-07T00:00:00.000Z",
};

describe("converting an event into a discrepancy record", () => {
  it("says what was expected, what was observed, and which revision to check", () => {
    const record = toDiscrepancyRecord(event(), context);
    expect(record.kind).toBe("discrepancy");
    expect(record.subject).toBe("claim:response-rate");
    expect(record.content.expected).toBe("the reported response rate is stable");
    expect(record.content.observed).toContain("22% response rate");
    expect(record.content.source).toBe("revision 101");
    expect(record.content.evidence.to_revision).toBe(101);
    expect(record.time.as_of).toBe("2026-09-01T00:00:00.000Z");
  });

  it("declares standing, so the record can be argued with", () => {
    // A record nobody was told they could challenge is one that cannot be
    // corrected from outside, which is what STD-07 Article IV is about.
    expect(toDiscrepancyRecord(event(), context).contest.standing).toContain("cited revisions");
    expect(toDiscrepancyRecord(event(), { ...context, standing: "the trial sponsor" }).contest.standing).toBe(
      "the trial sponsor",
    );
  });

  it("describes an addition and a removal without pretending either was a swap", () => {
    expect(toDiscrepancyRecord(event({ before: "" }), context).content.observed).toContain("was added");
    expect(toDiscrepancyRecord(event({ after: "" }), context).content.observed).toContain("was removed");
  });
});

describe("hashing and chaining", () => {
  it("canonicalizes to sorted keys with the integrity block removed", () => {
    const record = toDiscrepancyRecord(event(), context);
    const canonical = canonicalizeDelegationRecord({
      ...record,
      integrity: { algorithm: "sha256", hash: "deadbeef" },
    });
    expect(canonical).not.toContain("integrity");
    expect(canonical.indexOf('"actor"')).toBeLessThan(canonical.indexOf('"content"'));
    expect(canonical).not.toContain("\n");
  });

  it("hashes the same record identically whatever order its keys arrive in", () => {
    const record = toDiscrepancyRecord(event(), context);
    const reordered = JSON.parse(
      JSON.stringify({
        time: record.time,
        kind: record.kind,
        ...record,
      }),
    ) as typeof record;
    expect(hashDelegationRecord(reordered)).toBe(hashDelegationRecord(record));
  });

  it("links each record to the one before it", () => {
    const records = toDiscrepancyStream([event(), event({ eventId: "evt-2", toRevisionId: 102 })], () => context);
    expect(records).toHaveLength(2);
    expect(records[0].integrity?.prior_hash).toBeUndefined();
    expect(records[1].integrity?.prior_hash).toBe(records[0].integrity?.hash);
    expect(hashDelegationRecord(records[1])).toBe(records[1].integrity?.hash);
  });

  it("continues an existing stream when given the last hash", () => {
    const [record] = toDiscrepancyStream([event()], () => context, {
      priorHash: "ab".repeat(32),
    });
    expect(record.integrity?.prior_hash).toBe("ab".repeat(32));
  });
});

describe("who decides which change matters", () => {
  it("emits nothing for an event the caller does not judge a mismatch", () => {
    // The judgment stays with the system that made the assumption. Refract
    // ships no default here on purpose: a default would be Refract deciding
    // after all, quietly and for everyone.
    const records = toDiscrepancyStream(
      [event(), event({ eventId: "evt-2", directionSignal: "neutral" })],
      (candidate) => (candidate.directionSignal === "weakening" ? context : null),
    );
    expect(records).toHaveLength(1);
    expect(records[0].content.evidence.event_id).toBe("evt-1");
  });

  it("emits one line per record, terminated, and nothing at all for none", () => {
    expect(toDelegationNdjson([])).toBe("");
    const ndjson = toDelegationNdjson(toDiscrepancyStream([event()], () => context));
    expect(ndjson.trim().split("\n")).toHaveLength(1);
    expect(ndjson.endsWith("\n")).toBe(true);
  });
});
