import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { readFileSync } from "node:fs";

export function loadEvents(path: string): EvidenceEvent[] {
  const raw = readFileSync(path, "utf-8");
  return raw
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => JSON.parse(line) as EvidenceEvent);
}
