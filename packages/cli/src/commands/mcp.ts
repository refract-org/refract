import type { AnalyzerConfig, EvidenceEvent, InferenceBoundary, InferenceResult } from "@refract-org/evidence-graph";
import { buildInferencePrompt, DEFAULT_ANALYZER_CONFIG } from "@refract-org/evidence-graph";
import type { AuthConfig } from "@refract-org/ingestion";
import { OpenAICompatibleProvider } from "../inference-provider.js";
import { runAnalyze } from "./analyze.js";
import { runClaim, runClaimHistory } from "./claim.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface SamplingMessage {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
}

interface McpProperty {
  type: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, McpProperty>;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, McpProperty>;
    required?: string[];
  };
}

const CLIENT_NAME = "refract-mcp";
const CLIENT_VERSION = "0.2.0";
const PROTOCOL_VERSION = "2025-06-18";

let _clientCapabilities: Record<string, unknown> | null = null;
const pendingSampling = new Map<string, { resolve: (value: JsonRpcResponse) => void; reject: (err: Error) => void }>();

export const TOOLS: McpTool[] = [
  {
    name: "analyze",
    description:
      "Analyze a MediaWiki page's full edit history. Returns a structured event stream: claims, citations, sections, templates, categories, wikilinks, and reverts — all provenance-tagged with revision IDs and timestamps.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page title (e.g. 'Bitcoin', 'Climate change')" },
        depth: {
          type: "string",
          enum: ["brief", "detailed", "forensic"],
          description:
            "Analysis depth: brief (event metadata only), detailed (text included), forensic (full wikitext)",
        },
        api: { type: "string", description: "MediaWiki API base URL. Defaults to English Wikipedia." },
        from: { type: "string", description: "Start revision ID" },
        to: { type: "string", description: "End revision ID" },
        since: { type: "string", description: "Re-observe from ISO timestamp" },
        config: {
          type: "object",
          description: "Analyzer configuration overrides",
          properties: {
            similarityThreshold: { type: "number", description: "Sentence matching threshold (0-1)" },
            spikeFactor: { type: "number", description: "Talk activity spike multiplier" },
            clusterWindowMinutes: { type: "number", description: "Edit cluster window in minutes" },
            talkWindowBeforeDays: { type: "number", description: "Talk correlation window before (days)" },
            talkWindowAfterDays: { type: "number", description: "Talk correlation window after (days)" },
            renameDetection: { type: "string", description: "Section rename: exact, similarity, none" },
          },
        },
      },
      required: ["page"],
    },
  },
  {
    name: "claim",
    description:
      "Track a specific sentence's provenance across revisions. Shows when a sentence first appeared, was removed, or was reintroduced — with section context and revision IDs.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page title" },
        text: { type: "string", description: "Sentence text to track (partial match supported)" },
        api: { type: "string", description: "MediaWiki API base URL" },
      },
      required: ["page", "text"],
    },
  },
  {
    name: "export",
    description:
      "Export page analysis as structured JSON. Returns all events with revision, section, and timestamp provenance.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page title" },
        depth: { type: "string", enum: ["brief", "detailed", "forensic"], description: "Analysis depth" },
        api: { type: "string", description: "MediaWiki API base URL" },
        since: { type: "string", description: "Re-observe from ISO timestamp" },
      },
      required: ["page"],
    },
  },
  {
    name: "cron",
    description: "One-shot re-observation for cron: reads a pages file, runs analysis, reports new events.",
    inputSchema: {
      type: "object",
      properties: {
        pagesFile: { type: "string", description: "Path to file with page titles (one per line)" },
      },
      required: ["pagesFile"],
    },
  },
  {
    name: "classify",
    description:
      "Ask a model to classify a single observation boundary — revert detection, sentence similarity, edit type, template signal, or activity spike. Uses MCP sampling if no API key is configured, otherwise calls the configured provider.",
    inputSchema: {
      type: "object",
      properties: {
        boundary: {
          type: "string",
          enum: ["revert", "sentence_similarity", "heuristic", "template_signal", "activity_spike"],
          description: "Which inference boundary to classify",
        },
        input: {
          type: "object",
          description: "Input data for the boundary (field names vary by boundary type)",
        },
        apiKey: {
          type: "string",
          description: "API key for the inference provider (optional; falls back to MCP sampling)",
        },
        endpoint: { type: "string", description: "Inference provider endpoint URL (default: OpenAI-compatible)" },
        model: { type: "string", description: "Model name (default: gpt-4o-mini)" },
      },
      required: ["boundary", "input"],
    },
  },
  {
    name: "get_statement_history",
    description:
      "Track the history of a specific statement across revisions. Returns when the statement (or a semantic neighbor) appeared, disappeared, or changed, with revision IDs, timestamps, an overall status, and a short change summary.",
    inputSchema: {
      type: "object",
      properties: {
        statement: { type: "string", description: "Raw text statement to track" },
        page: { type: "string", description: "MediaWiki page title to ground against" },
        context: { type: "string", description: "Optional use-context slug for scoped analysis" },
        depth: {
          type: "string",
          enum: ["brief", "detailed", "forensic"],
          description: "History depth: brief, detailed, or forensic",
        },
        api: { type: "string", description: "MediaWiki API base URL. Defaults to English Wikipedia." },
      },
      required: ["statement", "page"],
    },
  },
];

