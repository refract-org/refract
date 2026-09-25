import { describe, expect, it } from "vitest";
import { GitRevisionSource } from "../git-source.js";
import { SnapshotDirectorySource } from "../snapshot-source.js";

describe("SnapshotDirectorySource", () => {
  it("yields revisions from in-memory snapshot items in chronological order", async () => {
    const source = new SnapshotDirectorySource({
      snapshots: {
        TestDocument: [
          { timestamp: "2026-02-01T00:00:00Z", content: "Second revision", comment: "v2" },
          { timestamp: "2026-01-01T00:00:00Z", content: "First revision", comment: "v1" },
        ],
      },
    });

    const revs = [];
    for await (const rev of source.revisions("TestDocument")) {
      revs.push(rev);
    }

    expect(revs).toHaveLength(2);
    expect(revs[0].content).toBe("First revision");
    expect(revs[0].revId).toBe(1);
    expect(revs[1].content).toBe("Second revision");
    expect(revs[1].revId).toBe(2);
  });

  it("filters revisions by date and limit", async () => {
    const source = new SnapshotDirectorySource({
      snapshots: {
        Doc: [
          { timestamp: "2026-01-01T00:00:00Z", content: "A" },
          { timestamp: "2026-01-05T00:00:00Z", content: "B" },
          { timestamp: "2026-01-10T00:00:00Z", content: "C" },
        ],
      },
    });

    const revs = [];
    for await (const rev of source.revisions("Doc", {
      start: new Date("2026-01-02T00:00:00Z"),
      limit: 1,
    })) {
      revs.push(rev);
    }

    expect(revs).toHaveLength(1);
    expect(revs[0].content).toBe("B");
  });
});

describe("GitRevisionSource", () => {
  it("returns empty stream for non-existent repo path", async () => {
    const source = new GitRevisionSource({ repoPath: "/tmp/non-existent-repo-refract-12345" });
    const revs = [];
    for await (const rev of source.revisions("README.md")) {
      revs.push(rev);
    }
    expect(revs).toHaveLength(0);
  });
});
