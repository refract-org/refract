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
  revisionLimit = 500,
): Promise<void> {
  const target = new Date(atDate);
  if (Number.isNaN(target.getTime())) {
    console.error(`Invalid date: ${atDate}. Use ISO 8601 format (e.g., 2024-01-15).`);
    process.exit(1);
  }

  const client = new MediaWikiClient(apiUrl ? { apiUrl, auth } : auth ? { auth } : undefined);
  // Revisions at or before the target, newest first. "newer" with a limit read
  // the page's first revisions, so any date past them snapped to the latest of
  // those instead of to the revision live on that date.
  const revisions = await client.fetchRevisions(pageTitle, { limit: revisionLimit, direction: "older", start: target });
  if (revisions.length === 0) {
    console.error(`No revision of "${pageTitle}" exists at or before ${atDate}.`);
    process.exit(1);
  }

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

  const sections = headingLines(closest.content);
  console.log(`Sections (${sections.length}):`);
  for (const { level, name } of sections) {
    console.log(`${"  ".repeat(level - 1)}${name}`);
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

/**
 * Lines that open and close with "=", with the name between the runs of "=".
 * /^=+\s*(.+?)\s*=+$/gm split each line's whitespace between three quantifiers,
 * which took time cubic in its length; a line that is only "=" and spaces,
 * which that pattern printed as a section named "=", is skipped.
 */
export function headingLines(wikitext: string): Array<{ level: number; name: string }> {
  const headings: Array<{ level: number; name: string }> = [];
  for (const match of wikitext.matchAll(/^=.*$/gm)) {
    const line = match[0];
    if (!line.endsWith("=")) continue;
    let start = 0;
    while (line[start] === "=") start++;
    let end = line.length;
    while (end > start && line[end - 1] === "=") end--;
    const name = line.slice(start, end).trim();
    if (name) headings.push({ level: start, name });
  }
  return headings;
}
