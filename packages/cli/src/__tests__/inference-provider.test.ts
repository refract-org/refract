import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { INFERENCE_BOUNDARIES, OpenAICompatibleProvider } from "../inference-provider.js";

const execute = promisify(execFile);
const refract = (...args: string[]) =>
  execute(process.execPath, [resolve("packages/cli/dist/src/cli.js"), ...args], { encoding: "utf8" });

describe("refract classify", () => {
  it("lists the boundaries in its help", async () => {
    const { stdout } = await refract("classify", "--help");

    for (const boundary of INFERENCE_BOUNDARIES) expect(stdout).toContain(boundary);
  });

  it("rejects an unknown boundary instead of printing undefined", async () => {
    await expect(refract("classify", "nonsense", "--input", "{}")).rejects.toMatchObject({
      code: 1,
      stdout: "",
      stderr: expect.stringContaining("Allowed choices are revert"),
    });
  });
});

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
