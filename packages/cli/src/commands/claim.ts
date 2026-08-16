import { stripWikitext } from "@refract-org/analyzers";
import type { ClaimState, Revision } from "@refract-org/evidence-graph";
import { createClaimIdentity } from "@refract-org/evidence-graph";
import type { AuthConfig, RevisionOptions } from "@refract-org/ingestion";
import { MediaWikiClient } from "@refract-org/ingestion";
import { loadCachedRevisions, loadLatestCachedTimestamp, saveRevisions } from "./cache.js";

export interface ClaimHistoryVariant {
  revisionId: number;
  timestamp: string;
  text: string;
  section: string;
}

export interface ClaimHistoryResult {
  statement: string;
  page: string;
  revisions: ClaimHistoryVariant[];
  status: "present" | "absent" | "modified" | "contested";
  historySummary: string;
}

export async function runClaimHistory(
  pageTitle: string,
  claimText: string,
  useCache = false,
  apiUrl?: string,
  cacheDir?: string,
  auth?: AuthConfig,
  revisionLimit = 50,
): Promise<ClaimHistoryResult> {
  const client = new MediaWikiClient(apiUrl ? { apiUrl, auth } : auth ? { auth } : undefined);

  let revisions: Revision[] = [];

  if (useCache) {
    const cached = await loadCachedRevisions(pageTitle, 500, cacheDir);
    if (cached.length > 0) {
      revisions = cached;

      const latestTs = await loadLatestCachedTimestamp(pageTitle, cacheDir);
      if (latestTs) {
        const deltaOpts: RevisionOptions = { direction: "newer", start: new Date(latestTs) };
        const newRevisions = await client.fetchRevisions(pageTitle, deltaOpts);
        const uniqueNew = newRevisions.filter((r) => !revisions.some((cr) => cr.revId === r.revId));
        if (uniqueNew.length > 0) {
          revisions = [...revisions, ...uniqueNew];
          await saveRevisions(uniqueNew, cacheDir);
        }
      }
    }
  }

  if (revisions.length === 0) {
    revisions = await client.fetchRevisions(pageTitle, { limit: revisionLimit, direction: "newer" });

    if (useCache && revisions.length > 0) {
      await saveRevisions(revisions, cacheDir);
    }
  }

  if (revisions.length === 0) {
    return {
      statement: claimText,
      page: pageTitle,
      revisions: [],
      status: "absent",
      historySummary: `No revisions found for "${pageTitle}".`,
    };
  }

  const withTs = [...revisions].map((r) => ({ r, ts: new Date(r.timestamp).getTime() }));
  withTs.sort((a, b) => a.ts - b.ts);
  const revs = withTs.map((x) => x.r);

  const variants: ClaimHistoryVariant[] = [];
  let lastKnownText = "";
  let currentState: ClaimState = "absent";
  const transitions: string[] = [];
  let textChanges = 0;
  let removals = 0;
  let reintroductions = 0;

  for (const rev of revs) {
    const plainText = stripWikitext(rev.content);
    const foundText = fuzzyFindText(claimText, plainText);

    if (foundText) {
      if (currentState === "absent" || currentState === "deleted" || currentState === "receding") {
        if (currentState !== "absent") {
          reintroductions++;
          transitions.push(`reintroduced at ${rev.timestamp}`);
        } else {
          transitions.push(`first seen at ${rev.timestamp}`);
        }
        currentState = "emerging";
      } else if (foundText !== lastKnownText && lastKnownText !== "") {
        const oldLen = lastKnownText.length;
        const newLen = foundText.length;
        if (Math.abs(newLen - oldLen) > oldLen * 0.2) {
          currentState = "contested";
          textChanges++;
          transitions.push(`text changed at ${rev.timestamp}`);
        }
      }

      lastKnownText = foundText;
      const section = findSectionForText(rev.content, foundText);
      variants.push({
        revisionId: rev.revId,
        timestamp: rev.timestamp,
        text: foundText,
        section,
      });
    } else {
      if (currentState !== "absent" && currentState !== "deleted") {
        currentState = lastKnownText === "" ? "deleted" : "receding";
        removals++;
        transitions.push(`removed at ${rev.timestamp}`);
        lastKnownText = "";
      }
    }
  }

  const isPresentInLatest = variants.length > 0 && variants[variants.length - 1].text !== "";

  if (variants.length === 0) {
    return {
      statement: claimText,
      page: pageTitle,
      revisions: [],
      status: "absent",
      historySummary: `Statement not found in any revision of "${pageTitle}".`,
    };
  }

  let status: ClaimHistoryResult["status"];
  if (!isPresentInLatest) {
    status = "absent";
  } else if (removals > 0 || reintroductions > 0 || textChanges > 1) {
    status = "contested";
  } else if (textChanges === 1) {
    status = "modified";
  } else {
    status = "present";
  }

  const first = variants[0];
  const latest = variants[variants.length - 1];
  const parts: string[] = [
    `Tracked "${claimText}" across ${revs.length} revisions.`,
    `First seen at ${first.timestamp} (rev ${first.revisionId}).`,
  ];
  if (status === "absent") {
    parts.push(`Last present at ${latest.timestamp} (rev ${latest.revisionId}), then removed.`);
  } else if (status === "modified") {
    parts.push(`Latest version at ${latest.timestamp} (rev ${latest.revisionId}) has modified wording.`);
  } else if (status === "contested") {
    parts.push(`Multiple changes detected; latest version at ${latest.timestamp} (rev ${latest.revisionId}).`);
  } else {
    parts.push(`Present continuously from ${first.timestamp} to ${latest.timestamp}.`);
  }
  if (transitions.length > 0) {
    parts.push(transitions.join("; "));
  }

  return {
    statement: claimText,
    page: pageTitle,
    revisions: variants,
    status,
    historySummary: parts.join(" "),
  };
}

