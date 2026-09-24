/**
 * Release helper — bumps version, generates changelog from conventional commits,
 * and creates a Git tag. Run: bun scripts/release.ts <major|minor|patch>
 *
 * Reads the current version from the root package.json, bumps it according to the
 * specified level, writes the changelog entry, commits, and tags.
 *
 * The CLI ships as the project version, so the bump is written to every place that
 * carries it: the root package.json, packages/cli/package.json, the constant the CLI
 * stamps into its output (packages/cli/src/version.ts), server.json and the MCP
 * server card. The
 * other packages version on their own and are bumped by hand when their source
 * changes; scripts/check-release.ts, run here before anything is committed, fails
 * the release if one was changed without a bump or a dependent range was not moved.
 *
 * The actual npm publish and GitHub release creation are handled by the existing
 * publish.yml and release.yml workflows, which trigger on tag push.
 */

import { $ } from "bun";
import { readFileSync, writeFileSync } from "node:fs";

const level = Bun.argv[2];
if (!level || !["major", "minor", "patch"].includes(level)) {
  console.error("Usage: bun scripts/release.ts <major|minor|patch>");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);

const next = {
  major: `${major + 1}.0.0`,
  minor: `${major}.${minor + 1}.0`,
  patch: `${major}.${minor}.${patch + 1}`,
}[level];

const date = new Date().toISOString().slice(0, 10);

const tags = await $`git tag --sort=-creatordate`.text();
const lastTag = tags.split("\n")[0]?.trim();
const range = lastTag ? `${lastTag}..HEAD` : "HEAD";

const log = await $`git log ${range} --pretty=format:"%s"`.text();
const commits = log
  .split("\n")
  .filter(Boolean)
  .filter((c) => !c.startsWith("Merge"));

function categorize(prefix: string): string[] {
  return commits
    .filter((c) => c.startsWith(prefix))
    .map((c) => `- ${c.slice(prefix.length).trim()}`);
}

const sections: Record<string, string[]> = {
  Added: categorize("feat:"),
  Fixed: categorize("fix:"),
  Changed: categorize("refactor:"),
};
const other = [
  ...categorize("chore:"),
  ...categorize("docs:"),
  ...categorize("test:"),
];

const entry = [
  `## ${next} (${date})`,
  "",
  ...Object.entries(sections)
    .filter(([, items]) => items.length > 0)
    .flatMap(([label, items]) => [`### ${label}`, "", ...items, ""]),
  ...(other.length > 0 ? [`### Other`, "", ...other, ""] : []),
].join("\n");

const changelog = readFileSync("CHANGELOG.md", "utf-8");
// A hand-written "## Unreleased" section is the entry: it is renamed to the
// version rather than buried under a list generated from commit subjects.
const unreleased = /^## Unreleased[^\n]*$/m;
const insertionPoint = changelog.indexOf("## ");
const newChangelog = unreleased.test(changelog)
  ? changelog.replace(unreleased, `## ${next} (${date})`)
  : insertionPoint >= 0
    ? changelog.slice(0, insertionPoint) + entry + "\n" + changelog.slice(insertionPoint)
    : changelog + "\n" + entry;

writeFileSync("CHANGELOG.md", newChangelog);

pkg.version = next;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

// The CLI's own manifest, the version it stamps into --version and every
// manifest, and the MCP registry entry all follow the project version.
function setVersion(path: string, pattern: RegExp) {
  const text = readFileSync(path, "utf-8");
  if (!pattern.test(text)) throw new Error(`${path}: no match for ${pattern}`);
  writeFileSync(path, text.replace(pattern, (_match, before: string, after: string) => `${before}${next}${after}`));
}
setVersion("packages/cli/package.json", /("version":\s*")[^"]+(")/);
setVersion("packages/cli/src/version.ts", /(REFRACT_VERSION = ")[^"]+(")/);
setVersion("server.json", /("version":\s*")[^"]+(",\s*"website")/);
setVersion("server.json", /("identifier":\s*"@refract-org\/cli",\s*"version":\s*")[^"]+(")/);
setVersion(".well-known/mcp/server-card.json", /("version":\s*")[^"]+(")/);

// Offline checks only: the registry comparison runs in publish.yml, at the point
// where npm's state is what matters.
await $`bun scripts/check-release.ts`;

const tag = `v${next}`;
await $`git add package.json CHANGELOG.md packages/cli/package.json packages/cli/src/version.ts server.json .well-known/mcp/server-card.json`;
await $`git commit -m "chore: release ${tag}"`;
await $`git tag ${tag}`;

console.log(`\nReleased ${tag}. Push with:`);
console.log(`  git push origin main --tags`);
console.log(`\nPublish and GitHub release workflows will trigger on tag push.`);
