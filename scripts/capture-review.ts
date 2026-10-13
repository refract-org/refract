import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { acknowledgeReview, observeReview, renderReview } from "../packages/cli/src/commands/review.js";

const dir = mkdtempSync(join(tmpdir(), "refract-review-capture-"));
try {
  const partial = await observeReview([], {sample:true, from:1, limit:2, stateDir:dir});
  if (!partial.pages[0].coverage.truncated) throw new Error("Expected a resumable sample window.");
  const report = await observeReview([], {sample:true, limit:2, stateDir:dir});
  if (report.pages[0].coverage.status !== "complete") throw new Error("Sample review did not complete.");
  const artifacts = {
    "review.json": `${JSON.stringify(report,null,2)}\n`,
    "review.md": renderReview(report,{},"./review-state"),
    "review-citations.md": renderReview(report,{eventTypes:["citation_removed"]},"./review-state"),
  };
  await acknowledgeReview(report.reportId,dir);
  if ((await observeReview([], {sample:true,stateDir:dir})).pages[0].status !== "no_changes") {
    throw new Error("Acknowledged sample is still pending.");
  }
  for (const [name, content] of Object.entries(artifacts)) {
    const path = resolve("docs/examples",name);
    if (process.argv.includes("--check")) {
      if (readFileSync(path,"utf8") !== content) throw new Error(`${name} differs; regenerate with bun scripts/capture-review.ts`);
    } else writeFileSync(path,content);
  }
  console.log(process.argv.includes("--check") ? "Review artifacts match." : "Captured fictional review workflow.");
} finally { rmSync(dir,{recursive:true,force:true}); }
