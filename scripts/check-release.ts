#!/usr/bin/env bun
/**
 * Release check: would the packages publish.yml puts on npm install and run
 * for someone who gets them from npm?
 *
 * @refract-org/cli@0.5.7, the newest CLI on npm when this was written, cannot
 * start. It imports computeCertaintyProfile from @refract-org/analyzers but
 * declares "^0.3.0", which on a 0.x version means 0.3.x only, so npm installs
 * analyzers 0.3.2, which lacks it. Override that to 0.5.0 and it fails one
 * import later: WikimediaStreamClient is not in the published ingestion 0.3.1,
 * because that version's build predates it. No combination of published
 * versions makes it run, so `npx @refract-org/cli` has failed for everyone
 * since May.
 *
 * Three mechanisms produced that, and all three were still live:
 *
 *   1. Internal dependency ranges drifted from the versions they were built
 *      against, and nothing compared them.
 *   2. publish.yml skips a version that is already on npm. That is right for a
 *      re-run and wrong for a package whose source changed without a version
 *      bump: its dependents are built against the new source and published,
 *      while it stays at its old published bytes. evidence-graph 0.5.0,
 *      ingestion 0.3.1 and eval 0.2.1 were all in that state.
 *   3. cli depends on @refract-org/mcp, which publish.yml never published, so
 *      the next cli release would not have installed at all.
 *
 * Offline, always:
 *   - every internal dependency of a published package is itself published;
 *   - every internal range is "^" plus the sibling's version in this tree, so
 *     a dependent never accepts a version older than the one it was built
 *     against;
 *   - server.json names the cli version this tree would publish;
 *   - the publish order is a topological sort (printed by --order).
 * With --registry, it also reads npm:
 *   - a package whose version is already on npm must have the same src/ as the
 *     published tarball, or its version has to be bumped;
 *   - no package may sit below the version npm already calls latest.
 * With --pack (after `bun run build`), it installs what would be published:
 *   - every publishable package is packed with `npm pack`, the tarballs are
 *     installed together into an empty project with npm, and the installed
 *     `refract --version` has to run and print the CLI's version. That is the
 *     question a consumer's first command asks, and 0.5.7 failed it.
 *
 * A registry that cannot be read fails the check. Passing because the network
 * was down would be a check that says "fine" about something it never looked at.
 *
 * Usage:
 *   bun scripts/check-release.ts              # offline checks
 *   bun scripts/check-release.ts --registry   # also compare against npm
 *   bun scripts/check-release.ts --pack       # also pack, install and run the CLI
 *   bun scripts/check-release.ts --order      # print publish order, one dir per line
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Plain Node APIs throughout, not Bun's, so the vitest suite (which runs under
// Node) can import and test the checks directly.
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REGISTRY = process.env.REFRACT_NPM_REGISTRY ?? "https://registry.npmjs.org";
const SCOPE = "@refract-org/";

interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface Workspace {
  dir: string; // relative to ROOT, e.g. "packages/cli"
  index: number; // position in the root workspaces list, used to break ties
  manifest: Manifest;
}

export interface Finding {
  pkg: string;
  message: string;
}

/** Compare two x.y.z versions; a prerelease sorts below its release. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, pre = ""] = v.split("-", 2);
    return { nums: core.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/**
 * Whether `version` satisfies a caret range, with npm's 0.x rule: ^0.3.0 means
 * >=0.3.0 <0.4.0, and ^0.0.3 means exactly 0.0.3. That rule is how cli 0.5.7's
 * "^0.3.0" came to install an analyzers without the code it imports. Other
 * range forms return null: the check requires carets, so it never needs them.
 */
