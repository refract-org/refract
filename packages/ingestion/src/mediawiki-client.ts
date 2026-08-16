import type { DiffLine, DiffResult, Revision } from "@refract-org/evidence-graph";
import type {
  AuthConfig,
  DiffFetcher,
  KnowledgeSource,
  MoveFetcher,
  PageMove,
  ProtectionLogEvent,
  RevisionFetcher,
  RevisionOptions,
  RevisionSource,
  SourceEntity,
  SourceQuery,
} from "./index.js";
import { RateLimiter } from "./rate-limiter.js";

const DEFAULT_API_URL = "https://en.wikipedia.org/w/api.php";
const DEFAULT_USER_AGENT = "Refract/0.1.0 (https://github.com/refract-org/refract; refract@nextconsensus.com)";
const MAX_REVISIONS_PER_REQUEST = 500;

interface PageInfo {
  pageId: number;
  title: string;
}

interface RawRevision {
  revid: number;
  parentid: number;
  timestamp: string;
  comment: string;
  size: number;
  minor?: boolean;
  user?: string;
  userhidden?: boolean;
  slots?: {
    main?: {
      content?: string;
    };
  };
}

interface RevisionQueryResponse {
  query?: {
    pages?: Record<
      string,
      {
        pageid: number;
        title: string;
        revisions?: RawRevision[];
        missing?: string;
      }
    >;
  };
  continue?: {
    rvcontinue: string;
  };
}

interface LogEventResponse {
  query?: {
    logevents?: {
      logid: number;
      title: string;
      timestamp: string;
      comment: string;
      params?: {
        target_title: string;
      };
    }[];
  };
}

interface CompareResponse {
  compare?: {
    fromrevid: number;
    torevid: number;
    fromsize: number;
    tosize: number;
    "*"?: string;
  };
}

export class MediaWikiClient implements RevisionFetcher, RevisionSource, DiffFetcher, MoveFetcher, KnowledgeSource {
  readonly sourceId = "mediawiki";
  readonly sourceName = "MediaWiki";
  private rateLimiter: RateLimiter;
  private userAgent: string;
  private apiUrl: string;
  private auth?: AuthConfig;

  constructor(options?: { apiUrl?: string; userAgent?: string; minDelayMs?: number; auth?: AuthConfig }) {
    this.apiUrl = options?.apiUrl ?? DEFAULT_API_URL;
    this.userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
    this.rateLimiter = new RateLimiter(options?.minDelayMs ?? 100);
    this.auth = options?.auth;
  }

  async fetchTalkRevisions(pageTitle: string, options?: RevisionOptions, talkPrefix?: string): Promise<Revision[]> {
    const prefix = talkPrefix ?? "Talk:";
    const talkTitle = `${prefix}${pageTitle}`;
    return this.fetchRevisions(talkTitle, options);
  }

  async fetchRevisions(pageTitle: string, options?: RevisionOptions): Promise<Revision[]> {
    const revisions: Revision[] = [];
    const limit = Math.min(options?.limit ?? MAX_REVISIONS_PER_REQUEST, MAX_REVISIONS_PER_REQUEST);
    let rvcontinue: string | undefined;

    let pageInfo: PageInfo | null = null;

    while (true) {
      const params = new URLSearchParams({
        action: "query",
        prop: "revisions",
        titles: pageTitle,
        rvprop: "content|ids|timestamp|flags|comment|size|user",
        rvslots: "main",
        rvlimit: String(limit),
        format: "json",
        formatversion: "2",
      });

      const isNewer = options?.direction === "newer";
      params.set("rvdir", isNewer ? "newer" : "older");

      if (options?.start && options?.end) {
        params.set("rvstart", formatTimestamp(isNewer ? options.start : options.end));
        params.set("rvend", formatTimestamp(isNewer ? options.end : options.start));
      } else if (options?.start) {
        params.set("rvstart", formatTimestamp(options.start));
      } else if (options?.end) {
        params.set("rvend", formatTimestamp(options.end));
      }
      if (options?.startRevId) {
        params.set("rvstartid", String(options.startRevId));
      }
      if (options?.endRevId) {
        params.set("rvendid", String(options.endRevId));
      }

      if (rvcontinue) {
        params.set("rvcontinue", rvcontinue);
      }

      const url = `${this.apiUrl}?${params.toString()}`;
      const response = await this.fetch(url);
      const data: RevisionQueryResponse = await response.json();

      if (!data.query?.pages) {
        break;
      }

      for (const page of Object.values(data.query.pages)) {
        if (page.missing) continue;
        if (!pageInfo) {
          pageInfo = { pageId: page.pageid, title: page.title };
        }
        if (page.revisions) {
          for (const rev of page.revisions) {
            revisions.push(this.mapRevision(rev, pageInfo));
          }
        }
      }

      if (data.continue?.rvcontinue) {
        rvcontinue = data.continue.rvcontinue;
        if (options?.limit !== undefined && revisions.length >= options.limit) break;
      } else {
        break;
      }
    }

    return revisions;
  }