export async function runClaim(
  pageTitle: string,
  claimText: string,
  useCache = false,
  apiUrl?: string,
  cacheDir?: string,
  auth?: AuthConfig,
  revisionLimit = 50,
): Promise<void> {
  const client = new MediaWikiClient(apiUrl ? { apiUrl, auth } : auth ? { auth } : undefined);
  console.log(`Tracking claim in "${pageTitle}"...`);
  console.log(`Claim text: "${claimText}"\n`);

  let revisions: Revision[] = [];

  if (useCache) {
    const cached = await loadCachedRevisions(pageTitle, 500, cacheDir);
    if (cached.length > 0) {
      console.log(`Loaded ${cached.length} revisions from cache.`);
      revisions = cached;

      const latestTs = await loadLatestCachedTimestamp(pageTitle, cacheDir);
      if (latestTs) {
        const deltaOpts: RevisionOptions = { direction: "newer", start: new Date(latestTs) };
        const newRevisions = await client.fetchRevisions(pageTitle, deltaOpts);
        const uniqueNew = newRevisions.filter((r) => !revisions.some((cr) => cr.revId === r.revId));
        if (uniqueNew.length > 0) {
          console.log(`Fetched ${uniqueNew.length} new revisions since ${latestTs}.`);
          revisions = [...revisions, ...uniqueNew];
          await saveRevisions(uniqueNew, cacheDir);
        } else {
          console.log("Cache is up to date.");
        }
      }
    }
  }

  if (revisions.length === 0) {
    revisions = await client.fetchRevisions(pageTitle, { limit: revisionLimit, direction: "newer" });
    console.log(`Fetched ${revisions.length} revisions.\n`);

    if (useCache && revisions.length > 0) {
      await saveRevisions(revisions, cacheDir);
      console.log(`Cached ${revisions.length} revisions.\n`);
    }
  }

  if (revisions.length === 0) {
    console.log("No revisions found.");
    return;
  }

  const withTs = [...revisions].map((r) => ({ r, ts: new Date(r.timestamp).getTime() }));
  withTs.sort((a, b) => a.ts - b.ts);
  const revs = withTs.map((x) => x.r);

  const identity = createClaimIdentity({
    text: claimText,
    section: "",
    pageTitle,
    pageId: revs[0].pageId,
  });

  const variants: Array<{ revisionId: number; text: string; section: string; observedAt: string }> = [];
  let lastKnownText = "";
  let currentState: ClaimState = "absent";

  for (const rev of revs) {
    const plainText = stripWikitext(rev.content);
    const foundText = fuzzyFindText(claimText, plainText);

    if (foundText) {
      if (currentState === "absent") {
        currentState = "emerging";
        console.log(`[${rev.timestamp}] FIRST SEEN (rev ${rev.revId})`);
        console.log(`  State: absent → emerging`);
        console.log(`  Matched text: "${foundText.slice(0, 200)}"`);
      } else if (foundText !== lastKnownText && lastKnownText !== "") {
        const oldLen = lastKnownText.length;
        const newLen = foundText.length;
        if (Math.abs(newLen - oldLen) > oldLen * 0.2) {
          currentState = "contested";
          console.log(`[${rev.timestamp}] TEXT CHANGED (rev ${rev.revId})`);
          console.log(`  State: → contested`);
          console.log(`  Previous: "${lastKnownText.slice(0, 150)}"`);
          console.log(`  Current:  "${foundText.slice(0, 150)}"`);
        }
      }

      lastKnownText = foundText;
      const section = findSectionForText(rev.content, foundText);
      variants.push({
        revisionId: rev.revId,
        text: foundText,
        section,
        observedAt: rev.timestamp,
      });
    } else {
      if (currentState !== "absent" && currentState !== "deleted") {
        currentState = lastKnownText === "" ? "deleted" : "receding";
        console.log(`[${rev.timestamp}] REMOVED (rev ${rev.revId})`);
        console.log(`  State: → ${currentState}`);
        lastKnownText = "";
      }
    }
  }

  if (variants.length === 0) {
    console.log(`\nClaim "${claimText}" not found in any revision of "${pageTitle}".`);
    return;
  }

  if (currentState !== "absent" && currentState !== "deleted") {
    currentState = "stabilizing";
  }

  console.log(`\n=== Claim Lineage Summary ===`);
  console.log(`Claim ID:    ${identity.claimId}`);
  console.log(`Page:        ${pageTitle}`);
  console.log(`Variants:    ${variants.length}`);
  console.log(`State:       ${currentState}`);
  console.log(`First seen:  ${variants[0].observedAt} (rev ${variants[0].revisionId})`);
  console.log(
    `Last seen:   ${variants[variants.length - 1].observedAt} (rev ${variants[variants.length - 1].revisionId})`,
  );
  console.log();
  console.log(`The Claim ID is a deterministic hash — cite it to make your finding reproducible.`);
  console.log(`Next: refract analyze "${pageTitle}" --depth detailed    (full event stream)`);
  console.log(`      refract explore "${pageTitle}"                     (browser UI)`);
}

