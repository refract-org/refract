import { describe, expect, it } from "vitest";
import { OpenAICompatibleProvider } from "../inference-provider.js";

describe("OpenAICompatibleProvider default inference", () => {
  it("uses deterministic revert classification without an API key", async () => {
    const provider = new OpenAICompatibleProvider({});

    const result = await provider.infer("revert", { comment: "reverted vandalism" });

    expect(result).toEqual({
      boundary: "revert",
      output: { isRevert: true },
      confidence: 0.85,
      source: "default",
    });
  });

  it("uses deterministic edit heuristics without an API key", async () => {
    const provider = new OpenAICompatibleProvider({});

    const result = await provider.infer("heuristic", { comment: "added citation", sizeDelta: 120 });

    expect(result.output).toEqual({ kind: "sourcing" });
    expect(result.source).toBe("default");
  });
});
