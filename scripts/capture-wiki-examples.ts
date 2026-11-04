import { readFileSync, writeFileSync } from "node:fs";
import { annotateEvents, buildRevisionEvents } from "@refract-org/analyzers";
import type { EvidenceEvent, Revision } from "@refract-org/evidence-graph";
import { createEventIdentity } from "@refract-org/evidence-graph";
import { MediaWikiClient } from "@refract-org/ingestion";

type Pair = { from: number; to: number; revisions: Revision[] };
type Example = {
  page: string;
  slug: string;
  pairs: [number, number][];
  /** Applied on --refresh, before inputs are saved. */
  prepare: (revision: Revision) => Revision;
  /** Each selector must match exactly one event; their order sets the output order. */
  selectors: ((event: EvidenceEvent) => boolean)[];
  /** Wording that README.md quotes from the selected events. */
  quoted?: string[];
};

const withoutEditor = ({ user: _user, ...revision }: Revision): Revision => revision;

// Pluto's revisions are about 48 KB each and this example only reports the lead,
// so the saved inputs stop at the first section heading. Edit summaries are
// dropped because some of that day's name an editor's IP address.
const leadOnly = ({ user: _user, comment: _comment, ...revision }: Revision): Revision => ({
  ...revision,
  content: revision.content.split(/\n==/)[0],
});

const leadSentence = (to: number, wording: string) => (event: EvidenceEvent) =>
  event.toRevisionId === to &&
  event.section === "(lead)" &&
  (event.eventType === "sentence_modified" || event.eventType === "sentence_first_seen") &&
  event.after.includes(wording);

const plutoStart = "Pluto is the ninth and smallest of the traditional planets of the Solar system, though its status as a planet has been disputed";
const plutoRows: [number, number, string][] = [
  [71593043, 71593165, "Pluto is the ninth and smallest of the traditional planets of the Solar system, but on August 24, 2006 it was 'demoted'"],
  [71593165, 71593296, "Pluto was until recently considered the ninth"],
  [71595813, 71595967, "Pluto is considered the ninth and smallest of the traditional planets of the Solar system, except by the IAU"],
  [71597389, 71597482, "Pluto is widely considered the ninth"],
  [71597482, 71597671, "Pluto was considered the ninth"],
  [71599033, 71599252, "Pluto at one time was considered the ninth"],
  [71601076, 71601937, "Pluto was considered the ninth and smallest of the planets of the Solar system"],
];

const examples: Example[] = [
  {
    page: "Bitcoin",
    slug: "bitcoin",
    pairs: [[345930425, 350653695], [369361755, 369393212]],
    prepare: withoutEditor,
    selectors: [
      (event) => event.eventType === "sentence_modified" && event.before.startsWith("The longest proof-of-work chain"),
      (event) => event.eventType === "citation_removed" && event.before.includes("Bitcoin FAQ"),
    ],
  },
  {
    page: "Pluto",
    slug: "pluto",
    pairs: plutoRows.map(([from, to]) => [from, to]),
    prepare: leadOnly,
    selectors: [
      (event) =>
        event.eventType === "sentence_removed" &&
        event.toRevisionId === plutoRows[0][1] &&
        event.before.includes(plutoStart),
      ...plutoRows.map(([, to, wording]) => leadSentence(to, wording)),
    ],
    quoted: [plutoStart, ...plutoRows.map(([, , wording]) => wording)],
  },
];

const checking = process.argv.includes("--check");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8").replaceAll("**", "");

for (const example of examples) {
  const inputsPath = new URL(`../docs/examples/${example.slug}-revisions.json`, import.meta.url);
  const outputPath = new URL(`../docs/examples/${example.slug}-events.ndjson`, import.meta.url);
  let pairs: Pair[];

  if (process.argv.includes("--refresh")) {
    const client = new MediaWikiClient();
    pairs = [];
    for (const [from, to] of example.pairs) {
      const revisions = await client.fetchRevisions(example.page, { direction: "newer", startRevId: from, endRevId: to });
      if (revisions.length !== 2) throw new Error(`Expected two adjacent revisions for ${from} → ${to}`);
      pairs.push({ from, to, revisions: revisions.map(example.prepare) });
    }
    writeFileSync(inputsPath, JSON.stringify(pairs, null, 2) + "\n");
  } else {
    pairs = JSON.parse(readFileSync(inputsPath, "utf8"));
  }

  // Each pair is analyzed separately so no transition is invented across the gap.
  const events = pairs.flatMap((pair) => annotateEvents(buildRevisionEvents(pair.revisions, { depth: "detailed" })));
  const selected = example.selectors.map((selector) => {
    const matches = events.filter(selector);
    if (matches.length !== 1) {
      throw new Error(`The pinned ${example.page} inputs no longer produce the documented observations`);
    }
    return matches[0];
  });
  for (const event of selected) event.eventId = createEventIdentity(event);
  const content = selected.map((event) => JSON.stringify(event)).join("\n") + "\n";

  for (const wording of example.quoted ?? []) {
    if (!readme.includes(wording)) throw new Error(`README.md no longer quotes: ${wording}`);
  }
  if (checking) {
    if (readFileSync(outputPath, "utf8") !== content) throw new Error(`Stale example: ${example.slug}-events.ndjson`);
  } else {
    writeFileSync(outputPath, content);
  }
  console.log(`${checking ? "Checked" : "Captured"} ${selected.length} ${example.page} observations from pinned revision pairs.`);
}
