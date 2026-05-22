import { WikimediaStreamClient } from "@refract-org/ingestion";

export async function runStream(pageTitle?: string, wiki?: string): Promise<void> {
  const filter: { wiki?: string; title?: string } = {};
  if (wiki) filter.wiki = wiki;
  if (pageTitle) filter.title = pageTitle;

  const client = new WikimediaStreamClient({ filter });

  console.log("Connected to Wikipedia EventStreams.");
  if (pageTitle) console.log(`Watching: ${pageTitle}`);
  if (wiki) console.log(`Wiki: ${wiki}`);
  console.log("Waiting for edits... (Ctrl+C to stop)\n");

  let count = 0;
  for await (const event of client.connect()) {
    count++;
    const ts = new Date(event.timestamp * 1000).toISOString();
    const icon = event.type === "new" ? "📄" : "✏️";
    console.log(`[${ts}] ${icon} ${event.title}`);
    console.log(`  rev ${event.revId} by ${event.user}: ${event.comment.slice(0, 120)}`);
    console.log(`  ${event.wiki} · ${count} events received`);
    console.log();
  }
}
