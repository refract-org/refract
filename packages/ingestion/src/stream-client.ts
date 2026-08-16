import type { Revision } from "@refract-org/evidence-graph";

const DEFAULT_STREAM_URL = "https://stream.wikimedia.org/v2/stream/recentchange";

export interface StreamEvent {
  wiki: string;
  title: string;
  pageId: number;
  revId: number;
  parentId: number;
  timestamp: number; // Unix epoch seconds
  user: string;
  comment: string;
  minor: boolean;
  type: "edit" | "new";
}

export interface StreamClientOptions {
  streamUrl?: string;
  filter?: {
    wiki?: string; // e.g., "enwiki"
    title?: string; // exact page title match
  };
}

export class WikimediaStreamClient {
  private streamUrl: string;
  private filter?: StreamClientOptions["filter"];

  constructor(opts: StreamClientOptions = {}) {
    this.streamUrl = opts.streamUrl ?? DEFAULT_STREAM_URL;
    this.filter = opts.filter;
  }

  async *connect(): AsyncGenerator<StreamEvent> {
    const response = await fetch(this.streamUrl, {
      headers: {
        Accept: "text/event-stream",
        "User-Agent": "Refract/0.5.14 (https://github.com/refract-org/refract)",
      },
    });

    if (!response.ok || !response.body) {
      throw new Error(`Failed to connect to stream: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data) as {
                wiki?: string;
                title?: string;
                page_id?: number;
                rev_id?: number;
                parent_id?: number;
                timestamp?: number;
                user?: string;
                comment?: string;
                minor?: boolean;
                type?: string;
                namespace?: number;
                bot?: boolean;
              };

              if (!event.wiki || event.namespace !== 0 || event.bot) continue;
              if (this.filter?.wiki && event.wiki !== this.filter.wiki) continue;
              if (this.filter?.title && event.title !== this.filter.title) continue;

              yield {
                wiki: event.wiki,
                title: event.title ?? "",
                pageId: event.page_id ?? 0,
                revId: event.rev_id ?? 0,
                parentId: event.parent_id ?? 0,
                timestamp: event.timestamp ?? 0,
                user: event.user ?? "",
                comment: event.comment ?? "",
                minor: event.minor ?? false,
                type: (event.type === "new" ? "new" : "edit") as "edit" | "new",
              };
            } catch (err) {
              console.error("refract: stream-client: failed to parse event", err);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  static toRevision(event: StreamEvent): Revision {
    return {
      revId: event.revId,
      pageId: event.pageId,
      pageTitle: event.title,
      timestamp: new Date(event.timestamp * 1000).toISOString(),
      user: event.user,
      comment: event.comment,
      content: "", // content not available in stream — fetch separately
      size: 0,
      minor: event.minor,
    };
  }
}
