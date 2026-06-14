import { describe, expect, it } from "vitest";
import { PayerPolicySource } from "../src/payer-policy-source.js";

describe("PayerPolicySource", () => {
  it("parses a synthetic plain-text Medicaid coverage update", async () => {
    const text = `
Payer: State Medicaid
Region: Northeast
Effective Date: 2024-03-15
Document Version: 2024.1

Coverage Updates:
- Policy A is covered with prior authorization.
- Policy B is not covered effective immediately.
- Policy C is under review.

Note: All decisions effective 2024-03-15.
`;

    const source = new PayerPolicySource();
    const doc = await source.ingest({
      text,
      payerId: "state-medicaid",
      region: "northeast",
      provenanceUrl: "https://example.com/medicaid-update-2024-03-15.txt",
    });

    expect(doc.payerId).toBe("state-medicaid");
    expect(doc.region).toBe("northeast");
    expect(doc.effectiveDate).toBe("2024-03-15");
    expect(doc.documentVersion).toBe("2024.1");
    expect(doc.provenanceUrl).toBe("https://example.com/medicaid-update-2024-03-15.txt");
    expect(doc.coverageDecisions).toHaveLength(3);

    const texts = doc.coverageDecisions.map((d) => d.text);
    expect(texts).toContain("Policy A is covered with prior authorization.");
    expect(texts).toContain("Policy B is not covered effective immediately.");
    expect(texts).toContain("Policy C is under review.");
  });

  it("re-parses the same text and returns an identical normalized document", async () => {
    const text = `
Payer: State Medicaid
Region: Northeast
Effective Date: 2024-03-15
Document Version: 2024.1

Coverage Updates:
- Policy A is covered with prior authorization.
- Policy B is not covered effective immediately.
- Policy C is under review.
`;

    const source = new PayerPolicySource();
    const first = await source.ingest({
      text,
      payerId: "state-medicaid",
      region: "northeast",
      provenanceUrl: "https://example.com/medicaid-update-2024-03-15.txt",
    });
    const second = await source.ingest({
      text,
      payerId: "state-medicaid",
      region: "northeast",
      provenanceUrl: "https://example.com/medicaid-update-2024-03-15.txt",
    });

    expect(second).toEqual(first);
  });
});
