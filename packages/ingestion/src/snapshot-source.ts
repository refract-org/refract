import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Revision } from "@refract-org/evidence-graph";
import type { RevisionOptions, RevisionSource } from "./index.js";

export interface SnapshotItem {
  timestamp: string;
  content: string;
  comment?: string;
  id?: number;
}

/**
 * Ingests revisions from a directory of timestamped snapshot files,
 * or an explicit list of snapshot records. Useful for versioned
 * document archives, public records, and time-stamped text files.
 */
export class SnapshotDirectorySource implements RevisionSource {
  private baseDir?: string;
  private inMemorySnapshots?: Map<string, SnapshotItem[]>;

  constructor(options: { baseDir?: string; snapshots?: Map<string, SnapshotItem[]> | Record<string, SnapshotItem[]> }) {
    this.baseDir = options.baseDir;
    if (options.snapshots) {
      if (options.snapshots instanceof Map) {
        this.inMemorySnapshots = options.snapshots;
      } else {
        this.inMemorySnapshots = new Map(Object.entries(options.snapshots));
      }
    }
  }

  async *revisions(pageTitle: string, options?: RevisionOptions): AsyncIterable<Revision> {
    const items: SnapshotItem[] = [];

    if (this.inMemorySnapshots?.has(pageTitle)) {
      items.push(...(this.inMemorySnapshots.get(pageTitle) ?? []));
    } else if (this.baseDir && existsSync(this.baseDir)) {
      // Look for files under baseDir or baseDir/pageTitle
      const targetDir = join(this.baseDir, pageTitle);
      const searchDir = existsSync(targetDir) && statSync(targetDir).isDirectory() ? targetDir : this.baseDir;

      try {
        const fileNames = readdirSync(searchDir)
          .filter((name) => !name.startsWith("."))
          .sort();

        let autoId = 1;
        for (const name of fileNames) {
          const fullPath = join(searchDir, name);
          const st = statSync(fullPath);
          if (st.isDirectory()) continue;

          // Attempt to extract timestamp from filename (e.g. 2026-01-15_doc.txt) or fallback to mtime
          const dateMatch = name.match(/(\d{4}-\d{2}-\d{2}(?:T\d{2}[-:]\d{2}[-:]\d{2}(?:\.\d+)?Z?)?)/);
          const timestamp = dateMatch
            ? new Date(dateMatch[1].replace(/_/g, "T")).toISOString()
            : st.mtime.toISOString();

          const content = readFileSync(fullPath, "utf-8");
          items.push({
            id: autoId++,
            timestamp,
            content,
            comment: `Snapshot file: ${name}`,
          });
        }
      } catch {
        // Directory read error or non-existent
      }
    }

    // Sort chronologically
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let count = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const tsDate = new Date(item.timestamp);

      if (options?.start && tsDate < options.start) continue;
      if (options?.end && tsDate > options.end) continue;

      const revId = item.id ?? i + 1;
      if (options?.startRevId && revId < options.startRevId) continue;
      if (options?.endRevId && revId > options.endRevId) continue;

      yield {
        revId,
        pageId: 1,
        pageTitle,
        timestamp: item.timestamp,
        comment: item.comment ?? "",
        content: item.content,
        size: item.content.length,
        minor: false,
      };

      count++;
      if (options?.limit && count >= options.limit) break;
    }
  }
}
