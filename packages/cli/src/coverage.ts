import type { Revision } from "@refract-org/evidence-graph";

export interface HistoryRequest {
  fromRevisionId?: number;
  toRevisionId?: number;
  since?: string;
  limit?: number;
}
export interface HistoryCoverage {
  requested: HistoryRequest;
  observed: { fromRevisionId: number | null; toRevisionId: number | null; revisionCount: number };
  status: "complete" | "partial" | "insufficient" | "unknown";
  missingRevisionIds: number[];
  unavailableRevisionIds: number[];
  truncated: boolean;
  notes: string[];
}

export function describeCoverage(
  revisions: Revision[],
  requested: HistoryRequest = {},
  truncated = false,
): HistoryCoverage {
  const ids = new Set(revisions.map((r) => r.revId));
  const missing = new Set<number>();
  for (const id of [requested.fromRevisionId, requested.toRevisionId]) {
    if (id !== undefined && !ids.has(id)) missing.add(id);
  }
  for (let i = 1; i < revisions.length; i++) {
    const parent = revisions[i].parentId;
    if (parent !== undefined && parent !== revisions[i - 1].revId) missing.add(parent);
  }
  const unavailable = revisions.filter((r) => r.contentAvailable === false).map((r) => r.revId);
  const unknown = revisions.slice(1).some((r) => r.parentId === undefined);
  const notes: string[] = [];
  if (requested.limit)
    notes.push(`Selection is limited to ${requested.limit} revisions; it is not the entire history.`);
  if (requested.since) notes.push("Transitions from before the requested timestamp are outside this selection.");
  if (missing.size) notes.push("Requested endpoints or intervening parent revisions are missing.");
  if (unavailable.length) notes.push("Some source text is unavailable; those transitions were not analyzed.");
  if (unknown) notes.push("Parent links are unavailable for some inputs; continuity is unverified.");
  if (truncated) notes.push("The fetch limit was reached before the requested end. Increase --limit and resume.");
  if (revisions.length < 2) notes.push("At least two revisions are needed to compare text.");
  return {
    requested,
    observed: {
      fromRevisionId: revisions[0]?.revId ?? null,
      toRevisionId: revisions.at(-1)?.revId ?? null,
      revisionCount: revisions.length,
    },
    status:
      missing.size || unavailable.length || truncated
        ? "partial"
        : revisions.length < 2
          ? "insufficient"
          : unknown
            ? "unknown"
            : "complete",
    missingRevisionIds: [...missing],
    unavailableRevisionIds: unavailable,
    truncated,
    notes,
  };
}

export function formatCoverage(coverage: HistoryCoverage): string {
  const { observed } = coverage;
  return `Coverage: ${coverage.status}; ${observed.revisionCount} revisions (${observed.fromRevisionId ?? "none"} → ${observed.toRevisionId ?? "none"}).${coverage.notes.length ? ` ${coverage.notes.join(" ")}` : ""}`;
}

/** Never compare across a known missing parent or unavailable content. */
export function contiguousRevisionGroups(revisions: Revision[]): Revision[][] {
  const groups: Revision[][] = [];
  let current: Revision[] = [];
  for (const revision of revisions) {
    if (revision.contentAvailable === false) {
      current = [];
      continue;
    }
    if (!current.length || (revision.parentId !== undefined && revision.parentId !== current.at(-1)?.revId)) {
      current = [];
      groups.push(current);
    }
    current.push(revision);
  }
  return groups;
}
