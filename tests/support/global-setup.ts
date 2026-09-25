import { LIVE } from "./live.js";

/**
 * Runs once per suite run, before any file is collected.
 *
 * This notice lived in `describeLive` first, where it never appeared: vitest
 * suppresses console output from a file whose tests are all skipped, which is
 * every file the gate closes. A warning that only prints when it isn't needed
 * is worse than none — it reads as proof the gap is being reported.
 */
export function setup(): void {
  if (LIVE) {
    console.info("[live] REFRACT_TEST_LIVE=1 — MediaWiki API contract tests will hit the real API.");
    return;
  }
  console.info(
    "[live] MediaWiki API contract tests are skipped. They check that the client still parses\n" +
      "[live] what Wikipedia returns, which no fixture can stand in for. REFRACT_TEST_LIVE=1 runs them.",
  );
}
