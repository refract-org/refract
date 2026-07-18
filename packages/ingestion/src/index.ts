import type { DiffResult, Revision } from "@refract-org/evidence-graph";

export interface AuthConfig {
  apiKey?: string;
  apiUser?: string;
  apiPassword?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
}

export interface RevisionFetcher {
  fetchRevisions(pageTitle: string, options?: RevisionOptions): Promise<Revision[]>;
}

export interface RevisionSource {
  revisions(pageTitle: string, options?: RevisionOptions): AsyncIterable<Revision>;
}

export interface DiffFetcher {
  fetchDiff(fromRevId: number, toRevId: number): Promise<DiffResult>;
}

export interface MoveFetcher {
  fetchPageMoves(pageTitle: string): Promise<PageMove[]>;
}

export interface ProtectionLogEvent {
  logId: number;
  pageTitle: string;
  timestamp: string;
  comment: string;
  action: "protect" | "unprotect" | "modify";
  level?: string;
}

export interface PageMove {
  oldTitle: string;
  newTitle: string;
  timestamp: string;
  revId: number;
  comment: string;
}

export interface RevisionOptions {
  limit?: number;
  start?: Date;
  end?: Date;
  direction?: "newer" | "older";
  startRevId?: number;
  endRevId?: number;
}

export { MediaWikiClient } from "./mediawiki-client.js";
export { RateLimiter } from "./rate-limiter.js";
export type { StreamClientOptions, StreamEvent } from "./stream-client.js";
export { WikimediaStreamClient } from "./stream-client.js";
export type { PageToEntityMap, WikidataClaim, WikidataEntity, WikidataValue } from "./wikidata-mapper.js";
export {
  fetchWikidataEntity,
  fetchWikidataId,
  mapPagesToEntities,
  mapPageToEntity,
  wikidataEntityToEvents,
} from "./wikidata-mapper.js";
export { XmlDumpRevisionSource } from "./xml-dump-source.js";
