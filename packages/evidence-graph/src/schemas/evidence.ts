// Evidence event — what happened at a revision boundary

/** Current event schema version. Bump when EventType gains or loses members. */
export const EVENT_SCHEMA_VERSION = "0.4.0";

export type EvidenceLayer = "observed" | "policy_coded" | "model_interpretation" | "speculative" | "unknown";

export type EventType =
  | "sentence_first_seen"
  | "sentence_removed"
  | "sentence_modified"
  | "sentence_reintroduced"
  | "citation_added"
  | "citation_removed"
  | "citation_replaced"
  | "template_added"
  | "template_removed"
  | "revert_detected"
  | "section_reorganized"
  | "lead_promotion"
  | "lead_demotion"
  | "page_moved"
  | "wikilink_added"
  | "wikilink_removed"
  | "category_added"
  | "category_removed"
  | "protection_changed"
  | "talk_page_correlated"
  | "talk_thread_opened"
  | "talk_thread_archived"
  | "talk_reply_added"
  | "template_parameter_changed"
  | "edit_cluster_detected"
  | "talk_activity_spike";

export interface FactProvenance {
  analyzer: string;
  version: string;
  inputHashes: string[];
  parameters?: Record<string, string | number | boolean>;
  /** SHA-256 Merkle root of the raw document state and parameter footprint. */
  merkleRoot: string;
  /** Analyzer configuration / parameters snapshot used to produce the fact. */
  parameterFootprint: Record<string, unknown>;
  /** SHA-256 hash of the raw source snapshot (e.g., before/after state). */
  sourceSnapshotHash: string;
  /** ISO 8601 timestamp when the provenance block became effective. */
  effectiveAt: string;
  /** Precise reference window, page, paragraph, or character offset range. */
  sourceSpan?: string;
}

export type PolicyDimension =
  | "verifiability"
  | "npov"
  | "blp"
  | "due_weight"
  | "protection"
  | "edit_warring"
  | "notability"
  | "copyright"
  | "civility";

export interface DeterministicFact {
  fact: string;
  detail?: string;
  provenance?: FactProvenance;
  /** Document range reference pointer. */
  sourceSpan?: string;
}

export interface ModelInterpretation {
  semanticChange: string;
  confidence: number;
  policyDimension?: PolicyDimension;
  discussionType?:
    | "notability_challenge"
    | "sourcing_dispute"
    | "neutrality_concern"
    | "content_deletion"
    | "content_addition"
    | "naming_dispute"
    | "procedural"
    | "other";
}

/** Deterministic edit magnitude — character count thresholds */
export type EditMagnitude = "minor" | "moderate" | "major";

/** Deterministic content change classification */
export type ContentChange = "introduction" | "removal" | "expansion" | "compression" | "refinement" | "rewrite";

/** Deterministic certainty profile — counts of certainty/hedging markers */
export interface CertaintyProfile {
  high: number;
  medium: number;
  low: number;
  hedging: number;
}

/** Deterministic direction signal — computed from certainty shift */
export type DirectionSignal = "strengthening" | "weakening" | "neutral";

/** A quantitative finding extracted from edit text */
export interface QuantitativeFinding {
  type: string;
  value: string;
  raw: string;
  /** Document range reference pointer. */
  sourceSpan?: string;
}

export interface EvidenceEvent {
  schemaVersion?: string; // EVENT_SCHEMA_VERSION at time of generation
  eventId?: string; // deterministic content hash (see below)
  eventType: EventType; // discriminator
  claimId?: string; // claim identity hash, when applicable
  fromRevisionId: number; // parent revision
  toRevisionId: number; // source revision
  section: string; // section title where change occurred
  before: string; // text / state before the change
  after: string; // text / state after the change
  deterministicFacts: DeterministicFact[]; // facts backing this event
  modelInterpretation?: ModelInterpretation; // set by downstream consumers
  // Deterministic semantic enrichment (refract v0.5.0+)
  editMagnitude?: EditMagnitude;
  contentChange?: ContentChange;
  keyTerms?: string[];
  certaintyProfile?: CertaintyProfile;
  directionSignal?: DirectionSignal;
  quantitativeFindings?: QuantitativeFinding[];
  layer: EvidenceLayer; // provenance layer
  timestamp: string; // ISO 8601
}
