import { describe } from "vitest";

/**
 * Gate for the tests that check Refract still parses what MediaWiki actually
 * returns. They are the reason this repo exists, so they are not rewritten
 * against a fixture: asserting `revId` is a number against a response this
 * repo also wrote proves only that the fixture matches itself, and the failure
 * these tests exist to catch — Wikipedia changing its response shape — becomes
 * invisible at exactly the moment it matters.
 *
 * So they stay live, and are skipped when no network is available rather than
 * failing for a 403 that says nothing about the code. `REFRACT_TEST_LIVE=1`
 * opts in.
 *
 * Skipped is not passed. Vitest reports the skip count, and `global-setup.ts`
 * names what did not run — from a global hook rather than from here, because
 * vitest discards console output from a file whose tests are all skipped.
 */
export const LIVE = process.env.REFRACT_TEST_LIVE === "1";

export function describeLive(name: string, fn: () => void): void {
  if (LIVE) {
    describe(name, fn);
    return;
  }
  describe.skip(name, fn);
}
