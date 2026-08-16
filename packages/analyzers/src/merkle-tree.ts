import { buildMerkleTree, hashLeaf } from "@refract-org/evidence-graph";

export { hashLeaf };

/** Compute a SHA-256 Merkle root from an array of leaf hashes. */
export function buildMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return hashLeaf("");
  return buildMerkleTree(leaves).at(-1)?.[0] ?? "";
}
