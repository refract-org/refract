import { readFileSync } from "node:fs";
import {
  buildPageMoveEvents,
  citationTracker,
  extractCategories,
  extractWikilinks,
  sectionDiffer,
  stripWikitext,
  templateTracker,
  windowPageMoves,
} from "@refract-org/analyzers";
import type {
  AnalyzerConfig,
  ClaimLedger,
  ClaimLedgerEntry,
  ClaimState,
  EvidenceEvent,
  ObservationReport,
  Revision,
} from "@refract-org/evidence-graph";
import {
  createClaimIdentity,
  createEventIdentity,
  createReplayManifest,
  DEFAULT_ANALYZER_CONFIG,
} from "@refract-org/evidence-graph";
import type { AuthConfig } from "@refract-org/ingestion";

import type { ParsedContent } from "./analyze-helpers.js";
import {
  computeStructuralDiffs,
  correlateTalkPages,
  detectEditorialSignals,
  diffSentences,
  fetchRevisionsWithCache,
  finalizeEvents,
} from "./analyze-helpers.js";
import { buildSectionCharMap } from "./claim.js";

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
const REFRACT_VERSION = "0.5.14";

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

  if (options.briefLimit !== undefined) {
    config.briefRevisionLimit = Number(options.briefLimit);
  }

  if (options.batchConcurrency !== undefined) {
    config.batchConcurrency = Number(options.batchConcurrency);
  }

  // Pin config version from the package version for traceability
  config.$version = REFRACT_VERSION;

  return config;
}

/**
 * Run the full Refract analysis pipeline on a page (or batch of pages).
 * Fetches revisions, computes diffs, and emits structured provenance events.
 */
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

  const { client, revisions: sortedRevs } = await fetchRevisionsWithCache(
    pageTitle,
    depth,
    fromRevId,
    toRevId,
    fromTimestamp,
    useCache,
    apiUrl,
    cacheDir,
    auth,
    config?.briefRevisionLimit,
  );
  if (sortedRevs.length === 0) return { events: [], revisions: [] };

  const events: EvidenceEvent[] = [];

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
  // Bound moves to the analyzed span: the move log covers the page's whole
  // lifetime, and a --since window must not open with moves from 2005.
  events.push(
    ...buildPageMoveEvents(
      windowPageMoves(pageMoves, sortedRevs[0].timestamp, sortedRevs[sortedRevs.length - 1].timestamp),
    ),
  );

  const protectionLogsWithTs = protectionLogs.map((l) => ({
    l,
    ts: new Date(l.timestamp).getTime(),
  }));

  const isBrief = depth === "brief";
  const isForensic = depth === "forensic";
  const similarityThreshold = config?.section?.similarityThreshold ?? 0.8;

  for (let i = 1; i < sortedRevs.length; i++) {
    const before = sortedRevs[i - 1];
    const after = sortedRevs[i];

    const pairExtraFacts = isForensic
      ? [
          { fact: "full_wikitext_before", detail: before.content },
          { fact: "full_wikitext_after", detail: after.content },
        ]
      : [];

    const beforeParsed = getParsed(before);
    const afterParsed = getParsed(after);

    events.push(
      ...computeStructuralDiffs(before, after, beforeParsed, afterParsed, isBrief, pairExtraFacts),
      ...detectEditorialSignals(
        before,
        after,
        beforeParsed,
        afterParsed,
        isBrief,
        pairExtraFacts,
        protectionLogsWithTs,
      ),
      ...diffSentences(
        before,
        after,
        getStripped,
        getSectionCharMap,
        allSeenSentences,
        similarityThreshold,
        isBrief,
        pairExtraFacts,
      ),
    );
  }

  events.push(...correlateTalkPages(sortedRevs, talkRevs));
  finalizeEvents(pageTitle, events, sortedRevs, fromTimestamp, cacheDir);

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

  const batchConcurrency = config?.batchConcurrency ?? 4;
  const pageResults: BatchPageResult[] = [];
  const allEvents: EvidenceEvent[] = [];

  for (let i = 0; i < titles.length; i += batchConcurrency) {
    const chunk = titles.slice(i, i + batchConcurrency);
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
