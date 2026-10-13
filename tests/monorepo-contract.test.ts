import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

describe("Refract Monorepo App Consolidation Contract (TDD Harness)", () => {
  it("contains apps/docs and apps/ui in the monorepo root", () => {
    expect(existsSync(join(ROOT, "apps", "docs"))).toBe(true);
    expect(existsSync(join(ROOT, "apps", "ui"))).toBe(true);
  });

  it("verifies apps/docs has a valid package manifest and build script", () => {
    const pkgPath = join(ROOT, "apps", "docs", "package.json");
    expect(existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkg.name).toBe("refract-docs");
    expect(pkg.scripts?.build).toBeDefined();
  });

  it("verifies clients/python is the refract-py project", () => {
    const pyprojectPath = join(ROOT, "clients", "python", "pyproject.toml");
    expect(existsSync(pyprojectPath)).toBe(true);
    expect(readFileSync(pyprojectPath, "utf-8")).toMatch(/^name = "refract-py"$/m);
  });

  it("verifies apps/ui has a valid package manifest and build script", () => {
    const pkgPath = join(ROOT, "apps", "ui", "package.json");
    expect(existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkg.name).toBe("refract-ui");
    expect(pkg.scripts?.build).toBeDefined();
  });
});
