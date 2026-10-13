# Refract: deterministic observation engine for revision histories

**Refract reveals how claims change across public revision histories — and gives AI researchers reproducible evidence for model evaluation.**

```bash
npx @refract-org/cli analyze "Earth" --depth brief
```

<div class="hero-links">
  <a href="demo/" class="button primary">Demo</a>
  <a href="quickstart/" class="button secondary">Quick start</a>
</div>

Node.js 20+ or Bun 1.2+ · Git 2.x · Any MediaWiki instance

Refract reads a page's revision history and emits a typed event for each change it finds: sentences first seen, modified, removed or reintroduced; citations added, removed or replaced; template, link, category and section changes; reverts; talk page activity.

## Features

<div class="features-grid">
  <div class="feature-card">
    <h3>Deterministic</h3>
    <p>The same revisions produce byte-identical events on every run. No model is called.</p>
  </div>
  <div class="feature-card">
    <h3>Provenance-tagged</h3>
    <p>Every event carries revision, section, timestamp, and analyzer identity.</p>
  </div>
  <div class="feature-card">
    <h3>BYO-inference boundaries</h3>
    <p>Every threshold is a configurable boundary. Plug a model where you need one; defaults run offline.</p>
  </div>
  <div class="feature-card">
    <h3>26 event types</h3>
    <p>Sentence lifecycles, citations, reverts, talk pages, protection levels, and edit clusters.</p>
  </div>
  <div class="feature-card">
    <h3>Hash-verifiable exports</h3>
    <p>Evidence bundles carry a SHA-256 hash and replay manifests a Merkle root, so a recipient can check that events were not altered.</p>
  </div>
  <div class="feature-card">
    <h3>MCP server</h3>
    <p><code>refract mcp</code> serves six tools — analyze, claim, export, cron, classify and get_statement_history — to any MCP client over stdio.</p>
  </div>
</div>

## Quick start

```bash
# 1. Analyze a page
npx @refract-org/cli analyze "Earth" --depth brief

# 2. Explore results in the web UI
refract explore "Earth"

# 3. Connect an AI agent
refract mcp

# 4. Export as structured data
refract export "Earth" --format ndjson > earth-events.jsonl

# 5. Save an evidence bundle (revisions, events and a SHA-256 hash)
refract export "Earth" --bundle > earth-bundle.json

# 6. Output an ObservationReport with claim lifecycle
refract analyze "Earth" --report > earth-report.json
```

<div class="split-columns">
  <div class="column-card focus">
    <h4>What Refract is</h4>
    <ul>
      <li><strong>Deterministic:</strong> The same input gives the same output.</li>
      <li><strong>Provenance-tagged:</strong> Identifies source revision, timestamp, and analyzer version.</li>
      <li><strong>Verifiable:</strong> Replay manifests carry a Merkle root over the event hashes.</li>
      <li><strong>Open layer:</strong> A raw observation feed designed for downstream processing.</li>
    </ul>
  </div>
  <div class="column-card out-of-scope">
    <h4>What Refract is not</h4>
    <ul>
      <li><strong>No model interpretation:</strong> Does not decide semantic meaning or intent.</li>
      <li><strong>No truth claims:</strong> Observes <em>what</em> changed, not <em>which</em> version is correct.</li>
      <li><strong>No editor profiles:</strong> Does not rank, grade, score, or track editors.</li>
      <li><strong>No policy judgments:</strong> Leaves decision relevance and rules to downstream tools.</li>
    </ul>
  </div>
</div>

## By use case

