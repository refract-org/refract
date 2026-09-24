import { describe, expect, it } from "vitest";
import { headingLines } from "../commands/snapshot.js";

describe("headingLines", () => {
  it("lists each heading with its level", () => {
    expect(headingLines("Lead.\n== History ==\n=== Early years ===\nText.\n= Top =\n== a = b ==")).toEqual([
      { level: 2, name: "History" },
      { level: 3, name: "Early years" },
      { level: 1, name: "Top" },
      { level: 2, name: "a = b" },
    ]);
  });

  it("skips lines with nothing but whitespace between the runs of '='", () => {
    // The previous pattern printed these as sections named "=" or as whitespace.
    expect(headingLines("====\n== ==\n=\t===\n== x == ")).toEqual([]);
  });

  it("stays linear on a line of '=' and whitespace", () => {
    const start = performance.now();
    expect(headingLines(`=\t${"\t".repeat(5000)}x\t${"\t".repeat(5000)}=\n== Next ==`)).toEqual([
      { level: 1, name: "x" },
      { level: 2, name: "Next" },
    ]);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
