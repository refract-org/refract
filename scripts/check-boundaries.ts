#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dir, "..");
const packagesDir = resolve(rootDir, "packages");

const errors: string[] = [];
const boundaryTerms = [
  "payer",
  "clinical",
  "regulatory",
  "guideline",
  "outcome-data",
  "decision threshold",
  "model interpretation",
  "model adapters",
  "model routing",
  "model consensus",
  "production-backtest",
  "healthcare decision",
  "source-weighting",
  "Review Brief",
  "formulary",
  "FDA",
  "ClinicalTrials",
  "PubMed",
  "materiality",
  "ticker",
  "pharma",
  "medical affairs",
  "clinical truth",
  "ratification",
  "economic stake",
  "feasibility",
];

function findFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "node_modules" || entry.name === "dist") continue;
        results.push(...findFiles(full, extensions));
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  } catch {
    // directory doesn't exist, skip
  }
  return results;
}

// ingestion must not import from analyzers (raw data access vs interpreted layers)
const ingestionDir = resolve(packagesDir, "ingestion", "src");
const ingestionFiles = findFiles(ingestionDir, [".ts"]);
for (const file of ingestionFiles) {
  const content = readFileSync(file, "utf-8");
  if (/from\s+["']@refract-org\/analyzers["']/.test(content)) {
    errors.push(`Boundary violation: ${file} imports from @refract-org/analyzers`);
  }
  if (/from\s+["']@refract-org\/evidence-graph["']/.test(content) && !/import type/.test(content)) {
    // evidence-graph types are fine, runtime imports are not
    if (/from\s+["']@refract-org\/evidence-graph["']\s*;/.test(content)) {
      errors.push(`Boundary violation: ${file} runtime imports from @refract-org/evidence-graph`);
    }
  }
}

const sourceBoundaryDirs = ["packages", "examples", "scripts"].map((dir) => resolve(rootDir, dir));
const sourceBoundaryFiles = sourceBoundaryDirs.flatMap((dir) =>
  findFiles(dir, [".ts", ".mts", ".js", ".mjs", ".json", ".md", ".sh"]),
);
const boundaryPattern = new RegExp(
  `\\b(${boundaryTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i",
);

for (const file of sourceBoundaryFiles) {
  if (file === import.meta.path) continue;
  const content = readFileSync(file, "utf-8");
  const match = content.match(boundaryPattern);
  if (match) {
    errors.push(`Boundary violation: ${file} contains domain-specific term "${match[0]}"`);
  }
}

if (errors.length > 0) {
  console.error("Architecture boundary violations found:");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log("Architecture boundaries clean.");
