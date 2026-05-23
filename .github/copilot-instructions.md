# refract — Copilot Instructions

Refract — deterministic observation engine for public revision histories. Monorepo with npm packages + Docker.

## Quick Commands

```bash
bun install && bun run build   # Build all packages
bun run lint                    # Biome check
bun run test                    # Vitest
```

## Key Paths

- `packages/` — npm packages (evidence-graph, ingestion, analyzers, cli, eval, persistence)
- `apps/` — Applications
- `tools/` — Internal tooling
- `docker-compose.yml` — Local dev environment

## Conventions

- **Package manager:** Bun
- **Linter/Formatter:** Biome
- **Tests:** Vitest
- **Pre-commit:** Husky runs Biome on staged files
- **CI:** CI + docker-publish + observe + publish + release + stale
- **Commit style:** Conventional Commits

## Pre-Commit Rule

```bash
bun run lint   # Run before pushing.
```
