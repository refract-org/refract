import type { AnalyzerConfig, EvidenceEvent, Revision } from "@refract-org/evidence-graph";

const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_MIN_CLUSTER_SIZE = 3;

export type EditClusterOptions = AnalyzerConfig["editCluster"];

export interface EditCluster {
  revisionIds: number[];
  timestamp: string;
  editor?: string;
  section?: string;
  eventCount: number;
}

export function detectEditClusters(revisions: Revision[], options?: AnalyzerConfig["editCluster"]): EvidenceEvent[] {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const minSize = options?.minSize ?? DEFAULT_MIN_CLUSTER_SIZE;
  const events: EvidenceEvent[] = [];

  if (revisions.length < minSize) return events;

  const sorted = [...revisions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const clustered = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (clustered.has(i)) continue;

    const windowStart = new Date(sorted[i].timestamp).getTime();
    const windowEnd = windowStart + windowMs;
    const cluster: number[] = [];

    for (let j = i; j < sorted.length; j++) {
      const t = new Date(sorted[j].timestamp).getTime();
      if (t <= windowEnd) {
        cluster.push(j);
      } else {
        break;
      }
    }

    if (cluster.length >= minSize) {
      const hasSingleEditor = singleEditorCluster(sorted, cluster);
      const editorCount = uniqueEditorCount(sorted, cluster);
      for (const idx of cluster) clustered.add(idx);

      events.push({
        eventType: "edit_cluster_detected",
        fromRevisionId: sorted[cluster[0]].revId,
        toRevisionId: sorted[cluster[cluster.length - 1]].revId,
        section: "",
        before: "",
        after: "",
        deterministicFacts: [
          {
            fact: "edit_cluster",
            detail: `revisions=${cluster.length} editors=${editorCount} window_ms=${windowMs} single_editor=${hasSingleEditor}`,
          },
        ],
        layer: "observed",
        timestamp: sorted[cluster[0]].timestamp,
      });
    }
  }

  return events;
}

function singleEditorCluster(revisions: Revision[], indices: number[]): boolean {
  const firstUser = revisions[indices[0]].user;
  if (!firstUser) return false;
  return indices.every((i) => revisions[i].user === firstUser);
}

function uniqueEditorCount(revisions: Revision[], indices: number[]): number {
  const editors = new Set<string>();
  for (const i of indices) {
    if (revisions[i].user) editors.add(revisions[i].user);
  }
  return editors.size;
}