  async fetchPageMoves(pageTitle: string): Promise<PageMove[]> {
    const moves: PageMove[] = [];
    let lecontinue: string | undefined;

    while (true) {
      const params = new URLSearchParams({
        action: "query",
        list: "logevents",
        letype: "move",
        letitle: pageTitle,
        lelimit: "50",
        format: "json",
        formatversion: "2",
      });

      if (lecontinue) params.set("lecontinue", lecontinue);

      const url = `${this.apiUrl}?${params.toString()}`;
      const response = await this.fetch(url);
      const data = (await response.json()) as LogEventResponse & {
        continue?: { lecontinue: string };
      };

      if (!data.query?.logevents) break;

      for (const entry of data.query.logevents) {
        moves.push({
          oldTitle: entry.title,
          newTitle: entry.params?.target_title ?? "",
          timestamp: entry.timestamp,
          revId: entry.logid,
          comment: entry.comment ?? "",
        });
      }

      if (data.continue?.lecontinue) {
        lecontinue = data.continue.lecontinue;
      } else {
        break;
      }
    }

    return moves;
  }

  async fetchProtectionLogs(pageTitle: string): Promise<ProtectionLogEvent[]> {
    const events: ProtectionLogEvent[] = [];
    let lecontinue: string | undefined;

    while (true) {
      const params = new URLSearchParams({
        action: "query",
        list: "logevents",
        letype: "protect",
        letitle: pageTitle,
        lelimit: "50",
        leprop: "details",
        format: "json",
        formatversion: "2",
      });

      if (lecontinue) params.set("lecontinue", lecontinue);

      const url = `${this.apiUrl}?${params.toString()}`;
      const response = await this.fetch(url);
      const data = (await response.json()) as {
        query?: {
          logevents?: Array<{
            logid: number;
            title: string;
            timestamp: string;
            comment: string;
            action: string;
            params?: {
              detail?: Array<{ level?: string; expiry?: string }>;
            };
          }>;
        };
        continue?: { lecontinue: string };
      };

      if (data.query?.logevents) {
        for (const entry of data.query.logevents) {
          const level = entry.params?.detail?.[0]?.level;
          events.push({
            logId: entry.logid,
            pageTitle: entry.title,
            timestamp: entry.timestamp,
            comment: entry.comment ?? "",
            action: entry.action as "protect" | "unprotect" | "modify",
            level,
          });
        }
      }

      if (data.continue?.lecontinue) {
        lecontinue = data.continue.lecontinue;
      } else {
        break;
      }
    }

    return events;
  }