<div class="usecase-grid">
  <div class="usecase-card">
    <h3>Journalist / Researcher</h3>
    <p>Trace claim evolution and sources across revision history.</p>
    <div class="usecase-steps">
      <a href="demo/">Demo</a> → <a href="quickstart/">Quick start</a> → <a href="tutorials/wikipedia-history/">Wikipedia history</a>
    </div>
  </div>
  <div class="usecase-card">
    <h3>Data scientist / OSINT</h3>
    <p>Extract NDJSON events and run columnar SQL analysis in DuckDB.</p>
    <div class="usecase-steps">
      <a href="tutorials/python-sdk/">Python SDK</a> → <a href="python-sdk/">SDK reference</a> → <a href="notebooks/">Notebooks</a>
    </div>
  </div>
  <div class="usecase-card">
    <h3>ML / RAG engineer</h3>
    <p>Score retrieved texts by stability and provenance quality indicators.</p>
    <div class="usecase-steps">
      <a href="tutorials/rag-provenance/">RAG provenance</a> → <a href="tutorials/python-sdk/">Python SDK</a> → <a href="tutorials/byo-inference/">BYO-inference</a>
    </div>
  </div>
  <div class="usecase-card">
    <h3>Policy / Compliance</h3>
    <p>Re-check pages on a schedule and send Slack, email or webhook notifications.</p>
    <div class="usecase-steps">
      <a href="tutorials/scheduled-monitoring/">Monitoring</a> → <a href="cli/">CLI cron</a> → <a href="tutorials/citation-churn/">Citation churn</a>
    </div>
  </div>
  <div class="usecase-card">
    <h3>AI agent developer</h3>
    <p>Give agents Refract's tools through the built-in MCP server.</p>
    <div class="usecase-steps">
      <a href="tutorials/mcp-agent/">MCP tutorial</a> → <a href="mcp/">MCP reference</a> → <a href="tutorials/byo-inference/">BYO-inference</a>
    </div>
  </div>
  <div class="usecase-card">
    <h3>AI model evaluator</h3>
    <p>Test for temporal leakage and recency cutoffs against revision histories.</p>
    <div class="usecase-steps">
      <a href="tutorials/model-evaluation/">Model evaluation</a> → <a href="tutorials/rag-provenance/">RAG provenance</a> → <a href="frontier-use-cases/">Frontier use cases</a>
    </div>
  </div>
</div>

## Ecosystem

Refract is one tool in a family of three:

| Tool | What it does | Install |
|------|-------------|---------|
| **Refract** | CLI + TypeScript SDK — the deterministic observation engine | `npm install -g @refract-org/cli` |
| **[Python SDK](python-sdk)** | Typed Python wrapper — pandas DataFrames, notebooks, LangChain | `pip install git+https://github.com/refract-org/refract-py.git` |
| **[Refract UI](visualizer)** | Browser visualizer — drag-and-drop JSONL, timelines, word-level diffs | `git clone refract-ui && bun run dev` |

A typical workflow: **analyze** with Refract, **export** as NDJSON, then explore in Python or the UI.

<p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 1rem;">
  <strong>Other pathways:</strong> 
  System Integrators (<a href="sdk/">SDK Reference</a> · <a href="downstream/">Production DDL</a> · <a href="tutorials/private-wiki/">Private Wikis</a>) · 
  Engine Contributors (<a href="tutorials/custom-analyzer/">Custom Analyzer</a> · <a href="tutorials/custom-eval/">Custom Eval</a> · <a href="architecture-decisions/">Architecture Decisions</a>)
</p>

## Further uses

Tutorials, and a longer list of use cases, built on the event stream:

| Capability | Read |
|---|---|
| **Claim-level search** | [Frontier use cases](frontier-use-cases.md) — Search claim histories, not documents. "Claims removed as unsourced." "Claims that softened after events." |
| **LLM summarization** | [Summarization tutorial](tutorials/summarization.md) — Pipe events through any model. Get human-readable change reports with audit trail. |
| **Non-Wikipedia sources** | [Custom adapter tutorial](tutorials/custom-adapter.md) — Confluence, GitHub wikis, Notion. Same analyzers, different data. |

## License

AGPL-3.0. Built and maintained by [NextConsensus](https://nextconsensus.com).
