---
description: "Run typecheck + lint"
agent: build
---
npx biome check .||node build.mjs||vitest run
