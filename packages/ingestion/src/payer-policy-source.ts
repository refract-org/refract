import { readFileSync } from "node:fs";

/**
 * A single coverage decision extracted from a policy document.
 * The text is treated as an opaque, normalized string: the adapter does not
 * interpret domain-specific meaning.
 */
export interface CoverageDecision {
  id: string;
  text: string;
}

/**
 * Normalized view of a payer or regional policy document.
 */
export interface PolicyDocument {
  payerId: string;
  region: string;
  effectiveDate: string; // ISO 8601 date (YYYY-MM-DD)
  documentVersion: string;
  coverageDecisions: CoverageDecision[];
  provenanceUrl: string;
}

/**
 * Pluggable extractor for converting raw bytes (e.g. PDF) into normalized
 * plain text. Consumers can inject a heavy PDF parser; the default adapter
 * operates directly on already-extracted text.
 */
export interface TextExtractor {
  extract(text: string): string;
}

export interface PayerPolicySourceOptions {
  textExtractor?: TextExtractor;
}

export interface IngestInput {
  url?: string;
  path?: string;
  text?: string;
  payerId?: string;
  region?: string;
  effectiveDate?: string;
  documentVersion?: string;
  provenanceUrl?: string;
}

const DEFAULT_VERSION = "1.0.0";
const DEFAULT_DATE = "1970-01-01";

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n[\t ]+/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractFilename(input: string): string {
  if (!input || input === "inline") return "inline";
  try {
    const url = new URL(input);
    return url.pathname.split("/").pop() ?? input;
  } catch {
    return input.split(/[\\/]/).pop() ?? input;
  }
}

function extractDateFromFilename(filename: string): string | undefined {
  const isoMatch = filename.match(/(\d{4})[-_.](\d{2})[-_.](\d{2})/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
  }

  const usMatch = filename.match(/(\d{2})[-_.](\d{2})[-_.](\d{4})/);
  if (usMatch) {
    const month = Number.parseInt(usMatch[1], 10);
    const day = Number.parseInt(usMatch[2], 10);
    const year = Number.parseInt(usMatch[3], 10);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${usMatch[3]}-${usMatch[1]}-${usMatch[2]}`;
    }
  }

  return undefined;
}

function extractVersionFromFilename(filename: string): string | undefined {
  const match = filename.match(/[vV]ersion[_-]?(\d+(?:\.\d+)*)/) ?? filename.match(/[vV](\d+(?:\.\d+)*)/);
  if (match) return match[1];

  const dateVersion = filename.match(/(\d{4}[-_.]\d{2}[-_.]\d{2})/);
  if (dateVersion) return dateVersion[1].replace(/[_.]/g, "-");

  return undefined;
}

function extractMetadata(text: string, key: string): string | undefined {
  const pattern = new RegExp(`^${key}\\s*[:=]\\s*(.+)$`, "im");
  const match = text.match(pattern);
  return match ? match[1].trim() : undefined;
}

function derivePayerId(text: string, provided?: string): string {
  if (provided) return slugify(provided);
  const fromMeta = extractMetadata(text, "payer\\s*id");
  if (fromMeta) return slugify(fromMeta);
  return "unknown";
}

function deriveRegion(text: string, provided?: string): string {
  if (provided) return slugify(provided);
  const fromMeta = extractMetadata(text, "region");
  if (fromMeta) return slugify(fromMeta);
  return "unknown";
}

function deriveEffectiveDate(filename: string, text: string, provided?: string): string {
  if (provided) return provided;
  const fromMeta = extractMetadata(text, "effective\\s*date");
  if (fromMeta) {
    const iso = normalizeDate(fromMeta);
    if (iso) return iso;
  }
  return extractDateFromFilename(filename) ?? DEFAULT_DATE;
}

function deriveDocumentVersion(filename: string, text: string, provided?: string): string {
  if (provided) return provided;
  const fromMeta = extractMetadata(text, "document\\s*version");
  if (fromMeta) return fromMeta.trim();
  return extractVersionFromFilename(filename) ?? DEFAULT_VERSION;
}

function normalizeDate(value: string): string | undefined {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return value;
    }
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = Number.parseInt(slashMatch[1], 10);
    const day = Number.parseInt(slashMatch[2], 10);
    const year = Number.parseInt(slashMatch[3], 10);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return undefined;
}

function deterministicHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function isStructuralHeader(line: string): boolean {
  return /^(payer\s*id|region|effective\s*date|document\s*version|provenance|notes?)\s*[:=]/i.test(line);
}

function extractDecisions(text: string): CoverageDecision[] {
  const normalized = normalizeWhitespace(text);
  const lines = normalized.split("\n");
  const decisions = new Map<string, CoverageDecision>();

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.length < 10) continue;
    if (isStructuralHeader(trimmed)) continue;
    if (/^#+\s/.test(trimmed)) continue;

    if (/^[-*•]|\d+\.[\t ]/.test(trimmed)) {
      const withoutMarker = trimmed.replace(/^[-*•]\s*|\d+\.[\t ]*/, "").trim();
      if (withoutMarker.length < 5) continue;
      const id = deterministicHash(withoutMarker);
      decisions.set(id, { id, text: withoutMarker });
    }
  }

  return Array.from(decisions.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export class PayerPolicySource {
  private textExtractor: TextExtractor;

  constructor(options: PayerPolicySourceOptions = {}) {
    this.textExtractor = options.textExtractor ?? {
      extract: (text) => normalizeWhitespace(text),
    };
  }

  async ingest(input: string | IngestInput): Promise<PolicyDocument> {
    const options: IngestInput = typeof input === "string" ? { text: input } : input;

    let rawText = options.text ?? "";
    let sourceHint = "inline";
    let provenanceUrl = options.provenanceUrl;

    if (options.url) {
      sourceHint = options.url;
      provenanceUrl ??= options.url;
      rawText = await this.fetchText(options.url);
    } else if (options.path) {
      sourceHint = options.path;
      provenanceUrl ??= `file://${options.path}`;
      rawText = readFileSync(options.path, "utf-8");
    }

    if (!rawText.trim()) {
      throw new Error("No policy text could be extracted from input");
    }

    const extracted = this.textExtractor.extract(rawText);
    const filename = extractFilename(sourceHint);

    return {
      payerId: derivePayerId(extracted, options.payerId),
      region: deriveRegion(extracted, options.region),
      effectiveDate: deriveEffectiveDate(filename, extracted, options.effectiveDate),
      documentVersion: deriveDocumentVersion(filename, extracted, options.documentVersion),
      coverageDecisions: extractDecisions(extracted),
      provenanceUrl: provenanceUrl ?? "inline://text",
    };
  }

  private async fetchText(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch policy document: ${response.status} ${response.statusText} (${url})`);
    }
    return response.text();
  }
}
