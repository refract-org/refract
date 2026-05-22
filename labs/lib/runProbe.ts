import type { EvidenceEvent } from "@refract-org/evidence-graph";
import { loadEvents } from "./loadEvents.js";

export async function runProbe<T>(
  usage: string,
  analyze: (events: EvidenceEvent[], page: string) => Promise<T>,
): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(usage);
    process.exit(1);
  }
  const events = loadEvents(args[0]);
  const result = await analyze(events, args[1] ?? "");
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
