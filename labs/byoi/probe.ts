/**
 * BYOI (Bring Your Own Inference) Probe
 *
 * Pipes Refract's deterministic event stream through an LLM to produce
 * structured semantic interpretations. Reads events from stdin.
 * When no model is configured (no REFRACT_INFERENCE_ENDPOINT), returns a
 * deterministic summary.
 *
 * Env var conventions (matching refract core):
 *   REFRACT_INFERENCE_ENDPOINT  — any OpenAI-compatible endpoint (e.g. http://localhost:11434/v1/chat/completions)
 *   REFRACT_INFERENCE_API_KEY   — API key (optional, passes through to provider)
 *   REFRACT_INFERENCE_MODEL     — model name (default: gemma4:26b)
 *
 * Legacy aliases (also accepted):
 *   OPENAI_API_BASE             — base URL (appends /chat/completions)
 *   OPENAI_API_KEY              — API key
 *   INFERENCE_MODEL             — model name
 *
 * Usage:
 *   refract export "Bitcoin" --format ndjson | bun run probe:byoi
 *   REFRACT_INFERENCE_ENDPOINT=http://localhost:11434/v1/chat/completions refract export "Bitcoin" --format ndjson | bun run probe:byoi
 */

import type { EvidenceEvent, ModelInterpretation } from "@refract-org/evidence-graph";
import { getProvider, callModel, type ProviderConfig } from "../lib/inference.js";
import { createInterface } from "node:readline";

const EVENT_DESCRIPTIONS: Record<string, string> = {
  sentence_first_seen: "a sentence appeared for the first time",
  sentence_removed: "a sentence was deleted entirely",
  sentence_reintroduced: "a previously removed sentence was restored",
  citation_added: "a new reference was added",
  citation_removed: "a reference was removed",
  citation_replaced: "one citation replaced by another",
  template_added: "a maintenance or policy template was added",
  template_removed: "a template was removed",
  revert_detected: "an edit was reverted",
  section_reorganized: "sections were added, removed, or reordered",
  lead_promotion: "content moved from body into lead section",
  lead_demotion: "content moved from lead into body",
  page_moved: "the page was renamed",
  wikilink_added: "a new internal link was added",
  wikilink_removed: "an internal link was removed",
  category_added: "a category was added",
  category_removed: "a category was removed",
  protection_changed: "page protection level changed",
  talk_page_correlated: "a talk page discussion exists near this revision",
  talk_thread_opened: "a new talk thread was created",
  talk_thread_archived: "a thread was archived",
  talk_reply_added: "a reply was posted in a thread",
  template_parameter_changed: "a template parameter was modified",
  edit_cluster_detected: "multiple edits within a short window",
  talk_activity_spike: "talk page activity exceeds normal levels",
};

const POLICY_DIMS = ["verifiability", "npov", "blp", "due_weight", "protection", "edit_warring", "notability", "copyright", "civility"];
const DISCUSSION_TYPES = ["notability_challenge", "sourcing_dispute", "neutrality_concern", "content_deletion", "content_addition", "naming_dispute", "procedural", "other"];

const SYSTEM_PROMPT = `You are an expert Wikipedia editor classifying editorial activity. Return only valid JSON. For each event, provide:\n  semanticChange (string): what changed and why\n  confidence (number): 0.0–1.0\n  policyDimension (string, optional): one of ${POLICY_DIMS.join(", ")}\n  discussionType (string, optional): one of ${DISCUSSION_TYPES.join(", ")}`;

function buildPrompt(events: EvidenceEvent[], pageTitle: string): string {
  const byType: Record<string, number> = {};
  for (const e of events) byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;

  const lines: string[] = [
    `You are analyzing edit history events from the Wikipedia page "${pageTitle}".`,
    "For each event below, provide a structured interpretation in JSON:",
    "what changed semantically, your confidence (0.0–1.0), which Wikipedia policy",
    "dimension applies (if any), and the talk page discussion type (if any).",
    "",
    "Return a JSON array of objects.",
    "",
    `Total events: ${events.length}`,
    `Event type breakdown:`,
    ...Object.entries(byType).sort(([, a], [, b]) => b - a).map(([t, c]) => `  ${t}: ${c} — ${EVENT_DESCRIPTIONS[t] ?? ""}`),
    "",
    "Events:",
    ...events.map((e, i) => {
      const section = e.section ? ` [${e.section}]` : "";
      const facts = e.deterministicFacts.map((f) => `${f.fact}${f.detail ? `: ${f.detail}` : ""}`).join("; ");
      return `  ${i + 1}. ${e.eventType}${section} (rev ${e.fromRevisionId}→${e.toRevisionId})${facts ? ` — ${facts}` : ""}`;
    }),
  ];

  return lines.join("\n");
}