export function caretSatisfies(version: string, range: string): boolean | null {
  const m = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range.trim());
  if (!m) return null;
  const [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const floor = `${maj}.${min}.${pat}`;
  const ceiling = maj > 0 ? `${maj + 1}.0.0` : min > 0 ? `0.${min + 1}.0` : `0.0.${pat + 1}`;
  return compareVersions(version, floor) >= 0 && compareVersions(version, ceiling) < 0;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function loadWorkspaces(root = ROOT): Workspace[] {
  const rootManifest = readJson<{ workspaces?: string[] }>(join(root, "package.json"));
  return (rootManifest.workspaces ?? []).map((dir, index) => ({
    dir,
    index,
    manifest: readJson<Manifest>(join(root, dir, "package.json")),
  }));
}

function internalDeps(manifest: Manifest): Array<{ name: string; range: string; field: string }> {
  const out: Array<{ name: string; range: string; field: string }> = [];
  for (const field of ["dependencies", "optionalDependencies", "peerDependencies"] as const) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      if (name.startsWith(SCOPE)) out.push({ name, range, field });
    }
  }
  return out;
}

/** The offline checks. Pure over the manifests, so they can be tested. */
export function checkManifests(workspaces: Workspace[], serverJson?: unknown): Finding[] {
  const findings: Finding[] = [];
  const byName = new Map(workspaces.map((w) => [w.manifest.name, w]));

  for (const ws of workspaces) {
    const m = ws.manifest;
    if (m.private) continue;
    for (const dep of internalDeps(m)) {
      const sibling = byName.get(dep.name);
      if (!sibling) {
        findings.push({ pkg: m.name, message: `${dep.field} names ${dep.name}, which is not a workspace here` });
        continue;
      }
      if (sibling.manifest.private) {
        findings.push({
          pkg: m.name,
          message: `${dep.field} names ${dep.name}, which is private and never published — every install would fail to resolve it`,
        });
      }
      if (dep.range.startsWith("workspace:")) {
        findings.push({
          pkg: m.name,
          message: `${dep.field} ${dep.name}@"${dep.range}": npm publish does not rewrite the workspace: protocol`,
        });
        continue;
      }
      const expected = `^${sibling.manifest.version}`;
      if (dep.range !== expected) {
        const satisfied = caretSatisfies(sibling.manifest.version, dep.range);
        const why =
          satisfied === null
            ? "is a range form this check does not read"
            : satisfied
              ? `accepts versions older than the ${sibling.manifest.version} this tree builds against`
              : `does not accept ${sibling.manifest.version}, the version in this tree — npm would install a different build than the one tested here`;
        findings.push({ pkg: m.name, message: `${dep.field} ${dep.name}@"${dep.range}" ${why}; use "${expected}"` });
      }
    }
  }

  const cli = byName.get("@refract-org/cli");
  if (cli && serverJson && typeof serverJson === "object") {
    const s = serverJson as { version?: string; packages?: Array<{ identifier?: string; version?: string }> };
    const cliVersion = cli.manifest.version;
    if (s.version !== cliVersion) {
      findings.push({ pkg: "server.json", message: `version is ${s.version}, cli is ${cliVersion}` });
    }
    for (const p of s.packages ?? []) {
      if (p.identifier === cli.manifest.name && p.version !== cliVersion) {
        findings.push({ pkg: "server.json", message: `packages[${p.identifier}] is ${p.version}, cli is ${cliVersion}` });
      }
    }
  }

  try {
    publishOrder(workspaces);
  } catch (err) {
    findings.push({ pkg: "(order)", message: (err as Error).message });
  }

  return findings;
}

/**
 * The version the CLI stamps into its output has to be the version it ships as.
 * It lives in packages/cli/src/version.ts so there is one literal to check.
 */
export function checkCliVersionConstant(workspaces: Workspace[], root = ROOT): Finding[] {
  const cli = workspaces.find((w) => w.manifest.name === "@refract-org/cli");
  if (!cli) return [];
  const source = readFileSync(join(root, cli.dir, "src", "version.ts"), "utf-8");
  const stamped = source.match(/REFRACT_VERSION\s*=\s*"([^"]+)"/)?.[1];
  if (stamped === cli.manifest.version) return [];
  return [
    {
      pkg: cli.manifest.name,
      message: `src/version.ts stamps ${stamped ?? "(nothing)"} into --version and every manifest, package.json says ${cli.manifest.version}`,
    },
  ];
}

/**
 * Publishable workspaces in dependency order, ties broken by their position in
 * the root workspaces list so the order is stable run to run.
 */
