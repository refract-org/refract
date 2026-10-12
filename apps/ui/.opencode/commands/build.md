---
description: "Run the full build"
agent: build
---
npx biome check .||tsc && vite build||vitest run
