import type { EvidenceEvent, EvidenceLayer } from "@refract-org/evidence-graph";

interface PageMoveRecord {
  oldTitle: string;
  newTitle: string;
  timestamp: string;
  revId: number;
  comment: string;
}

/**
 * Bound move records to the analyzed revision span. The move log is fetched
 * for the page's whole lifetime, but an analysis windowed with --since/--from
 * must not emit moves from outside the window — a 14-day observation of
 * Bitcoin was opening with page moves from 2005. Bounds are inclusive; a
 * full-history run (window = first revision to last) keeps every move it
 * kept before.
 */
export function windowPageMoves(
  moves: PageMoveRecord[],
  firstRevTimestamp: string,
  lastRevTimestamp: string,
): PageMoveRecord[] {
  const start = new Date(firstRevTimestamp).getTime();
  const end = new Date(lastRevTimestamp).getTime();
  return moves.filter((m) => {
    const t = new Date(m.timestamp).getTime();
    return t >= start && t <= end;
  });
}

export function buildPageMoveEvents(moves: PageMoveRecord[]): EvidenceEvent[] {
  const events: EvidenceEvent[] = [];

  for (const move of moves) {
    const layer: EvidenceLayer = "observed";
    events.push({
      eventType: "page_moved",
      fromRevisionId: 0,
      toRevisionId: move.revId,
      section: "",
      before: move.oldTitle,
      after: move.newTitle,
      deterministicFacts: [
        { fact: "page_moved", detail: `from=${move.oldTitle} to=${move.newTitle} comment=${move.comment}` },
      ],
      layer,
      timestamp: move.timestamp,
    });
  }

  return events;
}
