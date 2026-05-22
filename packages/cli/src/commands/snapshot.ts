import { stripWikitext } from "@refract-org/analyzers";
import type { AuthConfig } from "@refract-org/ingestion";
import { MediaWikiClient } from "@refract-org/ingestion";
import { saveRevisions } from "./cache.js";

export async function runSnapshot(
  pageTitle: string,
  atDate: string,
  useCache = false,
  apiUrl?: string,
  cacheDir?: string,
  auth?: AuthConfig,
): Promise<void> {
  const target = new Date(atDate);
  if (Number.isNaN(target.getTime())) {
    console.error(`Invalid date: ${atDate}. Use ISO 8601 format (e.g., 2024-01-15).`);
    process.exit(1);
  }

  const client = new MediaWikiClient(apiUrl ? { apiUrl, auth } : auth ? { auth } : undefined);
  const revisions = await client.fetchRevisions(pageTitle, { limit: 500, direction: "newer" });

  let closest = revisions[0];
  let closestDelta = Infinity;

  for (const rev of revisions) {
    const revDate = new Date(rev.timestamp);
    const delta = Math.abs(revDate.getTime() - target.getTime());
    if (delta < closestDelta && revDate <= target) {
      closestDelta = delta;
      closest = rev;
    }
  }

  const deltaDays = Math.round((closestDelta / (1000 * 60 * 60 * 24)) * 10) / 10;

  console.log(`\nSnapshot of "${pageTitle}" at ${atDate}`);
  console.log(`Closest revision: ${closest.revId} (${closest.timestamp})`);
  if (closest.timestamp.slice(0, 10) !== atDate.slice(0, 10)) {
    console.log(`  (${deltaDays} days before target date)`);
  }
  console.log();

  const sections = [...closest.content.matchAll(/^=+\s*(.+?)\s*=+$/gm)];
  console.log(`Sections (${sections.length}):`);
  for (const m of sections) {
    const level = m[0].match(/^=+/)?.[0].length ?? 2;
    const indent = "  ".repeat(level - 1);
    console.log(`${indent}${m[1]}`);
  }
  console.log();

  const plainText = stripWikitext(closest.content);
  const lines = plainText.split("\n").filter((l) => l.trim().length > 0);
  console.log(`Content (${closest.size.toLocaleString()} bytes, ${lines.length} text lines):`);
  console.log();
  console.log(plainText.slice(0, 2000));
  if (plainText.length > 2000) {
    console.log(`\n... (${(plainText.length - 2000).toLocaleString()} more characters)`);
  }
  console.log();

  console.log(`Metadata:`);
  console.log(`  Revision:  ${closest.revId}`);
  console.log(`  Page ID:   ${closest.pageId}`);
  console.log(`  Timestamp: ${closest.timestamp}`);
  console.log(`  Minor:     ${closest.minor}`);
  if (closest.user) console.log(`  Editor:    ${closest.user}`);
  console.log(`  Size:      ${closest.size.toLocaleString()} bytes`);
  console.log(`  Comment:   ${closest.comment.slice(0, 200)}`);

  if (useCache && revisions.length > 0) {
    await saveRevisions(revisions, cacheDir);
  }
}
