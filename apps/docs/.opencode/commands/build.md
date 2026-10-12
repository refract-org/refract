---
description: "Run the full build"
agent: build
---
npx biome check .||node build.mjs||vitest run
