import { writeFileSync } from "node:fs";

import type { AnalyzerConfig, EvidenceEvent } from "@refract-org/evidence-graph";
import { toDelegationNdjson, toDiscrepancyStream } from "@refract-org/evidence-graph";
import type { AuthConfig } from "@refract-org/ingestion";

import { runAnalyze } from "./analyze.js";

/**
 * Writing a stream of STD-07 discrepancy records for another system to read.
 *
 * `@refract-org/evidence-graph` supplies the record shape and refuses to decide
 * which changes matter; this is the command that makes an operator decide, once,
 * and then keeps deciding the same way. Three things are required and none has a
 * default:
 *
 *   --subject    what the receiving system calls the thing this is about. A
 *                consumer matches records by subject, so an identifier that
 *                means something only inside Refract arrives as evidence about
 *                nothing.
 *   --expected   the assumption that would be violated. It belongs to whoever
 *                made it, which is not this tool.
 *   --when       which events count. Every value names a predicate over fields
 *                the event already carries, and the operator picks one.
 *
 * `--when any` is a legitimate answer — "every change here is a discrepancy
 * against that expectation" — and it is still a choice someone made rather than
 * a behaviour that arrived switched on.
 */

export const WHEN_RULES = {
  weakening: "the edit weakened the claim's certainty",
  strengthening: "the edit strengthened the claim's certainty",
  "direction-changed": "the edit moved certainty in either direction",
  "citation-removed": "a citation was removed",
  any: "every event on this page",
} as const;

export type WhenRule = keyof typeof WHEN_RULES;

export function isWhenRule(value: string): value is WhenRule {
  return Object.hasOwn(WHEN_RULES, value);
}

/** The predicate each rule names, over fields the event already carries. */
export function matchesRule(event: EvidenceEvent, rule: WhenRule): boolean {
  switch (rule) {
    case "weakening":
      return event.directionSignal === "weakening";
    case "strengthening":
      return event.directionSignal === "strengthening";
    case "direction-changed":
      return event.directionSignal === "weakening" || event.directionSignal === "strengthening";
    case "citation-removed":
      return event.eventType === "citation_removed";
    case "any":
      return true;
  }
}

export interface DelegationOptions {
  subject?: string;
  expected?: string;
  when?: string;
  section?: string;
  out?: string;
  apiUrl?: string;
  auth?: AuthConfig;
  config?: AnalyzerConfig;
  /** Fixed timestamp, so re-running over unchanged revisions rewrites the same bytes. */
  recordedAt?: string;
}

export class DelegationInputError extends Error {}

export async function runDelegation(pageTitle: string, options: DelegationOptions): Promise<void> {
  const subject = options.subject?.trim();
  const expected = options.expected?.trim();
  const when = options.when?.trim();

  if (!subject) {
    throw new DelegationInputError(
      "--subject is required: name the thing as the receiving system knows it, or the records arrive as evidence about nothing",
    );
  }
  if (!expected) {
    throw new DelegationInputError(
      "--expected is required: state the assumption these changes would violate. Refract does not know it",
    );
  }
  if (!when) {
    throw new DelegationInputError(`--when is required, and has no default: ${Object.keys(WHEN_RULES).join(", ")}`);
  }
  if (!isWhenRule(when)) {
    throw new DelegationInputError(
      `--when ${when} is not a rule. One of: ${Object.entries(WHEN_RULES)
        .map(([name, description]) => `${name} (${description})`)
        .join("; ")}`,
    );
  }

  const { events } = await runAnalyze(
    pageTitle,
    "detailed",
    undefined,
    undefined,
    undefined,
    false,
    options.apiUrl,
    undefined,
    undefined,
    options.auth,
    options.config,
  );

  const section = options.section?.trim();
  const records = toDiscrepancyStream(events, (event) => {
    if (section && event.section !== section) return null;
    if (!matchesRule(event, when)) return null;
    return {
      subject,
      expected,
      origin: `refract:${pageTitle}`,
      recordedAt: options.recordedAt,
    };
  });

  const ndjson = toDelegationNdjson(records);
  if (options.out) {
    writeFileSync(options.out, ndjson);
    // To stderr, so `--out` and a piped stdout do not fight over the stream.
    console.error(`${records.length} discrepancy record${records.length === 1 ? "" : "s"} → ${options.out}`);
    return;
  }
  process.stdout.write(ndjson);
}
