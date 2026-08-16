import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CitationRef, Template, TemplateType } from "@refract-org/analyzers";
import {
  buildParamChangeEvents,
  citationTracker,
  computeCertaintyProfile,
  computeContentChange,
  computeDirectionSignal,
  computeEditMagnitude,
  correlateTalkRevisions,
  diffCategories,
  diffObservations,
  diffWikilinks,
  extractKeyTerms,
  extractQuantitativeFindings,
  revertDetector,
  sectionDiffer,
  templateTracker,
} from "@refract-org/analyzers";
import type { DeterministicFact, EvidenceEvent, EvidenceLayer, Revision, Section } from "@refract-org/evidence-graph";
import { EVENT_SCHEMA_VERSION } from "@refract-org/evidence-graph";
import type { AuthConfig, ProtectionLogEvent, RevisionOptions } from "@refract-org/ingestion";
import { MediaWikiClient } from "@refract-org/ingestion";

import { loadCachedRevisions, loadLatestCachedTimestamp, saveRevisions } from "./cache.js";
import { findSectionForText } from "./claim.js";

export interface ParsedContent {
  sections: Section[];
  citations: CitationRef[];
  wikilinks: string[];
  categories: string[];
  templates: Template[];
}

export interface FetchResult {
  client: MediaWikiClient;
  revisions: Revision[];
}

function templateTypeToPolicyDimension(type: TemplateType): string | null {
  switch (type) {
    case "citation":
      return "verifiability";
    case "neutrality":
      return "npov";
    case "blp":
      return "blp";
    case "dispute":
      return "due_weight";
    case "protection":
      return "protection";
    default:
      return null;
  }
}

