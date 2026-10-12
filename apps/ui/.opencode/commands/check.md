---
description: "Run typecheck + lint"
agent: build
---
npx biome check .||tsc && vite build||vitest run
