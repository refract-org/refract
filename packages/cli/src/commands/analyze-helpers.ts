import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { annotateEvents, correlateTalkRevisions, diffObservations } from "@refract-org/analyzers";
import type { EvidenceEvent, Revision } from "@refract-org/evidence-graph";
import type { AuthConfig, RevisionOptions } from "@refract-org/ingestion";
import { MediaWikiClient } from "@refract-org/ingestion";

import { loadCachedRevisions, loadLatestCachedTimestamp, saveRevisions } from "./cache.js";

export interface FetchResult {
  client: MediaWikiClient;
  revisions: Revision[];
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
      // The latest N, newest first (sorted oldest-first below). With "newer"
      // this read the page's first N edits, so a brief look at a live page
      // reported its history from the year it was created.
      options.direction = "older";
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

  return annotateEvents(events);
}
