# Repository map and consolidation proposal

Refract has one observation engine and three supporting projects. A user can
analyze, review, and export sources with the core CLI alone. The viewer and Python
adapter provide optional ways to consume its output.

## Current ownership

| Repository | Owns | Consumes | Local checks |
|---|---|---|---|
| [refract](https://github.com/refract-org/refract) | Event schemas, analyzers, ingestion, CLI, explorer, review state, captured examples | Source revision histories | `bun run ci` and `bun run check:examples` |
| [refract-docs](https://github.com/refract-org/refract-docs) | Public site, navigation, tutorials, Pages deployment | Documented CLI and schema contracts | `npm ci`, `npm run lint`, `npm test`, `npm run build` |
| [refract-ui](https://github.com/refract-org/refract-ui) | Browser-only file viewer | NDJSON events; local types mirror the engine | `bun install --frozen-lockfile`, `bun run lint`, `bun run test`, `bun run build` |
| [refract-py](https://github.com/refract-org/refract-py) | Python subprocess adapter and notebook integrations | CLI flags and NDJSON output | `hatch test`, `hatch build` |

This inventory was checked on 2026-10-12. The organization has no current
`refract-labs` or `refract-demo-data` repository. Datasets live in `demo-data/`;
runnable onboarding and review examples live in `docs/examples/`.

## Fix drift before moving files

Engine behavior and file formats belong in the core. The public site should link
to the [review contract](./review.md) and explain how to use it, rather than maintain
a second specification. Distinguish published CLI behavior from source-build
features on every entry page.

Keep sample revisions and their computed output together in the core. Regenerate
with the capture scripts; `bun run check:examples` checks that saved output still
matches the implementation without fetching live histories. Viewer screenshots
remain viewer assets; a screenshot is not an event fixture.

The viewer currently accepts individual events as NDJSON, not saved
`refract-review/v1` reports. The Python adapter currently wraps `analyze` and
`export`, not review acknowledgment. Use the CLI for the review loop. Any future
review consumer must preserve page identity and coverage alongside events.

Checking a downstream project's own unit tests cannot establish compatibility
with a changed engine contract. A meaningful compatibility check must pass
engine-produced output into the downstream parser, including empty and partial
results. See [COMPATIBILITY.md](../COMPATIBILITY.md).

## Proposed destination: one repository

Consolidate development into `refract`, keeping independent build and release
boundaries:

```text
refract/
  packages/            # existing TypeScript packages and CLI
  docs/                # canonical engine and file-format guides
  docs/examples/       # captured revision inputs and outputs
  apps/docs/           # site builder, navigation, assets, tutorial content
  apps/viewer/         # browser-only file viewer, its build and tests
  clients/python/      # Python package, Hatch config and tests
  demo-data/           # existing datasets
```

This lets a flag or event change update its implementation, public instructions,
viewer contract, and Python adapter in one PR. The browser viewer remains a
separate application: the CLI explorer fetches a page history, while the viewer
opens a previously exported file without fetching that source.

Keep the npm workspace list explicit. Moving a private application into the
repository must not add it to the published package set. Python packaging stays
under Hatch and retains the `refract` import and existing subprocess behavior.
The site may retain its npm lockfile until a separate package-manager change is
tested; repository consolidation does not require a simultaneous toolchain move.

## Migration sequence

1. **Move the docs site first.** Import its history under `apps/docs/`, preserving
   its CC-BY-4.0 license. Map reference pages to canonical `docs/` sources; retain
   tutorial and asset paths. Build and preview the complete site before changing
   deployment. Preserve `/refract-docs/` URLs through an explicit redirect or
   deployment arrangement, including deep links, search, sitemap, and images.
2. **Move the viewer.** Import its history under `apps/viewer/`, preserve its
   AGPL-3.0 license, and keep its browser-only operation. Replace independently
   maintained event lists with a checked schema fixture or type-only adapter;
   do not bundle ingestion, a CLI, or source credentials into the browser.
3. **Move the Python adapter.** Import its history under `clients/python/`,
   preserve its AGPL-3.0 license, and build/install the wheel in a fresh
   environment. Verify Python 3.10 and the CI runtime. Document a working install
   target before retiring the current Git-based installation URL.
4. **Retire old repos after the cutovers.** Add relocation notices with exact
   destinations, preserve tags and history, and transfer open issues. Archive
   only after installs, deployments, and links have been verified. Preserve any
   required redirect-only Pages deployment.

Each move should be a separate PR with before/after build evidence. The current
PRs propose this structure and repair existing drift; they do not migrate or
archive repositories.

## Checks in the consolidated repository

Use separate jobs for the core, docs, viewer, and Python adapter. Path filters
should run affected jobs; schema, CLI, and fixture changes must also run consumer
contract checks. Keep the core release gate independent of site or Python builds.

At minimum, the contract checks should cover:

- Every current event type can be imported by the viewer, rendered, and exported
  with its original revision identifiers and text.
- The Python adapter reads captured core NDJSON and preserves event and analyzer
  identity. Its CLI argument tests run against the built CLI for fixed inputs.
- Published commands in the public quickstart work with the documented release.
  Source-only workflows use the built CLI and the offline sample.
- Saved review reports retain source identity, coverage, and acknowledgment
  boundaries if a consumer adds review support.

Licenses remain attached to the imported subprojects. Relocation alone does not
relicense their content. Release names, public import names, and event identifiers
remain consumer contracts throughout the migration.