  async fetchEntities(query: SourceQuery): Promise<SourceEntity[]> {
    const params = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query.query,
      srlimit: String(query.limit ?? 10),
      format: "json",
      formatversion: "2",
    });
    const response = await this.fetch(`${this.apiUrl}?${params.toString()}`);
    const data = (await response.json()) as {
      query?: { search?: Array<{ title: string; pageid: number }> };
    };
    return (data.query?.search ?? []).map((r) => ({
      entityId: String(r.pageid),
      title: r.title,
      type: "page",
      metadata: { api: this.apiUrl },
    }));
  }

  async fetchDiff(fromRevId: number, toRevId: number): Promise<DiffResult> {
    const params = new URLSearchParams({
      action: "compare",
      fromrev: String(fromRevId),
      torev: String(toRevId),
      format: "json",
      formatversion: "2",
    });

    const url = `${this.apiUrl}?${params.toString()}`;
    const response = await this.fetch(url);
    const data: CompareResponse = await response.json();

    if (!data.compare) {
      throw new Error(`Failed to fetch diff for revisions ${fromRevId} -> ${toRevId}`);
    }

    const sizeDelta = data.compare.tosize - data.compare.fromsize;
    const lines = data.compare["*"] ? parseUnifiedDiff(data.compare["*"]) : [];

    return {
      fromRevId: data.compare.fromrevid,
      toRevId: data.compare.torevid,
      lines,
      sections: [],
      sizeDelta,
    };
  }

  private async fetch(url: string, retries = 3): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
      await this.rateLimiter.acquire();
      const headers: Record<string, string> = {
        "User-Agent": this.userAgent,
        Accept: "application/json",
        "Accept-Encoding": "gzip",
      };

      if (this.auth?.apiKey) {
        headers.Authorization = `Bearer ${this.auth.apiKey}`;
      } else if (this.auth?.apiUser && this.auth?.apiPassword) {
        const encoded = btoa(`${this.auth.apiUser}:${this.auth.apiPassword}`);
        headers.Authorization = `Basic ${encoded}`;
      }

      if (this.auth?.oauthClientId && this.auth?.oauthClientSecret) {
        headers["X-OAuth-Client-Id"] = this.auth.oauthClientId;
        headers["X-OAuth-Client-Secret"] = this.auth.oauthClientSecret;
      }

      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) return response;

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000;
        if (attempt < retries - 1) {
          console.error(
            `refract: retrying request (attempt ${attempt + 2}/${retries}, status 429, wait ${waitMs}ms)...`,
          );
          await this.sleep(waitMs);
          continue;
        }
      }

      if (response.status >= 500 && attempt < retries - 1) {
        const waitMs = 2 ** attempt * 1000;
        console.error(
          `refract: retrying request (attempt ${attempt + 2}/${retries}, status ${response.status}, wait ${waitMs}ms)...`,
        );
        await this.sleep(waitMs);
        continue;
      }

      throw new Error(`MediaWiki API error: ${response.status} ${response.statusText} for ${url}`);
    }

    throw new Error(`MediaWiki API request failed after ${retries} retries for ${url}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async *revisions(pageTitle: string, options?: RevisionOptions): AsyncIterable<Revision> {
    const revs = await this.fetchRevisions(pageTitle, options);
    for (const rev of revs) {
      yield rev;
    }
  }

  private mapRevision(raw: RawRevision, page: PageInfo): Revision {
    const content = raw.slots?.main?.content ?? "";
    return {
      revId: raw.revid,
      pageId: page.pageId,
      pageTitle: page.title,
      timestamp: raw.timestamp,
      user: raw.userhidden ? undefined : raw.user,
      comment: raw.comment ?? "",
      content,
      size: raw.size,
      minor: raw.minor ?? false,
    };
  }
}

function formatTimestamp(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, -5)}Z`;
}

function parseUnifiedDiff(diffText: string): DiffLine[] {
  const lines: DiffLine[] = [];
  const textLines = diffText.split("\n");

  let fromLine = 0;
  let toLine = 0;

  for (const line of textLines) {
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        fromLine = parseInt(match[1], 10);
        toLine = parseInt(match[2], 10);
      }
      continue;
    }

    if (line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    if (line.startsWith(" ")) {
      lines.push({ type: "unchanged", content: line.slice(1), lineNumber: toLine });
      fromLine++;
      toLine++;
    } else if (line.startsWith("-")) {
      lines.push({ type: "removed", content: line.slice(1), lineNumber: fromLine });
      fromLine++;
    } else if (line.startsWith("+")) {
      lines.push({ type: "added", content: line.slice(1), lineNumber: toLine });
      toLine++;
    }
  }

  return lines;
}
