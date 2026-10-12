# Refract Demo

Try Refract in your browser. All data is pre-computed — no installation needed.

<noscript>
  <div style="padding: 2rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin: 1rem 0;">
    <p style="font-weight: 600; color: #dc2626;">JavaScript required</p>
    <p style="color: #4b5563;">This demo renders interactive charts from pre-computed Refract event data. Enable JavaScript to explore the Xanoleptin (synthetic drug), Luke Skywalker (Fandom), and Bitcoin (Wikipedia) datasets — each containing 30–50 structured events showing claim lifecycles, citation churn, and edit clusters.</p>
    <p style="color: #4b5563;">For a text-based walkthrough without JavaScript, see the <a href="../tutorials/wikipedia-history/">Wikipedia History tutorial</a> or run Refract locally:</p>
    <pre style="background: #f3f4f6; padding: 1rem; margin: 0.5rem 0;">npx @refract-org/cli analyze "Bitcoin" --depth detailed</pre>
  </div>
</noscript>

<div id="demo-controls">
  <label>Dataset: <select id="dataset-select">
    <option value="xanoleptin">Xanoleptin (synthetic drug)</option>
    <option value="luke-skywalker">Luke Skywalker (Fandom)</option>
    <option value="bitcoin">Bitcoin (Wikipedia)</option>
  </select></label>
  <span id="event-count">0 events</span>
</div>

<div id="demo-layout">
  <div class="demo-panel" id="panel-timeline">
    <h3>Event Timeline</h3>
    <div id="timeline-chart"><p class="loading">Loading...</p></div>
  </div>
  <div class="demo-panel" id="panel-claim">
    <h3>Claim Lifecycle</h3>
    <div id="claim-lifecycle"><p class="loading">Select a claim...</p></div>
  </div>
  <div class="demo-panel" id="panel-churn">
    <h3>Citation Churn</h3>
    <div id="citation-chart"><p class="loading">Loading...</p></div>
  </div>
  <div class="demo-panel" id="panel-clusters">
    <h3>Edit Clusters</h3>
    <div id="cluster-chart"><p class="loading">Loading...</p></div>
  </div>
</div>

<div id="demo-json" class="demo-panel">
  <h3>Raw Events (first 3)</h3>
  <pre id="json-output"><p class="loading">Loading...</p></pre>
</div>