export function fuzzyFindText(claimText: string, plainText: string, preNormalized?: string): string {
  const normalized = claimText.toLowerCase().replace(/\s+/g, " ").trim();
  const searchText = preNormalized ?? plainText.toLowerCase().replace(/\s+/g, " ");

  if (searchText.includes(normalized)) {
    const idx = searchText.indexOf(normalized);
    const start = Math.max(0, idx - 50);
    const end = Math.min(searchText.length, idx + normalized.length + 100);
    return plainText.slice(start, end).trim();
  }

  const words = normalized.split(" ").filter((w) => w.length > 3);
  const matched = words.filter((w) => searchText.includes(w));
  if (matched.length >= words.length * 0.7 && words.length >= 3) {
    return `[partial match: ${matched.length}/${words.length} words]`;
  }

  return "";
}

export function findSectionForText(
  wikitext: string,
  plainText: string,
  preStripped?: string,
  sectionCharMap?: Array<{ charOffset: number; section: string }>,
): string {
  const strippedBase = preStripped ?? stripWikitext(wikitext);
  const stripped = strippedBase.toLowerCase().replace(/\s+/g, " ");
  const targetIdx = stripped.indexOf(plainText.toLowerCase().replace(/\s+/g, " ").trim());

  if (targetIdx < 0) return "(lead)";

  if (sectionCharMap) {
    for (let i = sectionCharMap.length - 1; i >= 0; i--) {
      if (sectionCharMap[i].charOffset <= targetIdx) {
        return sectionCharMap[i].section;
      }
    }
    return "(lead)";
  }

  const headerRegex = /^(=+)\s*([^=]+?)\s*\1$/gm;
  const lines = wikitext.split("\n");
  let currentSection = "(lead)";
  let charCount = 0;

  for (const line of lines) {
    const match = headerRegex.exec(line);
    if (match) {
      if (charCount > targetIdx) return currentSection;
      currentSection = match[2].trim();
    }
    charCount += line.length + 1;
  }

  return currentSection;
}

export function buildSectionCharMap(wikitext: string): Array<{ charOffset: number; section: string }> {
  const lines = wikitext.split("\n");
  const headerRegex = /^(=+)\s*([^=]+?)\s*\1$/;
  const map: Array<{ charOffset: number; section: string }> = [{ charOffset: 0, section: "(lead)" }];
  let charCount = 0;
  for (const line of lines) {
    const match = headerRegex.exec(line);
    if (match) {
      map.push({ charOffset: charCount, section: match[2].trim() });
    }
    charCount += line.length + 1;
  }
  return map;
}
