# refract-ui — Agent Instructions

Browser-only file viewer for Refract, in `apps/ui` of the monorepo. It imports
the engine's event types from `@refract-org/evidence-graph` as types only and
bundles nothing else from the engine: no ingestion, no CLI, no credentials.

## Quick Start

```bash
bun install      # at the repository root; installs every workspace
bun run build    # at the repository root first: emits evidence-graph's types
bun run dev      # vite dev server
bun run build    # tsc + vite build
bun run test     # vitest
bun run preview  # vite preview
```

## Repository Structure

- `src/` — Component source code (vanilla TypeScript)
- `src/language/` — Viz-specific UI components
- `tests/` — Vitest test suite
- `public/sample-data.jsonl` — Valid `EvidenceEvent` objects
- `dist/` — Build output

## Tooling

- **Package manager:** Bun
- **Linter/Formatter:** Biome
- **Tests:** Vitest
- **Pre-commit:** the repository root's Husky hook runs lint-staged, which uses this directory's `.lintstagedrc.json`
- **CI:** `.github/workflows/viewer.yml` at the repository root. It also runs when `packages/evidence-graph` or `docs/examples` change.

## Conventions

- Each component is a class with a `render()` method.
- Components take a container `HTMLElement` and data, manipulate DOM directly.
- No framework. No JSX. No virtual DOM.
- Event types come from `@refract-org/evidence-graph` (re-exported in `src/types.ts`). A list of event types is typed `Record<EventType, …>` there so the compiler rejects one that misses or invents a type.
- `tests/engine-contract.test.ts` imports, lists and re-exports the engine output captured in `docs/examples/`.
- CSS custom properties in `main.css` — no CSS framework.

## Verification

```bash
bun run lint     # Biome check
bun run test     # Vitest, including the engine contract
bun run build    # tsc against the engine's types, then vite build
```
