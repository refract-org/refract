// Semantic enrichment — deterministic text analysis for evidence events
// No model. No API. Byte-reproducible on every run.

import type { CertaintyProfile, DirectionSignal, QuantitativeFinding } from "@refract-org/evidence-graph";

const CERTAINTY_PATTERNS = {
  high: [/demonstrat\w*/i, /prove\w*/i, /confirm\w*/i, /establish\w*/i, /significantly/i, /robust/i, /definitive/i],
  medium: [/suggest\w*/i, /indicat\w*/i, /appear\w*/i, /likely/i, /consistent with/i, /evidence/i],
  low: [
    /may /i,
    /might /i,
    /could /i,
    /possibly/i,
    /potentially/i,
    /preliminary/i,
    /limited/i,
    /unclear/i,
    /inconclusive/i,
  ],
  hedging: [/however/i, /although/i, /despite/i, /while/i, /nevertheless/i],
};

const QUANTITATIVE_PATTERNS: Array<{ name: string; regex: RegExp; extract: (m: RegExpMatchArray) => string }> = [
  { name: "pvalue", regex: /[pP]\s*[<>=]\s*0?\.\d+/g, extract: (m) => m[0] },
  { name: "hazardRatio", regex: /HR\s*[=:]\s*\d+\.\d+/gi, extract: (m) => m[0] },
  { name: "nvalue", regex: /[nN]\s*=\s*\d[\d,]*/g, extract: (m) => m[0] },
  { name: "confidenceInterval", regex: /(\d+\.\d+)[–-](\d+\.\d+)/g, extract: (m) => m[0] },
  { name: "percentage", regex: /\d+(?:\.\d+)?%/g, extract: (m) => m[0] },
  {
    name: "count",
    regex: /\b\d{2,}\b\s*(patients|subjects|participants|events|deaths|hospitalizations)/gi,
    extract: (m) => m[0],
  },
];

export function computeCertaintyProfile(text: string): CertaintyProfile {
  let high = 0,
    medium = 0,
    low = 0,
    hedging = 0;
  for (const p of CERTAINTY_PATTERNS.high) high += (text.match(p) || []).length;
  for (const p of CERTAINTY_PATTERNS.medium) medium += (text.match(p) || []).length;
  for (const p of CERTAINTY_PATTERNS.low) low += (text.match(p) || []).length;
  for (const p of CERTAINTY_PATTERNS.hedging) hedging += (text.match(p) || []).length;
  return { high, medium, low, hedging };
}

export function computeDirectionSignal(
  beforeProfile: CertaintyProfile,
  afterProfile: CertaintyProfile,
): DirectionSignal {
  const beforeHigh = beforeProfile.high;
  const afterHigh = afterProfile.high;
  const beforeLow = beforeProfile.low;
  const afterLow = afterProfile.low;

  if (afterHigh > beforeHigh + 1) return "strengthening";
  if (afterLow > beforeLow + 1 && afterHigh < beforeHigh) return "weakening";
  return "neutral";
}

export function extractQuantitativeFindings(text: string): QuantitativeFinding[] {
  const findings: QuantitativeFinding[] = [];
  for (const { name, regex } of QUANTITATIVE_PATTERNS) {
    const matches = text.matchAll(regex);
    for (const m of matches) {
      findings.push({ type: name, value: m[0], raw: m[0] });
    }
  }
  return findings;
}

export function computeEditMagnitude(beforeLength: number, afterLength: number) {
  const maxLen = Math.max(beforeLength, afterLength);
  if (maxLen > 200) return "major" as const;
  if (maxLen > 80) return "moderate" as const;
  return "minor" as const;
}

export function computeContentChange(eventType: string, before: string, after: string) {
  if (eventType === "sentence_first_seen") return "introduction" as const;
  if (eventType === "sentence_removed") return "removal" as const;
  const ratio = after.length / Math.max(before.length, 1);
  if (ratio > 1.5) return "expansion" as const;
  if (ratio < 0.5) return "compression" as const;
  if (after.includes(before.substring(0, Math.min(20, before.length)))) return "refinement" as const;
  return "rewrite" as const;
}

export function extractKeyTerms(text: string): string[] {
  const patterns = [
    /\b\w{6,}\b/g, // Words 6+ chars (filters noise)
  ];
  const terms = new Set<string>();
  for (const p of patterns) {
    for (const m of text.matchAll(p)) {
      const term = m[0].toLowerCase();
      if (
        !/^(which|that|this|these|those|their|with|from|have|been|were|about|after|before|during|between|through|because|however|although|therefore|nevertheless|furthermore|additionally|importantly|significantly|typically|generally|usually|commonly|frequently|approximately|estimated|reported|published|described|identified|demonstrated|confirmed|suggested|indicated|appeared|appears|showed|shows|found|finding|findings|noted|noting|observed|observing|concluded|concluding|compared|comparing|included|including|excluded|excluding|received|receiving|treated|treating|followed|following)/.test(
          term,
        )
      ) {
        terms.add(term);
      }
    }
  }
  return [...terms].slice(0, 15); // Limit to top 15
}
