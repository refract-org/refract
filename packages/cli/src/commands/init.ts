import { sectionDiffer } from "@refract-org/analyzers";
import { MediaWikiClient } from "@refract-org/ingestion";

export async function runInit(): Promise<void> {
  console.log();
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║       Refract — claim-history       ║");
  console.log("  ║       layer for public knowledge     ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log();
  console.log("  Refract observes how Wikipedia pages change over time.");
  console.log('  It answers "what changed?" — deterministically, reproducibly.');
  console.log();
  console.log('  Running a quick analysis of "Earth" to show you what it does...');
  console.log();

  try {
    const client = new MediaWikiClient();
    const revisions = await client.fetchRevisions("Earth", { limit: 5 });
    console.log(`  Fetched ${revisions.length} revisions of "Earth".`);
    console.log(`  Latest: ${revisions[revisions.length - 1].timestamp}`);

    const allChanges = [];
    for (let i = 1; i < revisions.length; i++) {
      allChanges.push(
        ...sectionDiffer.diffSections(
          sectionDiffer.extractSections(revisions[i - 1].content),
          sectionDiffer.extractSections(revisions[i].content),
        ),
      );
    }

    const types = [...new Set(allChanges.map((c) => c.changeType))];
    console.log(`  Found ${allChanges.length} section changes (${types.join(", ")})`);
  } catch {
    console.log("  (Could not fetch live data — offline mode)");
  }

  console.log();
  console.log("  ── What's next ──");
  console.log();
  console.log("  Analyze any page:");
  console.log('    refract analyze "Bitcoin" --depth detailed');
  console.log();
  console.log("  View results in a browser:");
  console.log('    refract explore "Bitcoin"');
  console.log();
  console.log("  Track a specific claim:");
  console.log('    refract claim "Bitcoin" --text "decentralized digital currency"');
  console.log();
  console.log("  See what a page said on a specific date:");
  console.log('    refract snapshot "Bitcoin" --at 2024-01-15');
  console.log();
  console.log("  Monitor for changes:");
  console.log("    refract cron pages.txt --interval 24 --notify-slack");
  console.log();
  console.log("  Connect an AI agent:");
  console.log("    refract mcp");
  console.log();
  console.log("  Full docs: https://refract-org.github.io/refract-docs");
  console.log();
}