export function publishOrder(workspaces: Workspace[]): Workspace[] {
  const publishable = workspaces.filter((w) => !w.manifest.private);
  const names = new Set(publishable.map((w) => w.manifest.name));
  const pending = new Map(
    publishable.map((w) => [w.manifest.name, new Set(internalDeps(w.manifest).map((d) => d.name).filter((n) => names.has(n)))]),
  );
  const order: Workspace[] = [];
  while (pending.size > 0) {
    const ready = publishable
      .filter((w) => pending.get(w.manifest.name)?.size === 0)
      .sort((a, b) => a.index - b.index);
    if (ready.length === 0) {
      throw new Error(`dependency cycle among: ${[...pending.keys()].join(", ")}`);
    }
    const next = ready[0];
    order.push(next);
    pending.delete(next.manifest.name);
    for (const deps of pending.values()) deps.delete(next.manifest.name);
  }
  return order;
}

/**
 * Runtime source files under a src/ tree. Tests ship in the tarball too, but a
 * test-only change cannot break a consumer, and requiring a version bump for
 * one would make the check fire on changes that do not matter.
 */
function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      if (entry === "__tests__") continue;
      const full = join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (!/\.test\.[cm]?[jt]s$/.test(entry)) out.push(relative(dir, full));
    }
  };
  walk(dir);
  return out.sort();
}

/** Runtime files that differ between two src/ trees, by relative path. */
export function diffTrees(published: string, local: string): string[] {
  const a = new Set(listFiles(published));
  const b = new Set(listFiles(local));
  const diffs: string[] = [];
  for (const f of a) {
    if (!b.has(f)) diffs.push(`${f} (removed here)`);
    else if (!readFileSync(join(published, f)).equals(readFileSync(join(local, f)))) diffs.push(f);
  }
  for (const f of b) if (!a.has(f)) diffs.push(`${f} (new here)`);
  return diffs.sort();
}

