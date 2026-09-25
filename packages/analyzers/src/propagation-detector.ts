/**
 * Deterministic text propagation and borrowing detector.
 * Identifies shared passages, boilerplate text, and near-duplicate
 * content across independent document revisions using n-gram shingling
 * and token-span matching.
 */

export interface PropagationOptions {
  /** Shingle length in tokens for n-gram Jaccard similarity. Default: 5 */
  shingleSize?: number;
  /** Minimum token length for an extracted contiguous borrowed span. Default: 8 */
  minSpanTokens?: number;
  /** Jaccard similarity threshold to mark as significant borrowing. Default: 0.15 */
  significanceThreshold?: number;
}

export interface TextBorrowingSpan {
  text: string;
  tokenCount: number;
  sourceIndex: number;
  targetIndex: number;
}

export interface TextPropagationResult {
  jaccardSimilarity: number;
  sharedTokenCount: number;
  borrowedSpans: TextBorrowingSpan[];
  isSignificantBorrowing: boolean;
}

function tokenize(text: string): { tokens: string[]; offsets: number[] } {
  const tokens: string[] = [];
  const offsets: number[] = [];
  const re = /[^\s\p{P}]+|\p{P}+/gu;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex loop
  while ((match = re.exec(text)) !== null) {
    tokens.push(match[0].toLowerCase());
    offsets.push(match.index);
  }

  return { tokens, offsets };
}

function buildShingles(tokens: string[], k: number): Set<string> {
  const shingles = new Set<string>();
  if (tokens.length < k) {
    if (tokens.length > 0) {
      shingles.add(tokens.join(" "));
    }
    return shingles;
  }

  for (let i = 0; i <= tokens.length - k; i++) {
    shingles.add(tokens.slice(i, i + k).join(" "));
  }

  return shingles;
}

/**
 * Compares two texts to detect borrowed spans and measure verbatim/near-verbatim propagation.
 */
export function detectTextPropagation(
  sourceText: string,
  targetText: string,
  options?: PropagationOptions,
): TextPropagationResult {
  const shingleSize = options?.shingleSize ?? 5;
  const minSpanTokens = options?.minSpanTokens ?? 8;
  const significanceThreshold = options?.significanceThreshold ?? 0.15;

  const src = tokenize(sourceText);
  const tgt = tokenize(targetText);

  if (src.tokens.length === 0 || tgt.tokens.length === 0) {
    return {
      jaccardSimilarity: 0,
      sharedTokenCount: 0,
      borrowedSpans: [],
      isSignificantBorrowing: false,
    };
  }

  // Jaccard similarity of k-shingles
  const srcShingles = buildShingles(src.tokens, shingleSize);
  const tgtShingles = buildShingles(tgt.tokens, shingleSize);

  let intersectionSize = 0;
  for (const sh of srcShingles) {
    if (tgtShingles.has(sh)) {
      intersectionSize++;
    }
  }

  const unionSize = srcShingles.size + tgtShingles.size - intersectionSize;
  const jaccard = unionSize > 0 ? intersectionSize / unionSize : 0;

  // Find contiguous matching spans
  const borrowedSpans: TextBorrowingSpan[] = [];
  let sIdx = 0;

  while (sIdx < src.tokens.length) {
    let bestMatchLen = 0;
    let bestTgtIdx = -1;

    for (let tIdx = 0; tIdx < tgt.tokens.length; tIdx++) {
      let len = 0;
      while (
        sIdx + len < src.tokens.length &&
        tIdx + len < tgt.tokens.length &&
        src.tokens[sIdx + len] === tgt.tokens[tIdx + len]
      ) {
        len++;
      }

      if (len > bestMatchLen) {
        bestMatchLen = len;
        bestTgtIdx = tIdx;
      }
    }

    if (bestMatchLen >= minSpanTokens && bestTgtIdx !== -1) {
      const startChar = src.offsets[sIdx];
      const endTokenIdx = sIdx + bestMatchLen - 1;
      const endChar = src.offsets[endTokenIdx] + src.tokens[endTokenIdx].length;
      const spanText = sourceText.slice(startChar, endChar);

      borrowedSpans.push({
        text: spanText,
        tokenCount: bestMatchLen,
        sourceIndex: startChar,
        targetIndex: tgt.offsets[bestTgtIdx],
      });

      sIdx += bestMatchLen;
    } else {
      sIdx++;
    }
  }

  const totalSharedTokens = borrowedSpans.reduce((sum, sp) => sum + sp.tokenCount, 0);

  return {
    jaccardSimilarity: Number(jaccard.toFixed(4)),
    sharedTokenCount: totalSharedTokens,
    borrowedSpans,
    isSignificantBorrowing: jaccard >= significanceThreshold || totalSharedTokens >= minSpanTokens * 2,
  };
}
