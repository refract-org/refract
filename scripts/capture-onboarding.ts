import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { EvidenceEvent } from "@refract-org/evidence-graph";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = fileURLToPath(new URL("../packages/cli/dist/src/cli.js", import.meta.url));
const outputDir = new URL("../docs/examples/", import.meta.url);
const transcript = execFileSync("node", [cli, "init"], { cwd: root, encoding: "utf8" });
const ndjson = execFileSync("node", [cli, "init", "--json"], { cwd: root, encoding: "utf8" });
const events: EvidenceEvent[] = ndjson.trim().split("\n").map((line) => JSON.parse(line));
const removals = events.filter((event) => event.eventType === "citation_removed");
if (removals.length !== 1 || !events.some((event) => event.eventType === "sentence_reintroduced")) {
  throw new Error("The sample no longer demonstrates a removed reference and returned text");
}
const changed = events.find((event) => event.eventType === "sentence_modified");
const returned = events.find((event) => event.eventType === "sentence_reintroduced");
const reference = removals[0].before.match(/https:\/\/[^|\s}]+/)?.[0];
if (!changed || !returned || !reference) throw new Error("The sample is missing the wording or reference for its diagram");
const rows = [
  { event: changed, title: "Wording changed", lines: [`Before: ${changed.before}`, `After:  ${changed.after}`] },
  { event: removals[0], title: "Reference removed", lines: [reference, "The observation records removal; your application decides what it means."] },
  { event: returned, title: "Text returned", lines: [returned.after, "Previously observed wording is present again in the sample history."] },
];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 530" role="img" aria-labelledby="title desc">
  <title id="title">A fictional library history made visible</title>
  <desc id="desc">A sentence changes from six to eight, a reference disappears, and text about free printing returns. These are computed observations from five fictional revisions.</desc>
  <rect width="960" height="530" rx="12" fill="#f8fafc"/>
  <g font-family="system-ui, sans-serif" fill="#0f172a">
    <text x="32" y="42" font-size="24" font-weight="700">What a history lets you see</text>
    <text x="32" y="70" font-size="15" fill="#475569">Rivergate Library · fictional offline sample · computed by Refract's analyzers</text>
    ${rows.map((row, i) => {
      const y = 96 + i * 130;
      const lines = row.lines.map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
      return `<rect x="24" y="${y}" width="912" height="114" rx="8" fill="#fff" stroke="#cbd5e1"/>
      <text x="44" y="${y + 28}" font-size="17" font-weight="600">${row.title}</text>
      <text x="914" y="${y + 28}" text-anchor="end" font-size="14" fill="#475569">${row.event.timestamp.slice(0, 10)} · sample ${row.event.fromRevisionId} → ${row.event.toRevisionId}</text>
      <text x="44" y="${y + 60}" font-size="15">${lines[0]}</text>
      <text x="44" y="${y + 87}" font-size="15" fill="#475569">${lines[1]}</text>`;
    }).join("\n")}
    <text x="32" y="514" font-size="14" fill="#475569">Source inputs and complete event data are linked in the offline walkthrough.</text>
  </g>
</svg>\n`;
const artifacts = {
  "onboarding.txt": transcript,
  "sample-events.ndjson": ndjson,
  "review-events.ndjson": removals.map((event) => JSON.stringify(event)).join("\n") + "\n",
  "onboarding.svg": svg,
};

mkdirSync(outputDir, { recursive: true });
for (const [name, content] of Object.entries(artifacts)) {
  const path = new URL(name, outputDir);
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8") !== content) throw new Error(`Stale example: ${name}`);
  } else {
    writeFileSync(path, content);
  }
}
console.log(`${process.argv.includes("--check") ? "Checked" : "Captured"} four offline walkthrough artifacts.`);
