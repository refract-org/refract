import type { EvidenceEvent, Revision } from "@refract-org/evidence-graph";
import { describe, expect, it } from "vitest";
import { renderHtmlReport } from "../html-renderer.js";

const revision = (revId: number): Revision => ({
  revId,
  pageId: 1,
  pageTitle: "Sample",
  timestamp: "2026-01-01T00:00:00Z",
  comment: "",
  content: "",
  size: 0,
  minor: false,
});

const event = (after: string): EvidenceEvent =>
  ({
    eventType: "sentence_modified",
    fromRevisionId: 1,
    toRevisionId: 2,
    section: "(lead)",
    before: "before",
    after,
    deterministicFacts: [],
    layer: "observed",
    timestamp: "2026-01-01T00:00:00Z",
  }) as EvidenceEvent;

const inlineScripts = (html: string) =>
  html
    .split("<script>")
    .slice(1)
    .map((part) => part.split("</script>")[0]);

describe("renderHtmlReport", () => {
  it.each([true, false])("emits an inline script that parses (JSON download: %s)", (showJsonDownload) => {
    const html = renderHtmlReport("Sample", [event("after")], [revision(1), revision(2)], showJsonDownload);
    const [script, ...others] = inlineScripts(html);
    expect(others).toEqual([]);
    expect(() => new Function(script)).not.toThrow();
  });

  it("keeps wiki text from closing the inline script", () => {
    const html = renderHtmlReport("Sample", [event("</script><script>alert(1)</script>")], [revision(1), revision(2)]);
    const [script, ...others] = inlineScripts(html);
    expect(others).toEqual([]);
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain("\\u003c/script>");
  });
});
