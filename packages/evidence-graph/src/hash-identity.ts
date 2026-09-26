import { createHash } from "node:crypto";
import type { ClaimIdentity } from "./schemas/claim.js";
import type { EvidenceEvent } from "./schemas/evidence.js";

/**
 * Current claim identity version. Bump this when the identity derivation
 * changes (e.g., normalization rules, field composition). Different versions
 * produce different claim IDs for the same text, which fragments downstream
 * consumers. Version bumps must be explicit and documented.
 */
export const CLAIM_IDENTITY_VERSION = "claimidentityv1";

export function createClaimIdentity(params: {
  text: string;
  section: string;
  pageTitle: string;
  pageId: number;
  version?: string;
}): ClaimIdentity {
  const version = params.version ?? CLAIM_IDENTITY_VERSION;
  const identityKey = `${version}|${params.pageTitle}|${params.pageId}|${params.section}|${params.text.toLowerCase().trim()}`;
  const claimId = createHash("sha256").update(identityKey).digest("hex").slice(0, 16);
  return {
    claimId,
    identityKey,
    pageTitle: params.pageTitle,
    pageId: params.pageId,
  };
}

export function createEventIdentity(event: Omit<EvidenceEvent, "eventId" | "modelInterpretation">): string {
  const factsStr = (event.deterministicFacts ?? []).map((f) => `${f.fact}:${f.detail ?? ""}`).join("|");
  const identityKey = `${event.eventType}|${event.fromRevisionId}|${event.toRevisionId}|${event.section}|${event.before}|${event.after}|${event.timestamp}|${factsStr}`;
  return createHash("sha256").update(identityKey).digest("hex").slice(0, 16);
}
