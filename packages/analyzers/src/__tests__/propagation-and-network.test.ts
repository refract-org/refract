import { describe, expect, it } from "vitest";
import { analyzeCitationNetwork } from "../citation-tracker.js";
import { detectTextPropagation } from "../propagation-detector.js";

describe("detectTextPropagation", () => {
  it("detects identical texts as significant borrowing with similarity 1.0", () => {
    const text =
      "This is a specific test paragraph detailing procedural safeguards and standardized definitions for general usage.";
    const result = detectTextPropagation(text, text);

    expect(result.jaccardSimilarity).toBe(1.0);
    expect(result.isSignificantBorrowing).toBe(true);
    expect(result.borrowedSpans.length).toBeGreaterThan(0);
  });

  it("detects borrowed verbatim passage embedded inside a different document", () => {
    const sourceBoilerplate =
      "All authorized entities must submit quarterly compliance disclosures detailing all operational expenditures and administrative allocations.";
    const targetDocument = `
      Section 4. Overview of Administrative Procedures.
      The committee reviewed the initial findings on Monday.
      All authorized entities must submit quarterly compliance disclosures detailing all operational expenditures and administrative allocations.
      Further revisions will be reviewed at the subsequent meeting.
    `;

    const result = detectTextPropagation(sourceBoilerplate, targetDocument, { minSpanTokens: 6 });

    expect(result.borrowedSpans.length).toBeGreaterThanOrEqual(1);
    expect(result.sharedTokenCount).toBeGreaterThan(10);
    expect(result.isSignificantBorrowing).toBe(true);
    expect(result.borrowedSpans[0].text).toContain("quarterly compliance disclosures");
  });

  it("reports zero similarity and no borrowed spans for unrelated texts", () => {
    const textA = "The rapid development of photovoltaic solar energy across the continent.";
    const textB = "Ancient Roman architecture incorporated arches and concrete domes extensively.";

    const result = detectTextPropagation(textA, textB);
    expect(result.jaccardSimilarity).toBe(0);
    expect(result.borrowedSpans).toHaveLength(0);
    expect(result.isSignificantBorrowing).toBe(false);
  });
});

describe("analyzeCitationNetwork", () => {
  it("computes concentration metrics and top domains", () => {
    const citations = [
      { url: "https://example.org/study1", raw: "<ref>example.org</ref>" },
      { url: "https://example.org/study2", raw: "<ref>example.org</ref>" },
      { url: "https://example.org/study3", raw: "<ref>example.org</ref>" },
      { url: "https://independent-journal.org/paper", raw: "<ref>independent</ref>" },
    ];

    const analysis = analyzeCitationNetwork(citations);
    expect(analysis.uniqueSourceCount).toBe(4);
    expect(analysis.domainDistribution["example.org"]).toBe(3);
    expect(analysis.domainDistribution["independent-journal.org"]).toBe(1);
    expect(analysis.sourceConcentrationIndex).toBeGreaterThan(0.5);
    expect(analysis.isHighConcentration).toBe(true);
  });

  it("handles empty citations gracefully", () => {
    const analysis = analyzeCitationNetwork([]);
    expect(analysis.uniqueSourceCount).toBe(0);
    expect(analysis.sourceConcentrationIndex).toBe(0);
    expect(analysis.isHighConcentration).toBe(false);
  });
});
