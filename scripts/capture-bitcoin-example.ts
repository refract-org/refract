import { readFileSync, writeFileSync } from "node:fs";
import { annotateEvents, buildRevisionEvents } from "@refract-org/analyzers";
import type { Revision } from "@refract-org/evidence-graph";
import { createEventIdentity } from "@refract-org/evidence-graph";
import { MediaWikiClient } from "@refract-org/ingestion";

const inputsPath = new URL("../docs/examples/bitcoin-revisions.json", import.meta.url);
const outputPath = new URL("../docs/examples/bitcoin-events.ndjson", import.meta.url);
type Pair = { from: number; to: number; revisions: Revision[] };
let pairs: Pair[];

if (process.argv.includes("--refresh")) {
  const client = new MediaWikiClient();
  pairs = [];
  for (const [from, to] of [[345930425, 350653695], [369361755, 369393212]]) {
    const revisions = await client.fetchRevisions("Bitcoin", { direction: "newer", startRevId: from, endRevId: to });
    if (revisions.length !== 2) throw new Error(`Expected two adjacent revisions for ${from} → ${to}`);
    pairs.push({ from, to, revisions: revisions.map(({ user: _user, ...revision }) => revision) });
  }
  writeFileSync(inputsPath, JSON.stringify(pairs, null, 2) + "\n");
} else {
  pairs = JSON.parse(readFileSync(inputsPath, "utf8"));
}

// Each pair is analyzed separately so no transition is invented across the gap.
const events = pairs.flatMap((pair) => annotateEvents(buildRevisionEvents(pair.revisions, { depth: "detailed" })));
const selected = events.filter((event) =>
  (event.eventType === "sentence_modified" && event.before.startsWith("The longest proof-of-work chain")) ||
  (event.eventType === "citation_removed" && event.before.includes("Bitcoin FAQ")),
);
if (selected.length !== 2) throw new Error("The pinned inputs no longer produce the two documented observations");
for (const event of selected) event.eventId = createEventIdentity(event);
const content = selected.map((event) => JSON.stringify(event)).join("\n") + "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(outputPath, "utf8") !== content) throw new Error("Stale example: bitcoin-events.ndjson");
} else {
  writeFileSync(outputPath, content);
}
console.log(`${process.argv.includes("--check") ? "Checked" : "Captured"} two Bitcoin observations from pinned revision pairs.`);