function send(response: JsonRpcResponse): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

function sendRequest(request: JsonRpcRequest): void {
  process.stdout.write(`${JSON.stringify(request)}\n`);
}

function sendError(id: number | string, code: number, message: string): void {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function extractAuth(params?: Record<string, unknown>): AuthConfig | undefined {
  const key = params?.apiKey as string | undefined;
  const user = params?.apiUser as string | undefined;
  const pass = params?.apiPassword as string | undefined;
  if (!key && !user && !pass) return undefined;
  return { apiKey: key, apiUser: user, apiPassword: pass };
}

function summarizeEvents(events: EvidenceEvent[]): { byType: Record<string, number>; sections: number } {
  const byType: Record<string, number> = {};
  const secSet = new Set<string>();
  for (const e of events) {
    byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;
    if (e.section) secSet.add(e.section);
  }
  return { byType, sections: secSet.size };
}

function formatEventLine(e: EvidenceEvent): string {
  const section = e.section ? ` [${e.section}]` : "";
  const facts = e.deterministicFacts.map((f) => f.fact).join("; ");
  const detail = facts ? ` — ${facts}` : "";
  return `[${e.timestamp}] ${e.eventType} (rev ${e.fromRevisionId}→${e.toRevisionId})${section}${detail}`;
}

async function _requestSampling(messages: SamplingMessage[], systemPrompt: string, maxTokens = 2000): Promise<string> {
  const id = `sampling-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingSampling.delete(id);
      reject(new Error("Sampling request timed out after 60s"));
    }, 60_000);

    pendingSampling.set(id, {
      resolve: (response: JsonRpcResponse) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(response.error.message));
          return;
        }
        const result = response.result as { content?: { type: string; text: string }[] } | undefined;
        const text = result?.content?.find((c) => c.type === "text")?.text;
        if (!text) {
          reject(new Error("No text content in sampling response"));
          return;
        }
        resolve(text);
      },
      reject: (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      },
    });

    sendRequest({
      jsonrpc: "2.0",
      id,
      method: "sampling/createMessage",
      params: {
        messages,
        systemPrompt,
        maxTokens,
        temperature: 0.3,
        stopSequences: [],
        metadata: {},
      },
    });
  });
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown> | undefined,
): Promise<{ content: { type: string; text: string }[] }> {
  const params = args ?? {};
  const apiUrl = params.api as string | undefined;
  const auth = extractAuth(params);

  switch (name) {
    case "analyze": {
      const page = params.page as string;
      const depth = (params.depth as string) ?? "detailed";
      const from = params.from ? parseInt(params.from as string, 10) : undefined;
      const to = params.to ? parseInt(params.to as string, 10) : undefined;
      const since = params.since as string | undefined;

      const mcpConfig = params.config as Record<string, unknown> | undefined;
      let config: AnalyzerConfig | undefined;
      if (mcpConfig) {
        config = structuredClone(DEFAULT_ANALYZER_CONFIG);
        if (mcpConfig.similarityThreshold !== undefined) {
          config.section ??= {};
          config.section.similarityThreshold = mcpConfig.similarityThreshold as number;
        }
        if (mcpConfig.spikeFactor !== undefined) {
          config.talkSpike ??= {};
          config.talkSpike.spikeFactor = mcpConfig.spikeFactor as number;
        }
        if (mcpConfig.clusterWindowMinutes !== undefined) {
          config.editCluster ??= {};
          config.editCluster.windowMs = (mcpConfig.clusterWindowMinutes as number) * 60 * 1000;
        }
        if (mcpConfig.talkWindowBeforeDays !== undefined) {
          config.talkCorrelation ??= {};
          config.talkCorrelation.windowBeforeMs = (mcpConfig.talkWindowBeforeDays as number) * 24 * 60 * 60 * 1000;
        }
        if (mcpConfig.talkWindowAfterDays !== undefined) {
          config.talkCorrelation ??= {};
          config.talkCorrelation.windowAfterMs = (mcpConfig.talkWindowAfterDays as number) * 24 * 60 * 60 * 1000;
        }
        if (mcpConfig.renameDetection !== undefined) {
          const mode = mcpConfig.renameDetection as string;
          if (mode === "exact" || mode === "similarity" || mode === "none") {
            config.section ??= {};
            config.section.renameDetection = mode;
          }
        }
      }

      const { events, revisions } = await runAnalyze(
        page,
        depth,
        from,
        to,
        since,
        false,
        apiUrl,
        undefined,
        undefined,
        auth,
        config,
      );
      const summary = summarizeEvents(events);
      const lines = [
        `Analysis of "${page}" (depth=${depth}):`,
        `  Revisions fetched: ${revisions.length}`,
        `  Total events: ${events.length}`,
        `  Sections with activity: ${summary.sections}`,
        "",
        "Event type breakdown:",
      ];
      for (const [type, count] of Object.entries(summary.byType).sort(([, a], [, b]) => b - a)) {
        lines.push(`  ${type}: ${count}`);
      }
      if (events.length > 0) {
        const sample = events.slice(0, 30);
        lines.push("", "Sample events:");
        for (const e of sample) lines.push(`  ${formatEventLine(e)}`);
        if (events.length > 30) lines.push(`  ... and ${events.length - 30} more events`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    case "claim": {
      const page = params.page as string;
      const text = params.text as string;
      let captured = "";
      const origLog = console.log;
      console.log = (...args: unknown[]) => {
        captured += `${args.map(String).join(" ")}\n`;
      };
      try {
        await runClaim(page, text, false, apiUrl, undefined, auth);
      } finally {
        console.log = origLog;
      }
      if (!captured.trim()) captured = `Sentence "${text}" not found in "${page}" revision history.`;
      return { content: [{ type: "text", text: captured.trim() }] };
    }

    case "export": {
      const page = params.page as string;
      const depth = (params.depth as string) ?? "detailed";
      const since = params.since as string | undefined;
      const { events, revisions } = await runAnalyze(
        page,
        depth,
        undefined,
        undefined,
        since,
        false,
        apiUrl,
        undefined,
        undefined,
        auth,
      );
      const report = {
        format: "refract-export/v1",
        generatedAt: new Date().toISOString(),
        pageTitle: page,
        revisionCount: revisions.length,
        eventCount: events.length,
        summary: summarizeEvents(events),
        events,
      };
      return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
    }

    case "cron": {
      const pagesFile = params.pagesFile as string;
      const fs = await import("node:fs");
      if (!fs.existsSync(pagesFile)) {
        return { content: [{ type: "text", text: `Error: pages file not found: ${pagesFile}` }] };
      }
      const pages = fs
        .readFileSync(pagesFile, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const results: Array<{ page: string; newEvents: number; ok: boolean; error?: string }> = [];
      for (const page of pages) {
        try {
          const { events } = await runAnalyze(
            page,
            "brief",
            undefined,
            undefined,
            undefined,
            false,
            apiUrl,
            undefined,
            undefined,
            auth,
          );
          results.push({ page, newEvents: events.length, ok: true });
        } catch (err) {
          results.push({ page, newEvents: 0, ok: false, error: String(err) });
        }
      }
      const totalNew = results.reduce((s, r) => s + r.newEvents, 0);
      const errors = results.filter((r) => !r.ok).length;
      const lines = [
        "Cron re-observation:",
        `  Pages checked: ${results.length}`,
        `  New events total: ${totalNew}`,
        `  Errors: ${errors}`,
      ];
      const changed = results.filter((r) => r.newEvents > 0);
      if (changed.length > 0) {
        lines.push("", "Changed pages:");
        for (const r of changed) lines.push(`  ${r.page}: ${r.newEvents} new events`);
      }
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        lines.push("", "Errors:");
        for (const f of failed) lines.push(`  ${f.page}: ${f.error ?? "unknown error"}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    case "classify": {
      const boundary = params.boundary as InferenceBoundary;
      const input = params.input as Record<string, unknown>;
      if (!boundary || !input) {
        return { content: [{ type: "text", text: "Error: missing 'boundary' or 'input' parameters" }] };
      }

      const apiKey = (params.apiKey as string) || process.env.REFRACT_INFERENCE_API_KEY || "";
      const endpoint = (params.endpoint as string) || process.env.REFRACT_INFERENCE_ENDPOINT || "";
      const model = (params.model as string) || process.env.REFRACT_INFERENCE_MODEL || "";

      try {
        let result: InferenceResult;

        if (apiKey) {
          const provider = new OpenAICompatibleProvider({ endpoint, apiKey, model });
          result = await provider.infer(boundary, input);
        } else if (_clientCapabilities?.sampling) {
          // MCP sampling: ask the host LLM
          const prompt = buildInferencePrompt(boundary, input);
          const samplingId = `classify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const { parseInferenceResponse } = await import("@refract-org/evidence-graph");

          const samplingResult = await new Promise<{ content: { text: string } }>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("MCP sampling timeout")), 30000);
            pendingSampling.set(samplingId, {
              resolve: (value) => {
                clearTimeout(timeout);
                const content = (value.result as { content?: Array<{ text?: string }> })?.content?.[0];
                if (content?.text) resolve({ content: { text: content.text } });
                else reject(new Error("Empty sampling response"));
              },
              reject: (err) => {
                clearTimeout(timeout);
                reject(err);
              },
            });
            sendRequest({
              jsonrpc: "2.0",
              id: samplingId,
              method: "sampling/createMessage",
              params: {
                messages: [{ role: "user", content: { type: "text", text: prompt } }],
                maxTokens: 64,
              },
            });
          });

          result = parseInferenceResponse(boundary, samplingResult.content.text, input);
        } else {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    boundary,
                    output: {},
                    source: "default",
                    note: "No inference provider configured. Set REFRACT_INFERENCE_API_KEY or connect via MCP client with sampling support.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${String(error)}` }] };
      }
    }

    case "get_statement_history": {
      const statement = params.statement as string;
      const page = params.page as string;
      const depth = (params.depth as string) ?? "detailed";
      const context = params.context as string | undefined;

      const history = await runClaimHistory(page, statement, false, apiUrl, undefined, auth);

      // depth influences how many revisions are loaded and how much text is retained
      const trimmedRevisions =
        depth === "brief"
          ? history.revisions.map((r) => ({ revisionId: r.revisionId, timestamp: r.timestamp }))
          : depth === "forensic"
            ? history.revisions
            : history.revisions.map((r) => ({ revisionId: r.revisionId, timestamp: r.timestamp, section: r.section }));

      const response = {
        statement: history.statement,
        page: history.page,
        context,
        revisions: trimmedRevisions,
        status: history.status,
        history_summary: history.historySummary,
      };
      return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
    }

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
}

