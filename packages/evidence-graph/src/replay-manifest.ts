import { createHash } from "node:crypto";
import { createEventIdentity } from "./hash-identity.js";
import type { EvidenceEvent } from "./schemas/evidence.js";
import type { Revision } from "./schemas/revision.js";

export interface MerkleProof {
  leafHash: string;
  leafIndex: number;
  siblings: string[];
  rootHash: string;
}

export interface ReplayManifest {
  format: "refract-replay-manifest/v1";
  generatedAt: string;
  pageTitle: string;
  analyzerVersions: Record<string, string>;
  inputRevisionHashes: string[];
  outputEventHashes: string[];
  merkleRoot: string;
  manifestHash: string;
}

export function hashLeaf(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function hashPair(a: string, b: string): string {
  return createHash("sha256")
    .update(a < b ? a + b : b + a)
    .digest("hex");
}

export function buildMerkleTree(hashes: string[]): string[][] {
  if (hashes.length === 0) return [[""]];
  const levels: string[][] = [hashes];
  let current = hashes;
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        next.push(hashPair(current[i], current[i + 1]));
      } else {
        next.push(current[i]);
      }
    }
    levels.push(next);
    current = next;
  }
  return levels;
}

export function getMerkleProof(levels: string[][], leafIndex: number): MerkleProof {
  const leafHash = levels[0][leafIndex];
  if (!leafHash) throw new Error(`Leaf index ${leafIndex} out of range`);
  const siblings: string[] = [];
  let idx = leafIndex;
  for (let level = 0; level < levels.length - 1; level++) {
    const isLeft = idx % 2 === 0;
    const siblingIdx = isLeft ? idx + 1 : idx - 1;
    if (siblingIdx < levels[level].length) {
      siblings.push(levels[level][siblingIdx]);
    }
    idx = Math.floor(idx / 2);
  }
  const root = levels[levels.length - 1];
  return {
    leafHash,
    leafIndex,
    siblings,
    rootHash: root[0] ?? "",
  };
}

export function verifyMerkleProof(proof: MerkleProof): boolean {
  let hash = proof.leafHash;
  for (const sibling of proof.siblings) {
    hash = hashPair(hash, sibling);
  }
  return hash === proof.rootHash;
}

export function createReplayManifest(params: {
  pageTitle: string;
  analyzerVersions: Record<string, string>;
  revisions: Revision[];
  events: EvidenceEvent[];
  generatedAt?: string;
}): ReplayManifest {
  const inputHashes = params.revisions.map((r) => createHash("sha256").update(r.content).digest("hex"));

  const outputHashes = params.events.map((e) => e.eventId ?? createEventIdentity(e));

  const merkleRoot = buildMerkleTree(outputHashes).at(-1)?.[0] ?? "";

  const partial = {
    format: "refract-replay-manifest/v1" as const,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    pageTitle: params.pageTitle,
    analyzerVersions: params.analyzerVersions,
    inputRevisionHashes: inputHashes,
    outputEventHashes: outputHashes,
    merkleRoot,
  };

  const manifestHash = createHash("sha256").update(JSON.stringify(partial)).digest("hex");

  return { ...partial, manifestHash };
}

export function singleEventProof(manifest: ReplayManifest, eventIndex: number): MerkleProof {
  const levels = buildMerkleTree(manifest.outputEventHashes);
  return getMerkleProof(levels, eventIndex);
}
