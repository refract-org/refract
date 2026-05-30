---
description: "Run typecheck + lint"
agent: build
---
tsc --noEmit||vitest run
