# refract-ui — Agent Instructions

Standalone visualization UI for Refract. Not part of the monorepo — no `@refract-org/*` package imports.

## Quick Start

```bash
bun install
bun run dev      # vite dev server
bun run build    # tsc + vite build
bun run test     # typecheck + vitest
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
- **Pre-commit:** Husky + lint-staged (Biome check on staged files)
- **CI:** None yet — runs locally

## Conventions

- Each component is a class with a `render()` method.
- Components take a container `HTMLElement` and data, manipulate DOM directly.
- No framework. No JSX. No virtual DOM.
- Types mirror `@refract-org/evidence-graph` schemas (defined locally in `src/types.ts`).
- CSS custom properties in `main.css` — no CSS framework.

## Verification

```bash
bun run lint     # Biome check
bun run test     # Typecheck + vitest
bun run build    # Production build
```
