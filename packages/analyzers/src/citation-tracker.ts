import { createHash } from "node:crypto";
import type { SourceAuthority, SourceLineage, SourceRecord, SourceType } from "@refract-org/evidence-graph";
import type { CitationChange, CitationRef, CitationTracker } from "./index.js";

export const citationTracker: CitationTracker = {
  extractCitations(wikitext: string): CitationRef[] {
    const refs: CitationRef[] = [];
    const seen = new Set<string>();

    const refRegex = /<ref\b([^>]*?)>(.*?)<\/ref\s*>/gs;
    let match: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex loop pattern
    while ((match = refRegex.exec(wikitext)) !== null) {
      const attrs = match[1];
      const content = match[2].trim();

      const nameMatch = attrs.match(/name\s*=\s*["']?([^"'\s>]+)/i);
      const urlMatch = content.match(/url\s*=\s*([^\s|}\]]+)/i);
      const titleMatch = content.match(/title\s*=\s*([^|}\]]+?)(?:\s*[|}\]])/i);

      const raw = match[0];
      const key = nameMatch ? nameMatch[1] : raw;

      if (seen.has(key)) continue;
      seen.add(key);

      refs.push({
        refName: nameMatch?.[1],
        url: urlMatch ? urlMatch[1].trim() : undefined,
        title: titleMatch ? titleMatch[1].trim() : undefined,
        raw,
      });
    }

    const selfClosingRegex = /<ref\b([^>]*?)\/\s*>/g;
    // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex loop pattern
    while ((match = selfClosingRegex.exec(wikitext)) !== null) {
      const attrs = match[1];
      const nameMatch = attrs.match(/name\s*=\s*["']?([^"'\s>]+)/i);
      if (!nameMatch) continue;

      const key = nameMatch[1];
      if (seen.has(key)) continue;
      seen.add(key);

      refs.push({
        refName: key,
        raw: match[0],
      });
    }

    return refs;
  },

  /** Diff two citation lists, returning added/removed/replaced/unchanged changes. */
  diffCitations(before: CitationRef[], after: CitationRef[]): CitationChange[] {
    const changes: CitationChange[] = [];
    const beforeMap = indexByKey(before);
    const afterMap = indexByKey(after);

    for (const [key, afterRef] of afterMap) {
      const beforeRef = beforeMap.get(key);
      if (!beforeRef) {
        changes.push({ type: "added", after: afterRef });
      } else if (beforeRef.raw !== afterRef.raw) {
        changes.push({ type: "replaced", before: beforeRef, after: afterRef });
      } else {
        changes.push({ type: "unchanged", after: afterRef });
      }
    }

    for (const [key, beforeRef] of beforeMap) {
      if (!afterMap.has(key)) {
        changes.push({ type: "removed", before: beforeRef });
      }
    }

    return changes;
  },
};

function indexByKey(refs: CitationRef[]): Map<string, CitationRef> {
  const map = new Map<string, CitationRef>();
  for (const ref of refs) {
    const key = ref.refName ?? ref.raw;
    map.set(key, ref);
  }
  return map;
}

export function buildSourceLineage(revisions: { revId: number; timestamp: string; content: string }[]): {
  sources: SourceRecord[];
  lineage: SourceLineage[];
} {
  const sourceMap = new Map<string, SourceRecord>();
  const replacementMap = new Map<string, { replacedById: string; atRevisionId: number; atTimestamp: string }[]>();

  function ensureSource(ref: CitationRef, seenAtRevId: number, seenAtTimestamp: string): string {
    const sourceId = buildSourceId(ref);
    if (!sourceMap.has(sourceId)) {
      sourceMap.set(sourceId, {
        sourceId,
        url: ref.url,
        title: ref.title,
        sourceType: classifySourceType(ref),
        authority: classifyAuthority(ref),
        firstSeenRevisionId: seenAtRevId,
        firstSeenAt: seenAtTimestamp,
        claimsReferencing: [],
      });
    }
    return sourceId;
  }

  const allCitations = revisions.map((r) => citationTracker.extractCitations(r.content));

  // Seed sources from the first revision
  if (revisions.length > 0) {
    for (const ref of allCitations[0]) {
      ensureSource(ref, revisions[0].revId, revisions[0].timestamp);
    }
  }

  for (let i = 0; i < revisions.length - 1; i++) {
    const before = revisions[i];
    const after = revisions[i + 1];

    const beforeRefs = allCitations[i];
    const afterRefs = allCitations[i + 1];
    const changes = citationTracker.diffCitations(beforeRefs, afterRefs);

    for (const change of changes) {
      if (change.after) {
        const id = ensureSource(change.after, after.revId, after.timestamp);
        if (change.type === "replaced" && change.before) {
          const oldId = ensureSource(change.before, after.revId, after.timestamp);
          const replacements = replacementMap.get(oldId) ?? [];
          replacements.push({
            replacedById: id,
            atRevisionId: after.revId,
            atTimestamp: after.timestamp,
          });
          replacementMap.set(oldId, replacements);
        }
      }

      if ((change.type === "removed" || change.type === "replaced") && change.before) {
        const sourceId = ensureSource(change.before, before.revId, before.timestamp);
        const record = sourceMap.get(sourceId);
        if (record) {
          record.lastSeenRevisionId = before.revId;
          record.lastSeenAt = before.timestamp;
        }
      }
    }
  }

  const sources = Array.from(sourceMap.values());
  const lineage: SourceLineage[] = [];
  for (const [sourceId, replacements] of replacementMap) {
    lineage.push({ sourceId, replacements });
  }

  return { sources, lineage };
}

export function buildSourceId(ref: CitationRef): string {
  if (ref.url) {
    return createHash("sha256").update(ref.url).digest("hex").slice(0, 16);
  }
  if (ref.refName) {
    return createHash("sha256").update(`ref:${ref.refName}`).digest("hex").slice(0, 16);
  }
  return createHash("sha256").update(ref.raw).digest("hex").slice(0, 16);
}

const NEWS_DOMAINS = [
  "cnn.com",
  "nytimes.com",
  "bbc.com",
  "reuters.com",
  "apnews.com",
  "washingtonpost.com",
  "wsj.com",
  "theguardian.com",
  "bloomberg.com",
  "npr.org",
  "thehill.com",
  "politico.com",
  "foxnews.com",
  "nbcnews.com",
  "cbsnews.com",
  "abcnews.net",
  "usatoday.com",
  "latimes.com",
  "chicagotribune.com",
  "huffpost.com",
  "buzzfeednews.com",
];

function classifySourceType(ref: CitationRef): SourceType {
  const url = ref.url?.toLowerCase() ?? "";
  if (!url) return "unknown";

  if (url.includes("doi.org") || /journal|jstor|springer|sciencedirect/i.test(url)) {
    return "academic";
  }
  if (url.includes(".gov")) return "government";
  if (url.includes(".edu")) return "secondary";
  if (NEWS_DOMAINS.some((d) => url.includes(d))) return "news";

  return "unknown";
}

function classifyAuthority(ref: CitationRef): SourceAuthority {
  const url = ref.url?.toLowerCase() ?? "";
  if (!url) return "unrated";

  if (url.includes("doi.org") || /journal|jstor|springer/i.test(url)) {
    return "medium";
  }
  if (/\.(edu|gov|org)\b/.test(url)) return "high";
  if (/\.(com|net)\b/.test(url)) return "medium";

  return "unrated";
}