async function handleRequest(request: JsonRpcRequest): Promise<void> {
  switch (request.method) {
    case "initialize": {
      _clientCapabilities = (request.params?.capabilities as Record<string, unknown>) ?? null;
      process.stderr.write("Refract MCP server initialized.\n");
      send({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {}, sampling: {} },
          serverInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
        },
      });
      break;
    }

    case "initialized":
      break;

    case "tools/list":
      send({ jsonrpc: "2.0", id: request.id, result: { tools: TOOLS } });
      break;

    case "tools/call": {
      const toolParams = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
      if (!toolParams?.name) {
        sendError(request.id, -32602, "Missing tool name");
        break;
      }
      try {
        const result = await handleToolCall(toolParams.name, toolParams.arguments);
        send({ jsonrpc: "2.0", id: request.id, result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Tool error: ${message}\n`);
        send({
          jsonrpc: "2.0",
          id: request.id,
          result: { content: [{ type: "text", text: `Error: ${message}` }], isError: true },
        });
      }
      break;
    }

    default:
      sendError(request.id, -32601, `Method not found: ${request.method}`);
  }
}

export async function runMcpServer(): Promise<void> {
  process.stderr.write("Refract MCP server starting...\n");

  let buffer = "";

  process.stdin.setEncoding("utf-8");

  for await (const chunk of process.stdin) {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }

      const id = String(msg.id ?? "");
      if (pendingSampling.has(id)) {
        const handler = pendingSampling.get(id);
        if (!handler) continue;
        pendingSampling.delete(id);
        if (msg.error) {
          handler.reject(new Error(String((msg.error as Record<string, unknown>).message ?? "Sampling error")));
        } else {
          handler.resolve({ jsonrpc: "2.0", id, result: msg.result });
        }
        continue;
      }

      const request = msg as unknown as JsonRpcRequest;
      if (request.jsonrpc !== "2.0") continue;

      handleRequest(request).catch((err) => {
        process.stderr.write(`Unhandled error: ${err.message}\n`);
      });
    }
  }
}
