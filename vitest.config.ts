import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    // Prefixed with **/ so a nested node_modules is excluded too. Without it
    // only the root one matched, and the workspace links under
    // packages/*/node_modules/@refract-org/* made vitest discover the same
    // suites again through every dependent package: performance.test.ts ran
    // four times, and one failure was reported as four. Vitest's own default
    // is **/node_modules/**; naming `exclude` at all replaced it.
    exclude: ["**/node_modules/**", "**/.opencode/**", "**/dist/**"],
    // Prints once per run which tests the live gate skipped. It has to be a
    // global hook: vitest discards console output from a file whose tests are
    // all skipped, which is every file the gate closes.
    globalSetup: ["./tests/support/global-setup.ts"],
  },
});
