import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { diffObservations } from "@refract-org/analyzers";
import type { EvidenceEvent, ObservationReport } from "@refract-org/evidence-graph";
import type { AuthConfig } from "@refract-org/ingestion";
import type { NotifyConfig } from "../notify.js";
import { sendNotifications } from "../notify.js";
import { buildObservationReport, runAnalyze } from "./analyze.js";

export interface CronReport {
  pageTitle: string;
  observedAt: string;
  priorObservationAt: string | null;
  eventsNew: number;
  eventsResolved: number;
  eventsUnchanged: number;
  deltaSummary: string;
}

export interface CronResult {
  reports: CronReport[];
  totalNewEvents: number;
  pagesProcessed: number;
  generatedAt: string;
}

function mergeObservationReports(prior: ObservationReport | null, current: ObservationReport): ObservationReport {
  if (!prior) return current;

  const mergedClaims: Record<string, ObservationReport["claims"][string]> = { ...prior.claims };

  for (const [claimId, currentLedger] of Object.entries(current.claims)) {
    if (mergedClaims[claimId]) {
      const existing = mergedClaims[claimId];
      existing.lastSeenAt = currentLedger.lastSeenAt;
      existing.currentState = currentLedger.currentState;
      existing.history.push(...currentLedger.history);
    } else {
      mergedClaims[claimId] = currentLedger;
    }
  }

  return {
    pageTitle: current.pageTitle,
    pageId: current.pageId,
    observedAt: current.observedAt,
    revisionRange: current.revisionRange,
    claims: mergedClaims,
    eventCount: current.eventCount,
    uniqueEditorCount: Math.max(prior?.uniqueEditorCount ?? 0, current.uniqueEditorCount),
    merkleRoot: current.merkleRoot,
    analyzerVersion: current.analyzerVersion,
  };
}

export async function runCron(
  pagesFile: string,
  intervalHours?: number,
  apiUrl?: string,
  cacheDir?: string,
  notifyConfig?: NotifyConfig,
  auth?: AuthConfig,
): Promise<CronResult> {
  const content = readFileSync(pagesFile, "utf-8");
  const titles = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  console.log(`Cron: ${titles.length} pages from ${pagesFile}\n`);

  const baseDir = cacheDir ?? join(homedir(), ".wikihistory");
  const obsDir = join(baseDir, "observations");
  const reportsDir = join(baseDir, "reports");
  if (!existsSync(obsDir)) mkdirSync(obsDir, { recursive: true });
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

  const reports: CronReport[] = [];
  let totalNewEvents = 0;

  for (const title of titles) {
    const safeName = title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const obsFile = join(obsDir, `${safeName}.json`);

    let fromTimestamp: string | undefined;
    let priorObservationAt: string | null = null;

    if (intervalHours !== undefined && intervalHours > 0) {
      const d = new Date(Date.now() - intervalHours * 60 * 60 * 1000);
      fromTimestamp = d.toISOString();
    } else {
      try {
        const raw = readFileSync(obsFile, "utf-8");
        const priorEvents = JSON.parse(raw) as EvidenceEvent[];
        if (priorEvents.length > 0) {
          const lastTimestamp = priorEvents[priorEvents.length - 1].timestamp;
          priorObservationAt = lastTimestamp;
          fromTimestamp = lastTimestamp;
        }
      } catch {
        const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
        fromTimestamp = d.toISOString();
      }
    }

    console.log(`  ${title}: observing since ${fromTimestamp ?? "beginning"}...`);

    const { events, revisions } = await runAnalyze(
      title,
      "detailed",
      undefined,
      undefined,
      fromTimestamp,
      false,
      apiUrl,
      undefined,
      undefined,
      auth,
    );

    let priorEvents: EvidenceEvent[] = [];
    try {
      const raw = readFileSync(obsFile, "utf-8");
      priorEvents = JSON.parse(raw) as EvidenceEvent[];
    } catch (err) {
      console.error("refract: cron: failed to read prior observation file", err);
    }

    const isFirstObservation = priorEvents.length === 0;
    const obsDiff = diffObservations(priorEvents, events);

    const report: CronReport = {
      pageTitle: title,
      observedAt: new Date().toISOString(),
      priorObservationAt,
      eventsNew: isFirstObservation ? 0 : obsDiff.new.length,
      eventsResolved: isFirstObservation ? 0 : obsDiff.resolved.length,
      eventsUnchanged: isFirstObservation ? 0 : obsDiff.unchanged.length,
      deltaSummary: isFirstObservation
        ? "baseline established"
        : obsDiff.new.length > 0 || obsDiff.resolved.length > 0
          ? `${obsDiff.new.length} new, ${obsDiff.resolved.length} resolved`
          : "no changes",
    };
    reports.push(report);

    const pageId = revisions[0]?.pageId ?? 0;
    const currentReport = buildObservationReport(title, pageId, events, revisions);

    let priorObservationReport: ObservationReport | null = null;
    const observationReportFile = join(reportsDir, `${safeName}.json`);
    try {
      const raw = readFileSync(observationReportFile, "utf-8");
      priorObservationReport = JSON.parse(raw) as ObservationReport;
    } catch (err) {
      console.error("refract: cron: failed to read prior observation report", err);
    }

    const mergedReport = mergeObservationReports(priorObservationReport, currentReport);
    writeFileSync(observationReportFile, JSON.stringify(mergedReport, null, 2), "utf-8");

    if (!isFirstObservation && obsDiff.new.length > 0) {
      totalNewEvents += obsDiff.new.length;
      console.log(`    ${obsDiff.new.length} new events, ${obsDiff.resolved.length} resolved`);
    } else {
      console.log(`    No changes`);
    }
  }

  const result: CronResult = {
    reports,
    totalNewEvents,
    pagesProcessed: titles.length,
    generatedAt: new Date().toISOString(),
  };

  console.log(`\n=== Cron Summary ===`);
  console.log(`Pages: ${titles.length}`);
  console.log(`Total new events: ${totalNewEvents}`);

  if (notifyConfig) {
    const changedDeltas = reports
      .filter((r) => r.eventsNew > 0 || r.eventsResolved > 0)
      .map((r) => ({
        pageTitle: r.pageTitle,
        eventsNew: r.eventsNew,
        eventsResolved: r.eventsResolved,
        deltaSummary: r.deltaSummary,
        wikiUrl: apiUrl,
      }));
    await sendNotifications(notifyConfig, changedDeltas);
  }

  return result;
}
