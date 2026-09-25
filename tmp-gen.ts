import { toDiscrepancyStream, toDelegationNdjson } from "./packages/evidence-graph/src/delegation.js";
import { writeFileSync } from "node:fs";
const events = [
  { eventId: "evt-1", eventType: "claim_modified", fromRevisionId: 100, toRevisionId: 101,
    section: "Efficacy", before: "the trial reported a 40% response rate",
    after: "the trial reported a 22% response rate", deterministicFacts: [],
    layer: "deterministic", timestamp: "2026-09-01T00:00:00.000Z", directionSignal: "weakening" },
  { eventId: "evt-2", eventType: "citation_removed", fromRevisionId: 101, toRevisionId: 102,
    section: "Efficacy", before: "[1] Phase III trial", after: "", deterministicFacts: [],
    layer: "deterministic", timestamp: "2026-09-02T00:00:00.000Z", directionSignal: "weakening" },
] as any;
const records = toDiscrepancyStream(events, () => ({
  subject: "credential:k8s",
  expected: "the cited evidence for this capability is stable",
  origin: "https://example.org/revisions",
  recordedAt: "2026-09-07T00:00:00.000Z",
}));
writeFileSync(process.argv[2], toDelegationNdjson(records));
console.log(records.length, "records");
