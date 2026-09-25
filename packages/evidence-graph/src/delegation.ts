import { createHash } from "node:crypto";

import type { EvidenceEvent } from "./schemas/evidence.js";

/**
 * Turning evidence events into STD-07 discrepancy records, without deciding
 * which ones matter.
 *
 * Refract's position in the revisable-delegation loop is `detect mismatch`, and
 * the README has said since this shape was adopted that Refract should not emit
 * STD-07 records because "which change matters is a downstream judgment". That
 * argument is still right, and this does not contradict it: nothing here decides
 * that a change is a mismatch. A caller supplies the expectation that was
 * violated and the name the receiving system knows the subject by — neither of
 * which Refract can know, because both live in the system that made the
 * assumption — and this converts the event it already computed into the shape
 * that system reads.
 *
 * So the judgment stays where it was. What changes is that acting on it no
 * longer requires every consumer to reimplement canonical hashing and chaining
 * from the specification.
 *
 * Domain-neutral, per the repository boundary: no source is weighted, no
 * subject vocabulary is assumed, and the record says only what the event said.
 *
 * @see https://ethotechnics.org/standards/std-07-revisable-delegation-record
 */

export const REVISABLE_DELEGATION_SCHEMA_VERSION = "0.1.0";
export const REVISABLE_DELEGATION_STANDARD_URL =
  "https://ethotechnics.org/standards/std-07-revisable-delegation-record";

export interface DelegationRecord {
  schema_version: string;
  record_id: string;
  kind: "discrepancy";
  system: { id: string; version?: string; origin?: string };
  actor: { id: string; kind: "service" };
  subject: string;
  summary: string;
  time: { as_of: string; recorded_at: string };
  content: {
    expected: string;
    observed: string;
    source: string;
    evidence: {
      event_type: string;
      from_revision: number;
      to_revision: number;
      section: string;
      claim_id?: string;
      direction?: string;
      event_id?: string;
    };
  };
  depends_on: string[];
  visibility: "public" | "internal" | "private";
  contest: { standing: string; channel?: string; reversal_clock?: string };
  integrity?: { algorithm: "sha256"; hash: string; prior_hash?: string };
}

/**
 * What the caller has to supply, because Refract cannot know it.
 *
 * `expected` is the assumption that was violated, which belongs to the record
 * that made it. `subject` is what the receiving system calls this thing: a
 * consumer matches records by subject, so an identifier meaningful only inside
 * Refract would arrive as evidence about nothing.
 */
export interface DiscrepancyContext {
  subject: string;
  expected: string;
  /** Defaults to `refract`. Set it when embedding Refract in a larger system. */
  systemId?: string;
  systemVersion?: string;
  /** Where the source revision can be read. */
  origin?: string;
  /** Records the caller's own stream that this rests on. */
  dependsOn?: string[];
  visibility?: DelegationRecord["visibility"];
  /** Who may contest it. Defaults to anyone who can read the cited revisions. */
  standing?: string;
  channel?: string;
  reversalClock?: string;
  /** Defaults to now. Set it to keep a re-export byte-identical. */
  recordedAt?: string;
}

const DEFAULT_STANDING = "anyone who can read the cited revisions and show the change reads otherwise";

const sortDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, sortDeep(entry)]),
    );
  }
  return value;
};

/** STD-07 §5.1: the record without its integrity block, keys sorted, no whitespace. */
export function canonicalizeDelegationRecord(record: DelegationRecord): string {
  const rest: Record<string, unknown> = { ...record };
  delete rest.integrity;
  return JSON.stringify(sortDeep(rest));
}

export function hashDelegationRecord(record: DelegationRecord): string {
  return createHash("sha256").update(canonicalizeDelegationRecord(record), "utf8").digest("hex");
}

/** A short, stable description of what the edit did to the text. */
function observedFrom(event: EvidenceEvent): string {
  const before = event.before.trim();
  const after = event.after.trim();
  if (before && after) return `"${before}" became "${after}"`;
  if (after) return `"${after}" was added`;
  if (before) return `"${before}" was removed`;
  return `${event.eventType} in ${event.section}`;
}

/**
 * One event, one discrepancy record — unsealed. Chain and hash with
 * {@link sealDelegationRecords}, or seal a single record yourself when
 * continuing an existing stream.
 */
export function toDiscrepancyRecord(event: EvidenceEvent, context: DiscrepancyContext): DelegationRecord {
  const systemId = context.systemId ?? "refract";
  const recordedAt = context.recordedAt ?? new Date().toISOString();
  const observed = observedFrom(event);
  return {
    schema_version: REVISABLE_DELEGATION_SCHEMA_VERSION,
    record_id: `${systemId}:discrepancy:${event.eventId ?? `${event.fromRevisionId}-${event.toRevisionId}-${event.section}`}`,
    kind: "discrepancy",
    system: {
      id: systemId,
      ...(context.systemVersion ? { version: context.systemVersion } : {}),
      ...(context.origin ? { origin: context.origin } : {}),
    },
    actor: { id: systemId, kind: "service" },
    subject: context.subject,
    summary: `${context.expected} no longer holds: ${observed}.`,
    time: { as_of: event.timestamp, recorded_at: recordedAt },
    content: {
      expected: context.expected,
      observed,
      source: `revision ${event.toRevisionId}`,
      evidence: {
        event_type: event.eventType,
        from_revision: event.fromRevisionId,
        to_revision: event.toRevisionId,
        section: event.section,
        ...(event.claimId ? { claim_id: event.claimId } : {}),
        ...(event.directionSignal ? { direction: event.directionSignal } : {}),
        ...(event.eventId ? { event_id: event.eventId } : {}),
      },
    },
    depends_on: context.dependsOn ?? [],
    visibility: context.visibility ?? "internal",
    contest: {
      standing: context.standing ?? DEFAULT_STANDING,
      ...(context.channel ? { channel: context.channel } : {}),
      ...(context.reversalClock ? { reversal_clock: context.reversalClock } : {}),
    },
  };
}

/** Hash each record and link it to the one before, oldest first (STD-07 §5.2). */
export function sealDelegationRecords(records: DelegationRecord[], priorHash?: string): DelegationRecord[] {
  const sealed: DelegationRecord[] = [];
  let prior = priorHash;
  for (const record of records) {
    const hash = hashDelegationRecord(record);
    sealed.push({
      ...record,
      integrity: { algorithm: "sha256", hash, ...(prior ? { prior_hash: prior } : {}) },
    });
    prior = hash;
  }
  return sealed;
}

/**
 * The whole conversion, for a caller that already knows which events matter.
 *
 * `decide` returns the context for an event worth recording, or `null` for one
 * that is not. That callback is the judgment, and it is the caller's: Refract
 * ships no default for it, because a default would be Refract deciding after
 * all — quietly, and for everyone.
 */
export function toDiscrepancyStream(
  events: EvidenceEvent[],
  decide: (event: EvidenceEvent) => DiscrepancyContext | null,
  options: { priorHash?: string } = {},
): DelegationRecord[] {
  const records: DelegationRecord[] = [];
  for (const event of events) {
    const context = decide(event);
    if (!context) continue;
    records.push(toDiscrepancyRecord(event, context));
  }
  return sealDelegationRecords(records, options.priorHash);
}

/** Newline-delimited JSON, the interchange form every consumer reads. */
export function toDelegationNdjson(records: DelegationRecord[]): string {
  return records.map((record) => JSON.stringify(record)).join("\n") + (records.length ? "\n" : "");
}