function wordOverlapRatio(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

/** Create a MediaWikiClient and fetch revisions with delta-update caching. */
export async function fetchRevisionsWithCache(
  pageTitle: string,
  depth: string,
  fromRevId: number | undefined,
  toRevId: number | undefined,
  fromTimestamp: string | undefined,
  useCache: boolean,
  apiUrl: string | undefined,
  cacheDir: string | undefined,
  auth: AuthConfig | undefined,
  briefRevisionLimit?: number,
): Promise<FetchResult> {
  const client = new MediaWikiClient(apiUrl ? { apiUrl, auth } : auth ? { auth } : undefined);
  console.error(`Analyzing "${pageTitle}" at depth: ${depth}...`);

  let revisions: Revision[] = [];

  if (useCache) {
    const cached = await loadCachedRevisions(pageTitle, 500, cacheDir);
    if (cached.length > 0) {
      console.error(`Loaded ${cached.length} revisions from cache.`);
      revisions = cached;

      const latestTs = await loadLatestCachedTimestamp(pageTitle, cacheDir);
      if (latestTs && !fromTimestamp && revisions.length < 500) {
        const deltaOpts: RevisionOptions = { direction: "newer", start: new Date(latestTs) };
        if (toRevId) deltaOpts.endRevId = toRevId;
        const newRevisions = await client.fetchRevisions(pageTitle, deltaOpts);
        const uniqueNew = newRevisions.filter((r) => !revisions.some((cr) => cr.revId === r.revId));
        if (uniqueNew.length > 0) {
          console.error(`Fetched ${uniqueNew.length} new revisions since ${latestTs}.`);
          revisions = [...revisions, ...uniqueNew];
          await saveRevisions(uniqueNew, cacheDir);
        } else {
          console.error("Cache is up to date.");
        }
      }
    }
  }

  if (revisions.length === 0) {
    console.error(`Fetching revisions from Wikipedia...`);
    const options: RevisionOptions = { direction: "newer" };
    if (fromTimestamp) {
      options.start = new Date(fromTimestamp);
      console.error(`Fetching revisions since ${fromTimestamp}...`);
    } else if (fromRevId) {
      options.startRevId = fromRevId;
    }
    if (toRevId) {
      options.endRevId = toRevId;
    }
    if (depth === "brief" && !fromTimestamp && !fromRevId && !toRevId) {
      options.limit = briefRevisionLimit ?? 20;
    }
    revisions = await client.fetchRevisions(pageTitle, options);
    console.error(`Fetched ${revisions.length} revisions.`);

    if (useCache && revisions.length > 0) {
      await saveRevisions(revisions, cacheDir);
      console.error(`Cached ${revisions.length} revisions.`);
    }
  }

  if (revisions.length < 2) {
    console.error("Need at least 2 revisions to analyze.");
    return { client, revisions: [] };
  }

  const withTs = revisions.map((r) => ({ r, ts: new Date(r.timestamp).getTime() }));
  withTs.sort((a, b) => a.ts - b.ts);
  return { client, revisions: withTs.map((x) => x.r) };
}

/** Diff sections, citations, wikilinks, categories, and lead structure between two revisions. */
export function computeStructuralDiffs(
  before: Revision,
  after: Revision,
  beforeParsed: ParsedContent,
  afterParsed: ParsedContent,
  isBrief: boolean,
  extraFacts: DeterministicFact[],
): EvidenceEvent[] {
  const events: EvidenceEvent[] = [];

  const sectionChanges = sectionDiffer.diffSections(beforeParsed.sections, afterParsed.sections);
  const citationChanges = citationTracker.diffCitations(beforeParsed.citations, afterParsed.citations);
  const wikilinkChanges = diffWikilinks(beforeParsed.wikilinks, afterParsed.wikilinks);
  const categoryChanges = diffCategories(beforeParsed.categories, afterParsed.categories);

  for (const cit of citationChanges) {
    if (cit.type === "unchanged") continue;
    const layer: EvidenceLayer = "observed";
    events.push({
      eventType:
        cit.type === "added" ? "citation_added" : cit.type === "removed" ? "citation_removed" : "citation_replaced",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: "body",
      before: isBrief ? "" : (cit.before?.raw ?? ""),
      after: isBrief ? "" : (cit.after?.raw ?? ""),
      deterministicFacts: [{ fact: "citation_changed", detail: `type=${cit.type}` }, ...extraFacts],
      layer,
      timestamp: after.timestamp,
    });
  }

  for (const link of wikilinkChanges.added) {
    events.push({
      eventType: "wikilink_added",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: "body",
      before: "",
      after: isBrief ? "" : link,
      deterministicFacts: [{ fact: "wikilink_added", detail: `target=${link}` }, ...extraFacts],
      layer: "observed",
      timestamp: after.timestamp,
    });
  }

  for (const link of wikilinkChanges.removed) {
    events.push({
      eventType: "wikilink_removed",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: "body",
      before: isBrief ? "" : link,
      after: "",
      deterministicFacts: [{ fact: "wikilink_removed", detail: `target=${link}` }, ...extraFacts],
      layer: "observed",
      timestamp: after.timestamp,
    });
  }

  for (const cat of categoryChanges.added) {
    events.push({
      eventType: "category_added",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: "",
      before: "",
      after: isBrief ? "" : cat,
      deterministicFacts: [{ fact: "category_added", detail: `category=${cat}` }, ...extraFacts],
      layer: "observed",
      timestamp: after.timestamp,
    });
  }

  for (const cat of categoryChanges.removed) {
    events.push({
      eventType: "category_removed",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: "",
      before: isBrief ? "" : cat,
      after: "",
      deterministicFacts: [{ fact: "category_removed", detail: `category=${cat}` }, ...extraFacts],
      layer: "observed",
      timestamp: after.timestamp,
    });
  }

  for (const sc of sectionChanges) {
    if (sc.changeType === "unchanged") continue;
    events.push({
      eventType: "section_reorganized",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: sc.section,
      before: isBrief ? "" : (sc.fromContent ?? ""),
      after: isBrief ? "" : (sc.toContent ?? ""),
      deterministicFacts: [{ fact: "section_changed", detail: `change=${sc.changeType}` }, ...extraFacts],
      layer: "observed",
      timestamp: after.timestamp,
    });
  }

  const leadChange = sectionChanges.find((sc) => sc.section === "(lead)" && sc.changeType === "modified");
  if (leadChange) {
    const fromLen = leadChange.fromContent?.length ?? 0;
    const toLen = leadChange.toContent?.length ?? 0;
    const contentMovedOut = fromLen > toLen && toLen < fromLen * 0.5;
    const contentMovedIn = toLen > fromLen && fromLen < toLen * 0.5;

    if (contentMovedOut) {
      const targetSection = sectionChanges.find(
        (sc) => sc.section !== "(lead)" && (sc.changeType === "added" || sc.changeType === "modified"),
      );
      if (targetSection) {
        events.push({
          eventType: "lead_demotion",
          fromRevisionId: before.revId,
          toRevisionId: after.revId,
          section: targetSection.section,
          before: isBrief ? "" : (leadChange.fromContent ?? ""),
          after: isBrief ? "" : (leadChange.toContent ?? ""),
          deterministicFacts: [
            { fact: "lead_content_moved", detail: `from=lead to=${targetSection.section}` },
            ...extraFacts,
          ],
          layer: "observed",
          timestamp: after.timestamp,
        });
      }
    } else if (contentMovedIn) {
      const sourceSection = sectionChanges.find(
        (sc) => sc.section !== "(lead)" && (sc.changeType === "removed" || sc.changeType === "modified"),
      );
      if (sourceSection) {
        events.push({
          eventType: "lead_promotion",
          fromRevisionId: before.revId,
          toRevisionId: after.revId,
          section: sourceSection.section,
          before: isBrief ? "" : (leadChange.fromContent ?? ""),
          after: isBrief ? "" : (leadChange.toContent ?? ""),
          deterministicFacts: [
            { fact: "lead_content_moved", detail: `from=${sourceSection.section} to=lead` },
            ...extraFacts,
          ],
          layer: "observed",
          timestamp: after.timestamp,
        });
      }
    }
  }

  return events;
}

/** Detect reverts, template changes, parameter changes, and protection log events. */
export function detectEditorialSignals(
  before: Revision,
  after: Revision,
  beforeParsed: ParsedContent,
  afterParsed: ParsedContent,
  isBrief: boolean,
  extraFacts: DeterministicFact[],
  protectionLogsWithTs: Array<{ l: ProtectionLogEvent; ts: number }>,
): EvidenceEvent[] {
  const events: EvidenceEvent[] = [];

  const templateChanges = templateTracker.diffTemplates(beforeParsed.templates, afterParsed.templates);
  const isRevRevert = revertDetector.isRevert(after.comment);

  for (const tpl of templateChanges) {
    if (tpl.type === "unchanged") continue;

    if (tpl.template.type === "protection") {
      events.push({
        eventType: "protection_changed",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section: "body",
        before: tpl.type === "removed" ? tpl.template.name : "",
        after: tpl.type === "added" ? tpl.template.name : "",
        deterministicFacts: [
          { fact: "protection_changed", detail: `name=${tpl.template.name} type=${tpl.type}` },
          ...extraFacts,
        ],
        layer: "policy_coded",
        timestamp: after.timestamp,
      });
      continue;
    }

    const policyDimension = templateTypeToPolicyDimension(tpl.template.type);
    const layer: EvidenceLayer = policyDimension ? "policy_coded" : "observed";
    events.push({
      eventType: tpl.type === "added" ? "template_added" : "template_removed",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: "body",
      before: "",
      after: isBrief ? "" : tpl.template.name,
      deterministicFacts: [
        { fact: "template_changed", detail: `name=${tpl.template.name} type=${tpl.type}` },
        ...(policyDimension
          ? [
              {
                fact: "policy_signal",
                detail: `dimension=${policyDimension} signal=${tpl.template.name.toLowerCase().replace(/\s+/g, "_")}`,
              },
            ]
          : []),
        ...extraFacts,
      ],
      layer,
      timestamp: after.timestamp,
    });
  }

  const paramChangeEvents = buildParamChangeEvents(
    beforeParsed.templates,
    afterParsed.templates,
    before.revId,
    after.revId,
    after.timestamp,
  );
  events.push(...paramChangeEvents);

  if (isRevRevert) {
    events.push({
      eventType: "revert_detected",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: "",
      before: "",
      after: isBrief ? "" : after.comment,
      deterministicFacts: [
        { fact: "revert_detected", detail: after.comment },
        { fact: "policy_signal", detail: "dimension=edit_warring signal=revert_detected" },
        ...extraFacts,
      ],
      layer: "policy_coded",
      timestamp: after.timestamp,
    });
  }

  const fromTs = new Date(before.timestamp).getTime();
  const toTs = new Date(after.timestamp).getTime();
  const protectionLogsInRange = protectionLogsWithTs.filter(({ ts }) => ts > fromTs && ts <= toTs).map(({ l }) => l);
  for (const log of protectionLogsInRange) {
    events.push({
      eventType: "protection_changed",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section: "",
      before: "",
      after: log.action,
      deterministicFacts: [
        { fact: "protection_log_event", detail: `action=${log.action} logId=${log.logId}` },
        ...(log.comment ? [{ fact: "protection_summary", detail: log.comment }] : []),
        ...extraFacts,
      ],
      layer: "policy_coded",
      timestamp: log.timestamp,
    });
  }

  return events;
}

/** Compute sentence-level diffs between two revisions (additions, removals, modifications). */
export function diffSentences(
  before: Revision,
  after: Revision,
  getStripped: (rev: Revision) => string,
  getSectionCharMap: (rev: Revision) => Array<{ charOffset: number; section: string }>,
  allSeenSentences: Set<string>,
  similarityThreshold: number,
  isBrief: boolean,
  extraFacts: DeterministicFact[],
): EvidenceEvent[] {
  const events: EvidenceEvent[] = [];

  const beforePlain = getStripped(before);
  const afterPlain = getStripped(after);

  const sentenceSplit = /(?:[.!?]\s+|[。！？؟]\s*)/;
  const beforeSentences = beforePlain.split(sentenceSplit).filter((s) => s.trim().length > 20);
  const afterSentences = afterPlain.split(sentenceSplit).filter((s) => s.trim().length > 20);

  const beforeSecMap = getSectionCharMap(before);
  const afterSecMap = getSectionCharMap(after);

  const matchedBeforeIndices = new Set<number>();

  for (const sentence of afterSentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    let bestMatchIdx = -1;
    let bestRatio = 0;
    let bestBeforeSentence = "";

    for (let i = 0; i < beforeSentences.length; i++) {
      if (matchedBeforeIndices.has(i)) continue;
      const beforeTrimmed = beforeSentences[i].trim();
      if (!beforeTrimmed) continue;
      const ratio = wordOverlapRatio(beforeTrimmed, trimmed);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestMatchIdx = i;
        bestBeforeSentence = beforeTrimmed;
      }
    }

    if (bestMatchIdx >= 0 && bestRatio >= similarityThreshold) {
      matchedBeforeIndices.add(bestMatchIdx);
      if (bestBeforeSentence.toLowerCase().replace(/\s+/g, " ") !== trimmed.toLowerCase().replace(/\s+/g, " ")) {
        const section = findSectionForText(after.content, trimmed, afterPlain, afterSecMap);
        events.push({
          eventType: "sentence_modified",
          fromRevisionId: before.revId,
          toRevisionId: after.revId,
          section,
          before: isBrief ? "" : bestBeforeSentence,
          after: isBrief ? "" : trimmed,
          deterministicFacts: [
            { fact: "sentence_modified", detail: `sentence_length=${trimmed.length}` },
            ...extraFacts,
          ],
          layer: "observed",
          timestamp: after.timestamp,
        });
      }
    } else {
      const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
      const wasSeenBefore = allSeenSentences.has(normalized);
      const section = findSectionForText(after.content, trimmed, afterPlain, afterSecMap);
      events.push({
        eventType: wasSeenBefore ? "sentence_reintroduced" : "sentence_first_seen",
        fromRevisionId: before.revId,
        toRevisionId: after.revId,
        section,
        before: "",
        after: isBrief ? "" : trimmed,
        deterministicFacts: [{ fact: "claim_detected", detail: `sentence_length=${trimmed.length}` }, ...extraFacts],
        layer: "observed",
        timestamp: after.timestamp,
      });
    }
  }

  for (let i = 0; i < beforeSentences.length; i++) {
    if (matchedBeforeIndices.has(i)) continue;
    const trimmed = beforeSentences[i].trim();
    if (!trimmed) continue;
    const section = findSectionForText(before.content, trimmed, beforePlain, beforeSecMap);
    events.push({
      eventType: "sentence_removed",
      fromRevisionId: before.revId,
      toRevisionId: after.revId,
      section,
      before: isBrief ? "" : trimmed,
      after: "",
      deterministicFacts: [{ fact: "sentence_removed", detail: `sentence_length=${trimmed.length}` }, ...extraFacts],
      layer: "observed",
      timestamp: after.timestamp,
    });
  }

  for (const s of afterSentences) {
    const normalized = s.trim().toLowerCase().replace(/\s+/g, " ");
    if (normalized) allSeenSentences.add(normalized);
  }

  return events;
}