<style>
#demo-controls { margin: 1rem 0; display: flex; gap: 1rem; align-items: center; }
#demo-controls select { padding: 0.3rem 0.6rem; }
#event-count { color: var(--ink-soft); font-size: 0.9rem; }
#demo-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
.demo-panel { border: 1px solid var(--line); padding: 1rem; background: var(--surface-1); }
.demo-panel h3 { margin: 0 0 0.75rem; font-size: 1rem; }
#demo-json pre { max-height: 300px; overflow: auto; font-size: 0.8rem; }
.loading { color: var(--ink-soft); font-style: italic; }
.timeline-bar { display: flex; align-items: center; gap: 0.25rem; margin: 0.15rem 0; font-size: 0.78rem; }
.timeline-label { min-width: 7rem; text-align: right; color: var(--ink-soft); }
.timeline-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.timeline-line { height: 1px; flex: 1; min-width: 20px; }
.claim-card { border: 1px solid var(--line-strong); padding: 0.75rem; margin: 0.5rem 0; }
.claim-card strong { display: block; margin-bottom: 0.25rem; }
.claim-stat { font-size: 0.85rem; color: var(--ink-soft); }
.churn-bar { display: flex; align-items: center; gap: 0.5rem; margin: 0.2rem 0; }
.churn-label { min-width: 6rem; font-size: 0.78rem; color: var(--ink-soft); }
.churn-value { height: 16px; border-radius: 2px; transition: width 0.3s; }
@media (max-width: 720px) { #demo-layout { grid-template-columns: 1fr; } }
</style>

<script>
const DATASETS = {
  xanoleptin: "https://raw.githubusercontent.com/refract-org/refract-demo-data/main/synthetic-healthcare-like/xanoleptin.jsonl",
  "luke-skywalker": "https://raw.githubusercontent.com/refract-org/refract-demo-data/main/fandom/star-wars/luke-skywalker.jsonl",
  bitcoin: "https://raw.githubusercontent.com/refract-org/refract-demo-data/main/historical-wikipedia/events.jsonl",
};

const EVENT_COLORS = {
  sentence_first_seen: "#4caf50",
  sentence_removed: "#f44336",
  sentence_modified: "#ff9800",
  sentence_reintroduced: "#2196f3",
  citation_added: "#9c27b0",
  citation_removed: "#e91e63",
  citation_replaced: "#3f51b5",
  template_added: "#ff5722",
  template_removed: "#795548",
  revert_detected: "#f44336",
  edit_cluster_detected: "#607d8b",
};

let currentEvents = [];

async function loadDataset(name) {
  const url = DATASETS[name];
  const resp = await fetch(url);
  const text = await resp.text();
  const events = text.split("\n").filter(l => l.trim() && !l.startsWith("#")).map(l => JSON.parse(l));
  currentEvents = events;
  document.getElementById("event-count").textContent = `${events.length} events`;
  renderTimeline(events);
  renderClaims(events);
  renderCitations(events);
  renderClusters(events);
  renderJSON(events);
}

function renderTimeline(events) {
  const sorted = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const types = [...new Set(sorted.map(e => e.eventType))];
  const html = types.map(type => {
    const count = sorted.filter(e => e.eventType === type).length;
    const color = EVENT_COLORS[type] || "#9e9e9e";
    return `<div class="timeline-bar">
      <span class="timeline-label">${type}</span>
      <span class="timeline-dot" style="background:${color}"></span>
      <span class="timeline-line" style="background:${color};width:${Math.min(count * 20, 200)}px"></span>
      <span>${count}</span>
    </div>`;
  }).join("");
  document.getElementById("timeline-chart").innerHTML = html;
}

function renderClaims(events) {
  const claimEvents = events.filter(e => e.eventType.startsWith("sentence_"));
  if (claimEvents.length === 0) {
    document.getElementById("claim-lifecycle").innerHTML = '<p class="loading">No claim events in this dataset.</p>';
    return;
  }
  const claimIds = [...new Set(claimEvents.map(e => e.claimId || e.eventType + "_" + e.toRevisionId).filter(Boolean))];
  const html = claimIds.slice(0, 3).map(id => {
    const evts = claimEvents.filter(e => (e.claimId || e.eventType + "_" + e.toRevisionId) === id);
    const firstSeen = evts.find(e => e.eventType === "sentence_first_seen");
    const lastEvt = evts[evts.length - 1];
    const text = firstSeen?.after || evts[0]?.after || "(no text)";
    const state = lastEvt?.eventType === "sentence_removed" ? "Removed" : "Active";
    return `<div class="claim-card">
      <strong>${text.slice(0, 100)}${text.length > 100 ? "..." : ""}</strong>
      <div class="claim-stat">Events: ${evts.length} | State: ${state} | First: ${firstSeen?.timestamp?.slice(0, 10) || "?"}</div>
    </div>`;
  }).join("");
  document.getElementById("claim-lifecycle").innerHTML = html;
}

function renderCitations(events) {
  const citEvents = events.filter(e => e.eventType.startsWith("citation_"));
  if (citEvents.length === 0) {
    document.getElementById("citation-chart").innerHTML = '<p class="loading">No citation events in this dataset.</p>';
    return;
  }
  const added = citEvents.filter(e => e.eventType === "citation_added").length;
  const removed = citEvents.filter(e => e.eventType === "citation_removed").length;
  const replaced = citEvents.filter(e => e.eventType === "citation_replaced").length;
  const max = Math.max(added, removed, replaced, 1);
  document.getElementById("citation-chart").innerHTML = `
    <div class="churn-bar"><span class="churn-label">Added</span><span class="churn-value" style="width:${(added/max)*100}%;background:#4caf50"></span><span>${added}</span></div>
    <div class="churn-bar"><span class="churn-label">Removed</span><span class="churn-value" style="width:${(removed/max)*100}%;background:#f44336"></span><span>${removed}</span></div>
    <div class="churn-bar"><span class="churn-label">Replaced</span><span class="churn-value" style="width:${(replaced/max)*100}%;background:#3f51b5"></span><span>${replaced}</span></div>
  `;
}

function renderClusters(events) {
  const clusterEvents = events.filter(e => e.eventType === "edit_cluster_detected");
  if (clusterEvents.length === 0) {
    document.getElementById("cluster-chart").innerHTML = '<p class="loading">No cluster events in this dataset.</p>';
    return;
  }
  const html = clusterEvents.map((e, i) => {
    const detail = e.deterministicFacts?.[0]?.detail || "";
    return `<div class="timeline-bar">
      <span class="timeline-label">Cluster ${i + 1}</span>
      <span class="timeline-dot" style="background:#607d8b"></span>
      <span style="font-size:0.78rem;color:var(--ink-soft)">${detail.slice(0, 80)}</span>
    </div>`;
  }).join("");
  document.getElementById("cluster-chart").innerHTML = html;
}

function renderJSON(events) {
  document.getElementById("json-output").textContent = JSON.stringify(events.slice(0, 3), null, 2);
}

document.getElementById("dataset-select").addEventListener("change", (e) => loadDataset(e.target.value));
loadDataset("xanoleptin");
</script>
