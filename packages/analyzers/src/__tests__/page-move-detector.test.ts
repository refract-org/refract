import { describe, expect, it } from "vitest";
import { buildPageMoveEvents, windowPageMoves } from "../page-move-detector.js";

interface MoveRecord {
  oldTitle: string;
  newTitle: string;
  timestamp: string;
  revId: number;
  comment: string;
}

describe("buildPageMoveEvents", () => {
  it("converts move records to EvidenceEvent[]", () => {
    const moves: MoveRecord[] = [
      {
        oldTitle: "Old Page",
        newTitle: "New Page",
        timestamp: "2024-01-01T00:00:00Z",
        revId: 12345,
        comment: "Renamed for clarity",
      },
    ];

    const events = buildPageMoveEvents(moves);

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("page_moved");
    expect(events[0].fromRevisionId).toBe(0);
    expect(events[0].toRevisionId).toBe(12345);
    expect(events[0].before).toBe("Old Page");
    expect(events[0].after).toBe("New Page");
    expect(events[0].section).toBe("");
    expect(events[0].layer).toBe("observed");
    expect(events[0].timestamp).toBe("2024-01-01T00:00:00Z");
    expect(events[0].deterministicFacts[0].fact).toBe("page_moved");
  });

  it("handles empty moves", () => {
    const events = buildPageMoveEvents([]);
    expect(events).toEqual([]);
  });

  it("handles multiple moves", () => {
    const moves: MoveRecord[] = [
      {
        oldTitle: "Page A",
        newTitle: "Page B",
        timestamp: "2024-01-01T00:00:00Z",
        revId: 1,
        comment: "First move",
      },
      {
        oldTitle: "Page B",
        newTitle: "Page C",
        timestamp: "2024-01-02T00:00:00Z",
        revId: 2,
        comment: "Second move",
      },
    ];

    const events = buildPageMoveEvents(moves);
    expect(events).toHaveLength(2);
  });
});

describe("windowPageMoves", () => {
  const mk = (timestamp: string) => ({
    oldTitle: "A",
    newTitle: "B",
    timestamp,
    revId: 1,
    comment: "",
  });

  it("drops moves outside the analyzed revision span", () => {
    const moves = [mk("2005-08-28T00:00:00Z"), mk("2026-08-20T12:00:00Z"), mk("2026-09-01T00:00:00Z")];
    const out = windowPageMoves(moves, "2026-08-13T00:00:00Z", "2026-08-27T00:00:00Z");
    expect(out).toHaveLength(1);
    expect(out[0].timestamp).toBe("2026-08-20T12:00:00Z");
  });

  it("keeps boundary moves — bounds are inclusive", () => {
    const moves = [mk("2026-08-13T00:00:00Z"), mk("2026-08-27T00:00:00Z")];
    const out = windowPageMoves(moves, "2026-08-13T00:00:00Z", "2026-08-27T00:00:00Z");
    expect(out).toHaveLength(2);
  });

  it("is the identity on a full-history window", () => {
    const moves = [mk("2005-08-28T00:00:00Z"), mk("2026-08-20T12:00:00Z")];
    const out = windowPageMoves(moves, "2001-01-15T00:00:00Z", "2026-08-27T00:00:00Z");
    expect(out).toHaveLength(2);
  });
});