/** Correlate talk page revisions with article revisions. */
export function correlateTalkPages(sortedRevs: Revision[], talkRevs: Revision[]): EvidenceEvent[] {
  if (talkRevs.length === 0) return [];

  const talkEvents = correlateTalkRevisions(sortedRevs, talkRevs);
  if (talkEvents.length > 0) {
    console.error(`Correlated ${talkEvents.length} talk page discussions.`);
  }
  return talkEvents;
}

/** Observation diffing, schema version stamping, and semantic enrichment. */
export function finalizeEvents(
  pageTitle: string,
  events: EvidenceEvent[],
  _sortedRevs: Revision[],
  fromTimestamp: string | undefined,
  cacheDir: string | undefined,
): EvidenceEvent[] {
  if (fromTimestamp) {
    const obsDir = cacheDir ?? join(homedir(), ".wikihistory", "observations");
    if (!existsSync(obsDir)) mkdirSync(obsDir, { recursive: true });
    const obsFile = join(obsDir, `${pageTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);

    let priorEvents: EvidenceEvent[] = [];
    try {
      const raw = readFileSync(obsFile, "utf-8");
      priorEvents = JSON.parse(raw) as EvidenceEvent[];
    } catch (err) {
      console.error("refract: analyze: failed to read prior observation file", err);
    }

    const obsDiff = diffObservations(priorEvents, events);
    if (priorEvents.length > 0) {
      console.error(`\n── Re-observation delta ──`);
      console.error(`  New events:      ${obsDiff.new.length}`);
      console.error(`  Resolved events: ${obsDiff.resolved.length}`);
      console.error(`  Unchanged:       ${obsDiff.unchanged.length}`);
    } else {
      console.error(`First observation — no delta available.`);
    }

    writeFileSync(obsFile, JSON.stringify(events, null, 2), "utf-8");
  }

  for (const e of events) {
    (e as unknown as Record<string, unknown>).schemaVersion = EVENT_SCHEMA_VERSION;
  }

  for (const event of events) {
    const text = event.after || event.before || "";
    event.editMagnitude = computeEditMagnitude((event.before || "").length, (event.after || "").length);
    event.contentChange = computeContentChange(event.eventType, event.before || "", event.after || "");
    event.keyTerms = extractKeyTerms(text);
    event.certaintyProfile = computeCertaintyProfile(text);
    event.directionSignal = computeDirectionSignal(
      computeCertaintyProfile(event.before || ""),
      computeCertaintyProfile(event.after || ""),
    );
    event.quantitativeFindings = extractQuantitativeFindings(text);
  }

  return events;
}