async function fetchPackument(name: string): Promise<{
  "dist-tags"?: Record<string, string>;
  versions?: Record<string, { dist?: { tarball?: string } }>;
} | null> {
  const url = `${REGISTRY}/${name.replaceAll("/", "%2f")}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 404) return null; // never published: nothing to compare
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function checkRegistry(workspaces: Workspace[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const ws of publishOrder(workspaces)) {
    const { name, version } = ws.manifest;
    const packument = await fetchPackument(name);
    if (!packument) {
      console.log(`  ${name}@${version}: not on npm yet, will be published`);
      continue;
    }
    const latest = packument["dist-tags"]?.latest;
    if (latest && compareVersions(version, latest) < 0) {
      findings.push({ pkg: name, message: `${version} is below ${latest}, which npm already calls latest` });
    }
    const published = packument.versions?.[version];
    if (!published) {
      console.log(`  ${name}@${version}: new version, will be published`);
      continue;
    }
    const tarball = published.dist?.tarball;
    if (!tarball) throw new Error(`${name}@${version}: registry lists no tarball`);
    const res = await fetch(tarball);
    if (!res.ok) throw new Error(`${tarball}: HTTP ${res.status}`);
    const tmp = mkdtempSync(join(tmpdir(), "refract-release-"));
    try {
      const archive = join(tmp, "package.tgz");
      writeFileSync(archive, new Uint8Array(await res.arrayBuffer()));
      const tar = spawnSync("tar", ["-xzf", archive, "-C", tmp], { encoding: "utf-8" });
      if (tar.status !== 0) throw new Error(`${tarball}: could not unpack (${tar.stderr.trim()})`);
      const diffs = diffTrees(join(tmp, "package", "src"), join(ROOT, ws.dir, "src"));
      if (diffs.length === 0) {
        console.log(`  ${name}@${version}: already on npm with this source, publish will skip it`);
      } else {
        const shown = diffs.slice(0, 8).join(", ") + (diffs.length > 8 ? `, and ${diffs.length - 8} more` : "");
        findings.push({
          pkg: name,
          message: `${version} is already on npm with different source (${shown}). publish.yml would skip it and ship dependents built against code npm does not have — bump the version`,
        });
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  return findings;
}

/**
 * npm from the Node toolchain. setup-bun can put a bun-backed `npm` first on
 * PATH (publish.yml records it failing there), and this has to be the npm a
 * consumer runs.
 */
function nodeNpm(): string {
  const node = spawnSync("sh", ["-c", "command -v node"], { encoding: "utf-8" }).stdout.trim();
  const candidate = node ? join(dirname(node), "npm") : "";
  return candidate && existsSync(candidate) ? candidate : "npm";
}

function tail(text: string, lines = 12): string {
  return text.trim().split("\n").slice(-lines).join("\n");
}

function packAndRun(workspaces: Workspace[]): Finding[] {
  const npm = nodeNpm();
  const tmp = mkdtempSync(join(tmpdir(), "refract-pack-"));
  try {
    const tarballs = join(tmp, "tarballs");
    mkdirSync(tarballs);
    for (const ws of publishOrder(workspaces)) {
      const packed = spawnSync(npm, ["pack", "--silent", "--pack-destination", tarballs], {
        cwd: join(ROOT, ws.dir),
        encoding: "utf-8",
      });
      if (packed.status !== 0) {
        return [{ pkg: ws.manifest.name, message: `npm pack failed:\n${tail(packed.stderr)}` }];
      }
    }

    const consumer = join(tmp, "consumer");
    mkdirSync(consumer);
    writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "refract-release-smoke", private: true }));
    const files = readdirSync(tarballs).map((f) => join(tarballs, f));
    const install = spawnSync(npm, ["install", "--no-audit", "--no-fund", "--ignore-scripts", ...files], {
      cwd: consumer,
      encoding: "utf-8",
    });
    if (install.status !== 0) {
      return [{ pkg: "(install)", message: `npm could not install the packed packages together:\n${tail(install.stderr)}` }];
    }

    const cli = workspaces.find((w) => w.manifest.name === "@refract-org/cli");
    if (!cli) return [];
    const run = spawnSync(join(consumer, "node_modules", ".bin", "refract"), ["--version"], { encoding: "utf-8" });
    if (run.status !== 0) {
      return [{ pkg: cli.manifest.name, message: `the installed \`refract --version\` failed:\n${tail(run.stderr)}` }];
    }
    if (run.stdout.trim() !== cli.manifest.version) {
      return [
        {
          pkg: cli.manifest.name,
          message: `the installed \`refract --version\` printed ${run.stdout.trim()}, expected ${cli.manifest.version}`,
        },
      ];
    }
    console.log(`  packed ${files.length} packages; installed \`refract --version\` printed ${cli.manifest.version}`);
    return [];
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const workspaces = loadWorkspaces();

  if (args.has("--order")) {
    for (const ws of publishOrder(workspaces)) console.log(ws.dir);
    return;
  }

  const serverJson = readJson<unknown>(join(ROOT, "server.json"));
  const findings = checkManifests(workspaces, serverJson);
  findings.push(...checkCliVersionConstant(workspaces));
  // The MCP server card advertises the same package; it carried 0.5.7 too.
  const card = readJson<{ version?: string }>(join(ROOT, ".well-known", "mcp", "server-card.json"));
  const cliVersion = workspaces.find((w) => w.manifest.name === "@refract-org/cli")?.manifest.version;
  if (cliVersion && card.version !== cliVersion) {
    findings.push({ pkg: ".well-known/mcp/server-card.json", message: `version is ${card.version}, cli is ${cliVersion}` });
  }

  if (args.has("--registry")) {
    console.log(`Comparing against ${REGISTRY}:`);
    findings.push(...(await checkRegistry(workspaces)));
  }

  if (args.has("--pack")) {
    console.log("Packing and installing as a consumer would:");
    findings.push(...packAndRun(workspaces));
  }

  if (findings.length > 0) {
    console.error("Release check failed:");
    for (const f of findings) console.error(`  - ${f.pkg}: ${f.message}`);
    process.exit(1);
  }
  const order = publishOrder(workspaces).map((w) => `${w.manifest.name}@${w.manifest.version}`);
  console.log(`Release check passed. Publish order: ${order.join(" → ")}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
