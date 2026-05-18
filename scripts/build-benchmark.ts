/**
 * Build a model evaluation dataset from Refract output.
 *
 * Usage: bun scripts/build-benchmark.ts
 *
 * Analyzes the 10 standard benchmark pages, exports NDJSON events,
 * and writes a summary dataset.json with leakage records.
 */

import { $ } from "bun";

const PAGES = [
  "COVID-19",
  "Bitcoin",
  "GPT-4",
  "Climate_change",
  "Donald_Trump",
  "CRISPR",
  "COVID-19_pandemic",
  "Russia",
  "Tesla,_Inc.",
  "Earth",
];

const CUTOFFS = [
  { model: "GPT-4o", date: "2024-06-01" },
  { model: "Claude 3.5 Sonnet", date: "2024-04-01" },
  { model: "Gemini 1.5 Pro", date: "2023-11-01" },
];

console.log("Building benchmark dataset...\n");
console.log(`Pages: ${PAGES.length}`);
console.log(`Cutoffs: ${CUTOFFS.length}\n`);

const OUT = "benchmarks";

await $`mkdir -p ${OUT}`;

for (const page of PAGES) {
  const safe = page.replace(/[ ,]/g, "_");
  const path = `${OUT}/${safe}.jsonl`;

  const exists = await Bun.file(path).exists();
  if (exists) {
    console.log(`  SKIP  ${page} (already cached)`);
    continue;
  }

  console.log(`  FETCH ${page}...`);
  await $`bun packages/cli/src/index.ts analyze ${page} --depth forensic -c`.quiet();
  await $`bun packages/cli/src/index.ts export ${page} --format ndjson > ${path}`.quiet();
  console.log(`  DONE  ${page} → ${path}`);
}

console.log("\nAll pages analyzed. Run the eval adapter to build leakage records:");
console.log("  python -c \"from refract_eval import build_leakage_benchmark; ...\"");
console.log("\nOr contribute results to benchmarks/LEADERBOARD.md");
