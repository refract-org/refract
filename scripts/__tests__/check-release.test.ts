import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  caretSatisfies,
  checkCliVersionConstant,
  checkManifests,
  compareVersions,
  diffTrees,
  publishOrder,
} from "../check-release.js";

type Deps = Record<string, string>;

function ws(dir: string, index: number, name: string, version: string, extra: Record<string, unknown> = {}) {
  return { dir, index, manifest: { name, version, ...extra } as { name: string; version: string; dependencies?: Deps } };
}

/** The shape this repo had when cli 0.5.7 went out: a range pinned to an older minor. */
function tree(cliDeps: Deps, overrides: { mcpPrivate?: boolean } = {}) {
  return [
    ws("packages/evidence-graph", 0, "@refract-org/evidence-graph", "0.5.0"),
    ws("packages/analyzers", 1, "@refract-org/analyzers", "0.5.0", {
      dependencies: { "@refract-org/evidence-graph": "^0.5.0" },
    }),
    ws("packages/cli", 2, "@refract-org/cli", "0.5.7", { dependencies: cliDeps }),
    ws("packages/mcp", 3, "@refract-org/mcp", "0.1.0", {
      private: overrides.mcpPrivate ?? false,
      dependencies: { "@refract-org/evidence-graph": "^0.5.0" },
    }),
    ws("packages/persistence", 4, "@refract-org/persistence", "0.1.1", {
      private: true,
      dependencies: { "@refract-org/evidence-graph": "^0.4.0" },
    }),
  ];
}

describe("caretSatisfies", () => {
  it("applies npm's 0.x rule, which is how ^0.3.0 excluded 0.5.0", () => {
    expect(caretSatisfies("0.3.2", "^0.3.0")).toBe(true);
    expect(caretSatisfies("0.5.0", "^0.3.0")).toBe(false);
    expect(caretSatisfies("0.0.4", "^0.0.3")).toBe(false);
    expect(caretSatisfies("1.9.0", "^1.2.0")).toBe(true);
    expect(caretSatisfies("2.0.0", "^1.2.0")).toBe(false);
  });

  it("does not claim to understand other range forms", () => {
    expect(caretSatisfies("0.5.0", ">=0.3.0")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("orders numerically and puts a prerelease below its release", () => {
    expect(compareVersions("0.5.10", "0.5.9")).toBe(1);
    expect(compareVersions("0.5.7", "0.5.15")).toBe(-1);
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBe(-1);
    expect(compareVersions("0.3.1", "0.3.1")).toBe(0);
  });
});

describe("checkManifests", () => {
  it("flags the range that shipped a CLI that could not start", () => {
    const findings = checkManifests(
      tree({ "@refract-org/analyzers": "^0.3.0", "@refract-org/evidence-graph": "^0.5.0", "@refract-org/mcp": "^0.1.0" }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].pkg).toBe("@refract-org/cli");
    expect(findings[0].message).toContain("does not accept 0.5.0");
  });

  it("flags a range that accepts an older build than the one in the tree", () => {
    const findings = checkManifests(
      tree({ "@refract-org/analyzers": "^0.5.0", "@refract-org/evidence-graph": "^0.4.0 || ^0.5.0" }),
    );
    expect(findings.map((f) => f.message).join("\n")).toContain('use "^0.5.0"');
  });

  it("flags a dependency on a package that is never published", () => {
    const findings = checkManifests(tree({ "@refract-org/mcp": "^0.1.0" }, { mcpPrivate: true }));
    expect(findings[0].message).toContain("private and never published");
  });

  it("flags the workspace: protocol, which npm publish leaves in place", () => {
    const findings = checkManifests(tree({ "@refract-org/analyzers": "workspace:*" }));
    expect(findings[0].message).toContain("workspace: protocol");
  });

  it("ignores private packages' own ranges", () => {
    expect(checkManifests(tree({ "@refract-org/analyzers": "^0.5.0" }))).toEqual([]);
  });

  it("requires server.json to name the CLI version", () => {
    const serverJson = { version: "0.5.6", packages: [{ identifier: "@refract-org/cli", version: "0.5.6" }] };
    const findings = checkManifests(tree({ "@refract-org/analyzers": "^0.5.0" }), serverJson);
    expect(findings.map((f) => f.pkg)).toEqual(["server.json", "server.json"]);
  });
});

describe("publishOrder", () => {
  it("puts every package after its dependencies and leaves private ones out", () => {
    const order = publishOrder(
      tree({ "@refract-org/analyzers": "^0.5.0", "@refract-org/mcp": "^0.1.0" }),
    ).map((w) => w.manifest.name);
    expect(order).toEqual([
      "@refract-org/evidence-graph",
      "@refract-org/analyzers",
      "@refract-org/mcp",
      "@refract-org/cli",
    ]);
  });

  it("refuses a cycle rather than picking an order", () => {
    const a = ws("a", 0, "@refract-org/a", "1.0.0", { dependencies: { "@refract-org/b": "^1.0.0" } });
    const b = ws("b", 1, "@refract-org/b", "1.0.0", { dependencies: { "@refract-org/a": "^1.0.0" } });
    expect(() => publishOrder([a, b])).toThrow(/cycle/);
  });
});

describe("diffTrees", () => {
  it("reports runtime changes and ignores tests", () => {
    const root = mkdtempSync(join(tmpdir(), "check-release-test-"));
    try {
      const published = join(root, "published");
      const local = join(root, "local");
      for (const dir of [published, local]) mkdirSync(join(dir, "__tests__"), { recursive: true });
      writeFileSync(join(published, "index.ts"), "export const a = 1;\n");
      writeFileSync(join(local, "index.ts"), "export const a = 2;\n");
      writeFileSync(join(local, "stream.ts"), "export {};\n");
      writeFileSync(join(published, "gone.ts"), "export {};\n");
      writeFileSync(join(published, "__tests__", "x.test.ts"), "old\n");
      writeFileSync(join(local, "__tests__", "x.test.ts"), "new\n");

      expect(diffTrees(published, local)).toEqual(["gone.ts (removed here)", "index.ts", "stream.ts (new here)"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkCliVersionConstant", () => {
  it("fails when the stamped version and the package version disagree", () => {
    const root = mkdtempSync(join(tmpdir(), "check-release-test-"));
    try {
      mkdirSync(join(root, "packages", "cli", "src"), { recursive: true });
      writeFileSync(join(root, "packages", "cli", "src", "version.ts"), 'export const REFRACT_VERSION = "0.5.14";\n');
      const cli = [ws("packages/cli", 0, "@refract-org/cli", "0.5.15")];

      expect(checkCliVersionConstant(cli, root)[0].message).toContain("stamps 0.5.14");

      writeFileSync(join(root, "packages", "cli", "src", "version.ts"), 'export const REFRACT_VERSION = "0.5.15";\n');
      expect(checkCliVersionConstant(cli, root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
