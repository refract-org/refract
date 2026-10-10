import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = fileURLToPath(new URL("../packages/cli/dist/src/cli.js", import.meta.url));
const outputDir = new URL("../docs/examples/", import.meta.url);
const transcript = execFileSync("node", [cli, "init"], { cwd: root, encoding: "utf8" });
const ndjson = execFileSync("node", [cli, "init", "--json"], { cwd: root, encoding: "utf8" });
const events = ndjson.trim().split("\n").map((line) => JSON.parse(line));
const removals = events.filter((event) => event.eventType === "citation_removed");
if (removals.length !== 1 || !events.some((event) => event.eventType === "sentence_reintroduced")) {
  throw new Error("The sample no longer demonstrates a removed reference and returned text");
}
const artifacts = {
  "onboarding.txt": transcript,
  "sample-events.ndjson": ndjson,
  "review-events.ndjson": removals.map((event) => JSON.stringify(event)).join("\n") + "\n",
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
console.log(`${process.argv.includes("--check") ? "Checked" : "Captured"} three offline walkthrough artifacts.`);
