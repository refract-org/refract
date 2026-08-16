import type { DeterministicFact, EvidenceEvent } from "@refract-org/evidence-graph";

const CATEGORY_REGEX = /\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi;

/** Extract all unique category names from wikitext. */
export function extractCategories(wikitext: string): string[] {
  const categories: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex loop pattern
  while ((match = CATEGORY_REGEX.exec(wikitext)) !== null) {
    const name = match[1].trim();
    if (!name) continue;
    const normalized = name.toLowerCase().replace(/_/g, " ");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    categories.push(normalized);
  }

  return categories;
}

/** Diff two category lists, returning added and removed categories. */
export function diffCategories(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);

  return {
    added: after.filter((c) => !beforeSet.has(c)),
    removed: before.filter((c) => !afterSet.has(c)),
  };
}

/** Build evidence events for category additions and removals between revisions. */
export function buildCategoryEvents(
  beforeWikitext: string,
  afterWikitext: string,
  fromRevId: number,
  toRevId: number,
  timestamp: string,
  extraFacts?: DeterministicFact[],
): EvidenceEvent[] {
  const events: EvidenceEvent[] = [];
  const before = extractCategories(beforeWikitext);
  const after = extractCategories(afterWikitext);
  const { added, removed } = diffCategories(before, after);

  for (const cat of added) {
    events.push({
      eventType: "category_added",
      fromRevisionId: fromRevId,
      toRevisionId: toRevId,
      section: "",
      before: "",
      after: cat,
      deterministicFacts: [{ fact: "category_added", detail: `category=${cat}` }, ...(extraFacts ?? [])],
      layer: "observed",
      timestamp,
    });
  }

  for (const cat of removed) {
    events.push({
      eventType: "category_removed",
      fromRevisionId: fromRevId,
      toRevisionId: toRevId,
      section: "",
      before: cat,
      after: "",
      deterministicFacts: [{ fact: "category_removed", detail: `category=${cat}` }, ...(extraFacts ?? [])],
      layer: "observed",
      timestamp,
    });
  }

  return events;
}
