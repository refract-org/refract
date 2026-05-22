import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CitationRef, Template, TemplateType } from "@refract-org/analyzers";
import {
  buildPageMoveEvents,
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
  extractCategories,
  extractKeyTerms,
  extractQuantitativeFindings,
  extractWikilinks,
  revertDetector,
  sectionDiffer,
  stripWikitext,
  templateTracker,
} from "@refract-org/analyzers";
import type {
  AnalyzerConfig,
  ClaimLedger,
  ClaimLedgerEntry,
  ClaimState,
  DeterministicFact,
  EvidenceEvent,
  EvidenceLayer,
  ObservationReport,
  Revision,
  Section,
} from "@refract-org/evidence-graph";
import {
  createClaimIdentity,
  createEventIdentity,
  createReplayManifest,
  DEFAULT_ANALYZER_CONFIG,
  EVENT_SCHEMA_VERSION,
} from "@refract-org/evidence-graph";
import type { AuthConfig, RevisionOptions } from "@refract-org/ingestion";
import { MediaWikiClient } from "@refract-org/ingestion";

import { loadCachedRevisions, loadLatestCachedTimestamp, saveRevisions } from "./cache.js";
import { buildSectionCharMap, findSectionForText } from "./claim.js";

interface ParsedContent {
  sections: Section[];
  citations: CitationRef[];
  wikilinks: string[];
  categories: string[];
  templates: Template[];
}

interface BatchPageResult {
  pageTitle: string;
  pageId: number;
  eventCount: number;
  events: EvidenceEvent[];
}

interface BatchResult {
  mode: "batch";
  batchSize: number;
  pages: BatchPageResult[];
  totalEvents: number;
  generatedAt: string;
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

function toCamelCase(str: string): string {
  return str.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase());
}

function deepCamelCaseKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepCamelCaseKeys);
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[toCamelCase(key)] = deepCamelCaseKeys(value);
    }
    return result;
  }
  return obj;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!(key in target) || target[key] === undefined || typeof target[key] !== "object") {
        target[key] = {};
      }
      deepMerge(target[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
}

function compilePatterns(config: AnalyzerConfig): void {
  if (config.revert?.patterns) {
    config.revert.patterns = config.revert.patterns.map((p) => (typeof p === "string" ? new RegExp(p) : p));
  }
  if (config.talkParser?.resolvedPatterns) {
    config.talkParser.resolvedPatterns = config.talkParser.resolvedPatterns.map((p) =>
      typeof p === "string" ? new RegExp(p) : p,
    );
  }
  if (config.heuristic?.vandalismPatterns) {
    config.heuristic.vandalismPatterns = config.heuristic.vandalismPatterns.map((p) =>
      typeof p === "string" ? new RegExp(p) : p,
    );
  }
  if (config.heuristic?.sourcingPatterns) {
    config.heuristic.sourcingPatterns = config.heuristic.sourcingPatterns.map((p) =>
      typeof p === "string" ? new RegExp(p) : p,
    );
  }
}

/** Current Refract CLI version — single source of truth for output metadata. */
const REFRACT_VERSION = "0.5.6";

export function buildConfig(options: Record<string, unknown>): AnalyzerConfig {
  const config: AnalyzerConfig = structuredClone(DEFAULT_ANALYZER_CONFIG);

  if (options.config) {
    const content = readFileSync(options.config as string, "utf-8");
    const fileOverrides = JSON.parse(content);
    const camelCased = deepCamelCaseKeys(fileOverrides) as Record<string, unknown>;
    deepMerge(config as unknown as Record<string, unknown>, camelCased);
    compilePatterns(config);
  }

  if (options.similarity !== undefined) {
    config.section ??= {};
    config.section.similarityThreshold = Number(options.similarity);
  }

  if (options.revertPatterns) {
    const content = readFileSync(options.revertPatterns as string, "utf-8");
    config.revert ??= {};
    config.revert.patterns = content
      .split("\n")
      .filter(Boolean)
      .map((line) => new RegExp(line.trim()));
  }

  if (options.clusterWindow !== undefined) {
    config.editCluster ??= {};
    config.editCluster.windowMs = Number(options.clusterWindow) * 60 * 1000;
  }

  if (options.spikeFactor !== undefined) {
    config.talkSpike ??= {};
    config.talkSpike.spikeFactor = Number(options.spikeFactor);
  }

  if (options.talkWindow) {
    const parts = (options.talkWindow as string).split("/");
    if (parts.length === 2) {
      const beforeDays = Number(parts[0]);
      const afterDays = Number(parts[1]);
      config.talkCorrelation ??= {};
      config.talkCorrelation.windowBeforeMs = beforeDays * 24 * 60 * 60 * 1000;
      config.talkCorrelation.windowAfterMs = afterDays * 24 * 60 * 60 * 1000;
    }
  }

  if (options.sectionRename) {
    const mode = options.sectionRename as string;
    if (["exact", "similarity", "none"].includes(mode)) {
      config.section ??= {};
      config.section.renameDetection = mode as "exact" | "similarity" | "none";
    }
  }

  // Pin config version from the package version for traceability
  config.$version = REFRACT_VERSION;

  return config;
}

export async function runAnalyze(
  pageTitle: string,
  depth: string,
  fromRevId?: number,
  toRevId?: number,
  fromTimestamp?: string,
  useCache = false,
  apiUrl?: string,
  pagesFile?: string,
  cacheDir?: string,
  auth?: AuthConfig,
  config?: AnalyzerConfig,
): Promise<{ events: EvidenceEvent[]; revisions: Revision[] }> {
  if (pagesFile) {
    return runBatch(pagesFile, depth, fromRevId, toRevId, fromTimestamp, useCache, apiUrl, cacheDir, auth, config);
  }
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
    if (!fromTimestamp && !fromRevId && !toRevId) {
      options.limit = 20;
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
    return { events: [], revisions: [] };
  }

  const events: EvidenceEvent[] = [];
  const withTs = revisions.map((r) => ({ r, ts: new Date(r.timestamp).getTime() }));
  withTs.sort((a, b) => a.ts - b.ts);
  const sortedRevs = withTs.map((x) => x.r);

  const allSeenSentences = new Set<string>();
  const strippedCache = new Map<number, string>();
  const sectionCharMapCache = new Map<number, Array<{ charOffset: number; section: string }>>();

  const getStripped = (rev: Revision): string => {
    const cached = strippedCache.get(rev.revId);
    if (cached !== undefined) return cached;
    const result = stripWikitext(rev.content);
    strippedCache.set(rev.revId, result);
    return result;
  };

  const getSectionCharMap = (rev: Revision): Array<{ charOffset: number; section: string }> => {
    const cached = sectionCharMapCache.get(rev.revId);
    if (cached) return cached;
    const map = buildSectionCharMap(rev.content);
    sectionCharMapCache.set(rev.revId, map);
    return map;
  };

  const parsedCache = new Map<number, ParsedContent>();

  const getParsed = (rev: Revision): ParsedContent => {
    const cached = parsedCache.get(rev.revId);
    if (cached) return cached;
    const result: ParsedContent = {
      sections: sectionDiffer.extractSections(rev.content),
      citations: citationTracker.extractCitations(rev.content),
      wikilinks: extractWikilinks(rev.content),
      categories: extractCategories(rev.content),
      templates: templateTracker.extractTemplates(rev.content),
    };
    parsedCache.set(rev.revId, result);
    return result;
  };

  const [pageMoves, protectionLogs, talkRevs] = await Promise.all([
    client.fetchPageMoves(pageTitle),
    client.fetchProtectionLogs(pageTitle),
    client.fetchTalkRevisions(pageTitle, { direction: "newer", limit: 10 }),
  ]);
  const pageMoveEvents = buildPageMoveEvents(pageMoves);
  events.push(...pageMoveEvents);

  const protectionLogsWithTs = protectionLogs.map((l) => ({
    l,
    ts: new Date(l.timestamp).getTime(),
  }));

  for (let i = 1; i < sortedRevs.length; i++) {
    const before = sortedRevs[i - 1];
    const after = sortedRevs[i];

    const isBrief = depth === "brief";
    const isForensic = depth === "forensic";
    const extraFacts: DeterministicFact[] = isForensic
      ? [
          { fact: "full_wikitext_before", detail: before.content },
          { fact: "full_wikitext_after", detail: after.content },
        ]
      : [];

    const beforeParsed = getParsed(before);
    const afterParsed = getParsed(after);

    const sectionChanges = sectionDiffer.diffSections(beforeParsed.sections, afterParsed.sections);
    const citationChanges = citationTracker.diffCitations(beforeParsed.citations, afterParsed.citations);
    const wikilinkChanges = diffWikilinks(beforeParsed.wikilinks, afterParsed.wikilinks);
    const categoryChanges = diffCategories(beforeParsed.categories, afterParsed.categories);
    const templateChanges = templateTracker.diffTemplates(beforeParsed.templates, afterParsed.templates);

    const isRevRevert = revertDetector.isRevert(after.comment);

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

    const beforePlain = getStripped(before);
    const afterPlain = getStripped(after);

    const sentenceSplit = /(?:[.!?]\s+|[。！？؟]\s*)/;
    const beforeSentences = beforePlain.split(sentenceSplit).filter((s) => s.trim().length > 20);
    const afterSentences = afterPlain.split(sentenceSplit).filter((s) => s.trim().length > 20);

    const beforeSecMap = getSectionCharMap(before);
    const afterSecMap = getSectionCharMap(after);

    const similarityThreshold = config?.section?.similarityThreshold ?? 0.8;

    function wordOverlapRatio(a: string, b: string): number {
      const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
      const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
      const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
      const union = new Set([...wordsA, ...wordsB]);
      return intersection.size / union.size;
    }

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

    // Sentence removal detection — only unmatched before sentences remain

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
  }

  if (talkRevs.length > 0) {
    const talkEvents = correlateTalkRevisions(sortedRevs, talkRevs);
    events.push(...talkEvents);
    if (talkEvents.length > 0) {
      console.error(`Correlated ${talkEvents.length} talk page discussions.`);
    }
  }

  if (fromTimestamp) {
    const obsDir = cacheDir ?? join(homedir(), ".wikihistory", "observations");
    if (!existsSync(obsDir)) mkdirSync(obsDir, { recursive: true });
    const obsFile = join(obsDir, `${pageTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);

    let priorEvents: EvidenceEvent[] = [];
    try {
      const raw = readFileSync(obsFile, "utf-8");
      priorEvents = JSON.parse(raw) as EvidenceEvent[];
    } catch {
      /* prior observation file may not exist yet */
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

  // Stamp schema version on every event for version-resilient downstream consumption
  for (const e of events) {
    (e as unknown as Record<string, unknown>).schemaVersion = EVENT_SCHEMA_VERSION;
  }

  // Apply deterministic semantic enrichment
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

  return { events, revisions: sortedRevs };
}

async function runBatch(
  pagesFile: string,
  depth: string,
  fromRevId?: number,
  toRevId?: number,
  fromTimestamp?: string,
  useCache = false,
  apiUrl?: string,
  cacheDir?: string,
  auth?: AuthConfig,
  config?: AnalyzerConfig,
): Promise<{ events: EvidenceEvent[]; revisions: Revision[] }> {
  const content = readFileSync(pagesFile, "utf-8");
  const titles: string[] = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  console.error(`Batch mode: ${titles.length} pages from ${pagesFile}\n`);

  const BATCH_CONCURRENCY = 4;
  const pageResults: BatchPageResult[] = [];
  const allEvents: EvidenceEvent[] = [];

  for (let i = 0; i < titles.length; i += BATCH_CONCURRENCY) {
    const chunk = titles.slice(i, i + BATCH_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (title, j) => {
        const idx = i + j + 1;
        console.error(`--- Page ${idx}/${titles.length}: ${title} ---`);
        const { events } = await runAnalyze(
          title,
          depth,
          fromRevId,
          toRevId,
          fromTimestamp,
          useCache,
          apiUrl,
          undefined,
          cacheDir,
          auth,
          config,
        );
        return { pageTitle: title, pageId: 0, eventCount: events.length, events };
      }),
    );
    pageResults.push(...chunkResults);
    for (const r of chunkResults) allEvents.push(...r.events);
  }

  const pages = pageResults;

  const result: BatchResult = {
    mode: "batch",
    batchSize: titles.length,
    pages,
    totalEvents: allEvents.length,
    generatedAt: new Date().toISOString(),
  };

  console.error(`\n=== Batch Results ===`);
  console.error(`Pages processed: ${result.batchSize}`);
  console.error(`Total events: ${result.totalEvents}\n`);
  for (const p of result.pages) {
    console.error(`  ${p.pageTitle}: ${p.eventCount} events`);
  }

  return { events: allEvents, revisions: [] };
}

export function buildObservationReport(
  pageTitle: string,
  pageId: number,
  events: EvidenceEvent[],
  revisions: Revision[],
): ObservationReport {
  const claimEventTypes = new Set([
    "sentence_first_seen",
    "sentence_reintroduced",
    "sentence_modified",
    "sentence_removed",
  ]);

  const claimEvents = events.filter((e) => claimEventTypes.has(e.eventType));

  const claimGroups = new Map<string, EvidenceEvent[]>();
  for (const event of claimEvents) {
    const text = event.after || event.before;
    if (!text) continue;
    const identity = createClaimIdentity({
      text,
      section: event.section,
      pageTitle,
      pageId,
    });
    const existing = claimGroups.get(identity.claimId) || [];
    existing.push(event);
    claimGroups.set(identity.claimId, existing);
  }

  const claims: Record<string, ClaimLedger> = {};
  let minRev = Infinity;
  let maxRev = -Infinity;

  for (const [claimId, groupEvents] of claimGroups) {
    groupEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const text = groupEvents[0].after || groupEvents[0].before;
    const firstSeenAt = groupEvents[0].timestamp;
    const lastSeenAt = groupEvents[groupEvents.length - 1].timestamp;

    const lastEvent = groupEvents[groupEvents.length - 1];
    let currentState: ClaimState;
    switch (lastEvent.eventType) {
      case "sentence_first_seen":
        currentState = "emerging";
        break;
      case "sentence_reintroduced":
        currentState = "stabilizing";
        break;
      case "sentence_modified":
        currentState = "contested";
        break;
      case "sentence_removed":
        currentState = "absent";
        break;
      default:
        currentState = "emerging";
    }

    for (const e of groupEvents) {
      if (e.toRevisionId < minRev) minRev = e.toRevisionId;
      if (e.toRevisionId > maxRev) maxRev = e.toRevisionId;
    }

    const eventIds = groupEvents.map((e) => e.eventId ?? createEventIdentity(e));

    const entry: ClaimLedgerEntry = {
      observedAt: new Date().toISOString(),
      revisionRange: {
        from: minRev === Infinity ? 0 : minRev,
        to: maxRev === -Infinity ? 0 : maxRev,
      },
      state: currentState,
      eventCount: groupEvents.length,
      eventIds,
    };

    claims[claimId] = {
      claimId,
      text,
      firstSeenAt,
      lastSeenAt,
      currentState,
      history: [entry],
    };
  }

  const manifest = createReplayManifest({
    pageTitle,
    analyzerVersions: { refract: REFRACT_VERSION },
    revisions,
    events: claimEvents,
  });

  return {
    pageTitle,
    pageId,
    observedAt: new Date().toISOString(),
    revisionRange: {
      from: minRev === Infinity ? 0 : minRev,
      to: maxRev === -Infinity ? 0 : maxRev,
    },
    claims,
    eventCount: events.length,
    uniqueEditorCount: [...new Set(revisions.map((r) => r.user).filter(Boolean))].length,
    merkleRoot: manifest.merkleRoot,
    analyzerVersion: REFRACT_VERSION,
  };
}
