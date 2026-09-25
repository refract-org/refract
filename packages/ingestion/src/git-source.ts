import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { Revision } from "@refract-org/evidence-graph";
import type { RevisionOptions, RevisionSource } from "./index.js";

export interface GitRevisionSourceOptions {
  repoPath: string;
}

/**
 * Ingests revisions of a file tracked in a Git repository.
 * Enables tracking provenance across version-controlled documents,
 * specifications, statutes, and markdown repositories.
 */
export class GitRevisionSource implements RevisionSource {
  private repoPath: string;

  constructor(options: GitRevisionSourceOptions) {
    this.repoPath = options.repoPath;
  }

  async *revisions(filePath: string, options?: RevisionOptions): AsyncIterable<Revision> {
    if (!existsSync(this.repoPath)) {
      return;
    }

    // List commits modifying this file in chronological order (oldest first: --reverse)
    let logOutput: string;
    try {
      logOutput = execFileSync("git", ["log", "--reverse", "--follow", "--format=%H%x00%aI%x00%s", "--", filePath], {
        cwd: this.repoPath,
        encoding: "utf-8",
        maxBuffer: 20 * 1024 * 1024,
      });
    } catch {
      return;
    }

    const lines = logOutput.trim().split("\n").filter(Boolean);
    let revIndex = 1;
    let count = 0;

    for (const line of lines) {
      const parts = line.split("\0");
      if (parts.length < 3) continue;

      const [commitHash, isoDate, subject] = parts;
      const tsDate = new Date(isoDate);

      if (options?.start && tsDate < options.start) continue;
      if (options?.end && tsDate > options.end) continue;

      const revId = revIndex++;
      if (options?.startRevId && revId < options.startRevId) continue;
      if (options?.endRevId && revId > options.endRevId) continue;

      // Fetch file content at this commit
      let content = "";
      try {
        content = execFileSync("git", ["show", `${commitHash}:${filePath}`], {
          cwd: this.repoPath,
          encoding: "utf-8",
          maxBuffer: 20 * 1024 * 1024,
        });
      } catch {
        // File may not have existed or was deleted at this commit
        continue;
      }

      yield {
        revId,
        pageId: 1,
        pageTitle: filePath,
        timestamp: isoDate,
        comment: `[${commitHash.slice(0, 7)}] ${subject}`,
        content,
        size: content.length,
        minor: false,
      };

      count++;
      if (options?.limit && count >= options.limit) break;
    }
  }
}
