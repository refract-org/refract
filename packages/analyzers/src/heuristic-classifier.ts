import type { AnalyzerConfig } from "@refract-org/evidence-graph";

export type HeuristicKind =
  | "revert"
  | "vandalism"
  | "major_addition"
  | "major_removal"
  | "sourcing"
  | "cosmetic"
  | "minor"
  | "unknown";

export type HeuristicOptions = AnalyzerConfig["heuristic"];

export interface UserMetadata {
  /** Editor's total edit count across all pages at observation time. */
  editCount?: number;
  /** Days since editor registered at observation time. */
  registrationAgeDays?: number;
}

const DEFAULT_VANDALISM_PATTERNS: RegExp[] = [/\b(vandal|vandalism|spam|blanking|test edit)\b/i];
const DEFAULT_SOURCING_PATTERNS: RegExp[] = [/\b(cite|ref|source|reference|citation|add ref|rm ref)\b/i];
const REVERT_PATTERNS = /\b(rv|revert|reverted|undo|undid|rollback|rvv)\b/i;

const DEFAULT_MAJOR_ADDITION = 2000;
const DEFAULT_MAJOR_REMOVAL = -2000;
const DEFAULT_COSMETIC = 20;
const DEFAULT_MINOR = 100;

export function classifyHeuristic(
  comment: string,
  sizeDelta: number,
  options?: AnalyzerConfig["heuristic"],
): HeuristicKind {
  const norm = comment.toLowerCase().trim();

  if (REVERT_PATTERNS.test(norm)) {
    return "revert";
  }

  const vandalismPatterns = options?.vandalismPatterns ?? DEFAULT_VANDALISM_PATTERNS;
  if (vandalismPatterns.some((p) => p.test(norm))) {
    return "vandalism";
  }

  const sourcingPatterns = options?.sourcingPatterns ?? DEFAULT_SOURCING_PATTERNS;
  if (sourcingPatterns.some((p) => p.test(norm))) {
    return "sourcing";
  }

  if (sizeDelta > (options?.majorAdditionThreshold ?? DEFAULT_MAJOR_ADDITION)) {
    return "major_addition";
  }

  if (sizeDelta < (options?.majorRemovalThreshold ?? DEFAULT_MAJOR_REMOVAL)) {
    return "major_removal";
  }

  if (Math.abs(sizeDelta) < (options?.cosmeticThreshold ?? DEFAULT_COSMETIC) && !norm) {
    return "cosmetic";
  }

  if (Math.abs(sizeDelta) < (options?.minorThreshold ?? DEFAULT_MINOR)) {
    return "minor";
  }

  return "unknown";
}
