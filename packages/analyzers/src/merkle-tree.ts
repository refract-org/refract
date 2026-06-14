import { createHash } from "node:crypto";

/** Compute a SHA-256 leaf hash for a UTF-8 string. */
export function hashLeaf(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Compute a deterministic pair hash (commutative ordering). */
function hashPair(a: string, b: string): string {
  // Sort pair so hashPair(a,b) === hashPair(b,a).
  const combined = a < b ? `${a}${b}` : `${b}${a}`;
  return createHash("sha256").update(combined, "utf8").digest("hex");
}

/**
 * Build a SHA-256 Merkle root from an array of leaf hashes.
 * An empty array yields the hash of an empty leaf.
 * Odd-length levels promote the last hash unchanged.
 */
export function buildMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return hashLeaf("");

  let current = [...leaves];
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        next.push(hashPair(current[i], current[i + 1]));
      } else {
        next.push(current[i]);
      }
    }
    current = next;
  }

  return current[0] ?? "";
}
