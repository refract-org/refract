# Evaluation Harness

The eval package (`@refract-org/eval`, in `packages/eval`) provides an independent validation layer (L3) that compares pipeline output against expected results.

## EvalHarness Interface

```ts
interface EvalHarness {
  evaluate(test: EvalTestCase, events: EvidenceEvent[]): EvalResult;
  benchmarkPages(): EvalTestCase[];
  computeScores(results: EvalResult[]): EvalScoreSummary;
}
```

## Test Case Structure

```ts
interface EvalTestCase {
  id: string;
  description: string;
  pageTitle: string;
  pageId: number;
  revisionRange: { from: number; to: number };
  expectedEvents: ExpectedEvent[];
  tolerance?: EvalTolerance;
}

interface EvalTolerance {
  minEventCount?: number;    // Minimum events required
  maxEventCount?: number;    // Maximum events allowed
  minPrecision?: number;     // Default: 0.5
}
```

## Built-in Benchmark Pages

| ID | Page | Expectation |
|----|------|-------------|
| `page-has-revisions` | Earth | At least 2 revisions, section events |
| `contentious-page-has-reverts` | Donald_Trump | Revert events detected |
| `controversy-page-has-templates` | COVID-19_pandemic | Policy maintenance templates |
| `scientific-article-has-citations` | CRISPR | Citation additions and removals |
| `featured-article-has-template-cleanup` | Shakespeare | Cleanup template activity |
| `events-has-citation-additions` | Albert_Einstein | Observable citation diffs |

## Result Types

```ts
interface EvalResult {
  testId: string;
  passed: boolean;
  precision: number;          // matchedCount / totalExpected
  eventCount: { expected: number; actual: number };
  matches: EventMatch[];
  misses: MissingEvent[];
  falsePositives: UnexpectedEvent[];
}

interface EvalScoreSummary {
  overallPrecision: number;
  testsPassed: number;
  testsFailed: number;
  totalTests: number;
  perTest: Array<{ id: string; precision: number; passed: boolean }>;
}
```

## Adding a New Eval Test

When adding a new analyzer, include at least one eval test:

1. Select a known Wikipedia page with observable signal
2. Define expected event types and sections
3. Set tolerance thresholds appropriate to the signal
4. Add to `benchmarkPages()` return array
5. Verify with `bun run test`

## Running Evals

```bash
bun run test    # Runs all vitest suites including eval tests
```

Eval tests live in `packages/eval/src/__tests__/` and use the Vitest framework with `globals: true`.