function parseResponse(text: string): ModelInterpretation[] {
  const cleaned = text.trim();
  let parsed: unknown;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) try { parsed = JSON.parse(match[0]); } catch { return []; }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item: unknown) => {
      if (typeof item !== "object" || item === null) return null;
      const obj = item as Record<string, unknown>;
      if (typeof obj.semanticChange !== "string" || typeof obj.confidence !== "number") return null;
      return {
        semanticChange: obj.semanticChange,
        confidence: Math.max(0, Math.min(1, obj.confidence)),
        ...(typeof obj.policyDimension === "string" ? { policyDimension: obj.policyDimension } : {}),
        ...(typeof obj.discussionType === "string" ? { discussionType: obj.discussionType } : {}),
      } as ModelInterpretation;
    })
    .filter((i): i is ModelInterpretation => i !== null);
}

interface InterpretResult {
  pageTitle: string;
  timestamp: string;
  totalEvents: number;
  interpretedCount: number;
  avgConfidence: number;
  modelUsed: string;
  events: (EvidenceEvent & { modelInterpretation: ModelInterpretation | undefined })[];
}

async function modelInterpretation(events: EvidenceEvent[], pageTitle: string, config: ProviderConfig): Promise<InterpretResult> {
  const prompt = buildPrompt(events, pageTitle);
  console.error(`Calling ${config.model} (${config.endpoint})...`);

  const raw = await callModel(config, SYSTEM_PROMPT, prompt, { temperature: 0.3, maxTokens: 4000 });
  const interpretations = parseResponse(raw);

  const merged = events.map((e, i) => ({
    ...e,
    eventId: e.eventId ?? `evt_${e.fromRevisionId}_${e.toRevisionId}_${i}`,
    modelInterpretation: interpretations[i] ?? undefined,
  }));

  const interpreted = merged.filter((e) => e.modelInterpretation);
  const avgConf = interpreted.length > 0
    ? interpreted.reduce((s, e) => s + (e.modelInterpretation?.confidence ?? 0), 0) / interpreted.length
    : 0;

  return {
    pageTitle,
    timestamp: new Date().toISOString(),
    modelUsed: `${config.model} (${config.endpoint})`,
    totalEvents: events.length,
    interpretedCount: interpreted.length,
    avgConfidence: Math.round(avgConf * 100) / 100,
    events: merged,
  };
}

function deterministicSummary(events: EvidenceEvent[], pageTitle: string): InterpretResult {
  return {
    pageTitle,
    timestamp: new Date().toISOString(),
    modelUsed: "none (deterministic fallback)",
    totalEvents: events.length,
    interpretedCount: 0,
    avgConfidence: 0,
    events: events.map((e, i) => ({
      ...e,
      eventId: e.eventId ?? `evt_${e.fromRevisionId}_${e.toRevisionId}_${i}`,
      modelInterpretation: undefined,
    })),
  };
}

async function main(): Promise<void> {
  const pageTitle = process.env.BYOI_PAGE_TITLE ?? "analyzed page";
  const events = await readEventsFromStdin();

  if (events.length === 0) {
    console.error("No events found. Pipe events via stdin:");
    console.error("  wikihistory export \"Bitcoin\" --format ndjson | bun run probe:byoi");
    console.error("Set REFRACT_INFERENCE_ENDPOINT for model interpretation, or omit for deterministic summary.");
    process.exit(1);
  }

  const config = getProvider();

  const result = config
    ? await modelInterpretation(events, pageTitle, config)
    : deterministicSummary(events, pageTitle);

  console.log(JSON.stringify(result, null, 2));
}

function readEventsFromStdin(): Promise<EvidenceEvent[]> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin });
    const events: EvidenceEvent[] = [];
    rl.on("line", (line) => {
      try { events.push(JSON.parse(line) as EvidenceEvent); } catch { }
    });
    rl.on("close", () => resolve(events));
    rl.on("error", reject);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
