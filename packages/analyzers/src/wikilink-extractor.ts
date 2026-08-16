import type { DeterministicFact, EvidenceEvent } from "@refract-org/evidence-graph";

const WIKILINK_REGEX = /\[\[([^\]]+?)(?:\|([^\]]*))?\]\]/g;

const EXCLUDED_PREFIXES = [
  "File:",
  "Image:",
  "Category:",
  "wikipedia:",
  "w:",
  "mediawiki:",
  "mw:",
  "wiktionary:",
  "wikt:",
  "commons:",
  "c:",
  "d:",
  "n:",
  "q:",
  "s:",
  "v:",
  "voy:",
  "b:",
];

/** Extract all unique internal wikilinks from wikitext, excluding file/category namespaces. */
export function extractWikilinks(wikitext: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex loop pattern
  while ((match = WIKILINK_REGEX.exec(wikitext)) !== null) {
    const target = match[1].trim();

    const isExcluded = EXCLUDED_PREFIXES.some((prefix) => target.toLowerCase().startsWith(prefix.toLowerCase()));
    if (isExcluded) continue;

    const normalized = target.toLowerCase().replace(/_/g, " ");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    links.push(normalized);
  }

  return links;
}

/** Diff two wikilink lists, returning added and removed links. */
export function diffWikilinks(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);

  return {
    added: after.filter((w) => !beforeSet.has(w)),
    removed: before.filter((w) => !afterSet.has(w)),
  };
}

/** Build evidence events for wikilink additions and removals between revisions. */
export function buildWikilinkEvents(
  beforeWikitext: string,
  afterWikitext: string,
  fromRevId: number,
  toRevId: number,
  section: string,
  timestamp: string,
  extraFacts?: DeterministicFact[],
): EvidenceEvent[] {
  const events: EvidenceEvent[] = [];
  const before = extractWikilinks(beforeWikitext);
  const after = extractWikilinks(afterWikitext);
  const { added, removed } = diffWikilinks(before, after);

  for (const link of added) {
    events.push({
      eventType: "wikilink_added",
      fromRevisionId: fromRevId,
      toRevisionId: toRevId,
      section,
      before: "",
      after: link,
      deterministicFacts: [{ fact: "wikilink_added", detail: `target=${link}` }, ...(extraFacts ?? [])],
      layer: "observed",
      timestamp,
    });
  }

  for (const link of removed) {
    events.push({
      eventType: "wikilink_removed",
      fromRevisionId: fromRevId,
      toRevisionId: toRevId,
      section,
      before: link,
      after: "",
      deterministicFacts: [{ fact: "wikilink_removed", detail: `target=${link}` }, ...(extraFacts ?? [])],
      layer: "observed",
      timestamp,
    });
  }

  return events;
}
