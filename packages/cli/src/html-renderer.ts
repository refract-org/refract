import type { EvidenceEvent, Revision } from "@refract-org/evidence-graph";

const EVENT_COLORS: Record<string, string> = {
  sentence_first_seen: "#4caf50",
  sentence_reintroduced: "#8bc34a",
  sentence_removed: "#f44336",
  sentence_modified: "#ff9800",
  citation_added: "#00bcd4",
  citation_removed: "#e91e63",
  citation_replaced: "#ff5722",
  template_added: "#607d8b",
  template_removed: "#795548",
  revert_detected: "#d32f2f",
  section_reorganized: "#9e9e9e",
  edit_cluster_detected: "#673ab7",
  talk_activity_spike: "#e91e63",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

function renderTimeline(revisions: Revision[], events: EvidenceEvent[]): string {
  if (revisions.length === 0) return '<div class="empty">No revisions</div>';
  const firstTs = new Date(revisions[0].timestamp).getTime();
  const lastTs = new Date(revisions[revisions.length - 1].timestamp).getTime();
  const span = lastTs - firstTs || 1;
  const markers = revisions
    .map((r) => {
      const pct = ((new Date(r.timestamp).getTime() - firstTs) / span) * 100;
      return `<div class="timeline-marker" style="left:${pct}%" title="r${r.revId} — ${r.timestamp.slice(0, 10)}"></div>`;
    })
    .join("\n");
  const firstDate = revisions[0].timestamp.slice(0, 10);
  const lastDate = revisions[revisions.length - 1].timestamp.slice(0, 10);
  return `
    <div class="timeline">
      <div class="timeline-track">${markers}</div>
      <div class="timeline-labels"><span>${firstDate}</span><span>${lastDate}</span></div>
    </div>
    <div style="margin-top:16px; font-size:12px; color:var(--dim)">
      ${events.length} events across ${revisions.length} revisions
    </div>`;
}

function renderRevisionTable(revisions: Revision[], events: EvidenceEvent[]): string {
  if (revisions.length === 0) return '<div class="empty">No revisions</div>';
  const eventByRev: Record<number, number> = {};
  for (const e of events) {
    eventByRev[e.toRevisionId] = (eventByRev[e.toRevisionId] ?? 0) + 1;
  }
  const sorted = [...revisions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return sorted
    .map((r) => {
      const eventCount = eventByRev[r.revId] ?? 0;
      const date = r.timestamp.slice(0, 10);
      const comment = (r.comment || "").slice(0, 80);
      return `<div class="event-row">
        <span style="font-weight:600;min-width:60px">r${r.revId}</span>
        <span style="font-size:12px;color:var(--dim);min-width:100px">${date}</span>
        <span style="font-size:12px;min-width:100px">${escapeHtml(r.user ?? "anon")}</span>
        <span style="flex:1;font-size:12px;color:var(--dim)">${escapeHtml(comment)}</span>
        <span style="font-size:11px;color:var(--accent)">${eventCount > 0 ? `${eventCount} events` : ""}</span>
      </div>`;
    })
    .join("\n");
}

function renderSummary(events: EvidenceEvent[], eventCounts: Record<string, number>): string {
  const typeRows = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => {
      const color = EVENT_COLORS[type] ?? "#999";
      return `<div class="event-row">
        <span class="event-type" style="background:${color}22;color:${color}">${escapeHtml(type)}</span>
        <span style="font-weight:600">${count}</span>
      </div>`;
    })
    .join("\n");
  const sections = [...new Set(events.map((e) => e.section).filter(Boolean))];
  const withConf = events.filter((e) => e.modelInterpretation?.confidence != null);
  const avgConf =
    withConf.length > 0
      ? withConf.reduce((s, e) => s + (e.modelInterpretation?.confidence ?? 0), 0) / withConf.length
      : null;
  return `
    <h3 style="margin-bottom:16px;font-size:14px">Event Type Breakdown</h3>
    ${typeRows}
    <h3 style="margin:24px 0 16px;font-size:14px">Stats</h3>
    <div class="event-row"><span>Total events</span><span style="font-weight:600">${events.length}</span></div>
    <div class="event-row"><span>Sections affected</span><span style="font-weight:600">${sections.length}</span></div>
    <div class="event-row"><span>Event types</span><span style="font-weight:600">${Object.keys(eventCounts).length}</span></div>
    ${avgConf != null ? `<div class="event-row"><span>Avg confidence</span><span style="font-weight:600">${Math.round(avgConf * 100)}%</span></div>` : ""}
  `;
}

export function renderHtmlReport(
  pageTitle: string,
  events: EvidenceEvent[],
  revisions: Revision[],
  showJsonDownload?: boolean,
): string {
  const sortedRevs = [...revisions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const eventCounts = countBy(events, (e) => e.eventType);
  const sectionList = [...new Set(events.map((e) => e.section).filter(Boolean))];
  const eventColorsJson = JSON.stringify(EVENT_COLORS);

  const jsonDownloadHtml = showJsonDownload
    ? `<a class="export-link" href="/api/events" download>↓ JSON</a>`
    : `<button class="export-link" onclick="downloadJSON()">↓ JSON</button>`;

  const inlineDownloadScript = showJsonDownload
    ? ""
    : `
function downloadJSON() {
  const blob = new Blob([JSON.stringify(allEvents, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '${escapeHtml(pageTitle)}-events.json';
  a.click();
}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Refract — ${escapeHtml(pageTitle)}</title>
<style>
:root {
  --bg: #0d1117; --fg: #c9d1d9; --accent: #58a6ff;
  --border: #30363d; --card: #161b22; --dim: #8b949e;
  --code: #343941;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--fg); line-height: 1.5; }
header { background: var(--card); border-bottom: 1px solid var(--border); padding: 12px 24px; display: flex; align-items: center; gap: 16px; }
header h1 { font-size: 16px; font-weight: 600; }
header .meta { font-size: 12px; color: var(--dim); }
nav { display: flex; gap: 4px; padding: 8px 24px; background: var(--bg); border-bottom: 1px solid var(--border); }
nav button { background: none; border: 1px solid var(--border); color: var(--fg); padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
nav button:hover { background: var(--code); }
nav button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
main { padding: 24px; max-width: 1400px; margin: 0 auto; }
.tab { display: none; }
.tab.active { display: block; }
.timeline { position: relative; padding: 0; }
.timeline-track { position: relative; height: 60px; background: var(--code); border-radius: 8px; margin-bottom: 8px; overflow: hidden; }
.timeline-marker { position: absolute; top: 4px; width: 2px; height: 52px; background: var(--accent); opacity: 0.6; cursor: pointer; }
.timeline-marker:hover { opacity: 1; width: 3px; }
.timeline-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--dim); padding: 0 4px; }
.event-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--border); align-items: flex-start; font-size: 13px; }
.event-row:hover { background: var(--card); }
.event-type { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.event-section { color: var(--accent); min-width: 80px; font-size: 12px; }
.event-text { flex: 1; min-width: 200px; color: var(--dim); font-family: monospace; font-size: 12px; max-height: 3em; overflow: hidden; }
.event-revs { font-size: 11px; color: var(--dim); white-space: nowrap; }
.event-diff { background: var(--code); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 11px; cursor: pointer; color: var(--accent); }
.event-diff:hover { background: var(--border); }
.event-confidence { font-size: 11px; color: var(--dim); }
#diff-modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100; align-items: center; justify-content: center; }
#diff-modal.open { display: flex; }
#diff-modal .modal { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; max-width: 900px; width: 90%; max-height: 80vh; overflow: auto; }
#diff-modal .modal h3 { margin-bottom: 12px; font-size: 14px; }
#diff-modal .close { float: right; background: none; border: none; color: var(--fg); font-size: 20px; cursor: pointer; }
.diff-side { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.diff-side pre { background: var(--code); border-radius: 6px; padding: 12px; overflow: auto; white-space: pre-wrap; font-size: 12px; max-height: 300px; }
.diff-label { font-size: 11px; color: var(--dim); margin-bottom: 4px; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.filter-bar select { background: var(--code); border: 1px solid var(--border); color: var(--fg); padding: 6px 12px; border-radius: 6px; font-size: 13px; }
.fact-chip { display: inline-block; background: var(--code); border-radius: 4px; padding: 1px 6px; font-size: 11px; margin-right: 4px; }
.export-link { color: var(--accent); text-decoration: none; font-size: 13px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; display: inline-block; cursor: pointer; }
.export-link:hover { background: var(--code); }
.empty { text-align: center; padding: 48px; color: var(--dim); }
.pagination { display: flex; align-items: center; gap: 12px; padding: 12px 0; font-size: 13px; }
.pagination button { background: var(--code); border: 1px solid var(--border); color: var(--fg); padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.pagination button:hover:not(:disabled) { background: var(--border); }
.pagination button:disabled { opacity: 0.4; cursor: default; }
.page-info { color: var(--dim); }
.page-size-label { color: var(--dim); font-size: 12px; margin-left: 8px; }
.pagination select { background: var(--code); border: 1px solid var(--border); color: var(--fg); padding: 5px 8px; border-radius: 6px; font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(pageTitle)}</h1>
  <span class="meta">${revisions.length} revisions · ${events.length} events · ${sortedRevs.length > 0 ? new Date(sortedRevs[sortedRevs.length - 1].timestamp).toLocaleDateString() : ""}</span>
</header>
<nav>
  <button onclick="showTab('events')" class="active" id="nav-events">Events (${events.length})</button>
  <button onclick="showTab('timeline')" id="nav-timeline">Timeline</button>
  <button onclick="showTab('revisions')" id="nav-revisions">Revisions (${revisions.length})</button>
  <button onclick="showTab('summary')" id="nav-summary">Summary</button>
  <span style="flex:1"></span>
  ${jsonDownloadHtml}
</nav>
<main>
  <div id="tab-events" class="tab active">
    <div class="filter-bar">
      <select id="eventFilter" onchange="filterEvents()">
        <option value="">All event types</option>
        ${[...new Set(events.map((e) => e.eventType))]
          .sort()
          .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)} (${eventCounts[t] ?? 0})</option>`)
          .join("")}
      </select>
      <select id="sectionFilter" onchange="filterEvents()">
        <option value="">All sections</option>
        ${sectionList
          .sort()
          .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
          .join("")}
      </select>
    </div>
    <div class="pagination" id="pagination-top">
      <button onclick="prevPage()" id="prevBtn" disabled>&larr; Prev</button>
      <span id="pageInfo" class="page-info">Page 1 of 1</span>
      <button onclick="nextPage()" id="nextBtn">Next &rarr;</button>
      <span class="page-size-label">Per page:</span>
      <select id="pageSize" onchange="setPageSize(this.value)">
        <option value="25">25</option>
        <option value="50" selected>50</option>
        <option value="100">100</option>
        <option value="0">All</option>
      </select>
    </div>
    <div id="eventList"></div>
    <div class="pagination" id="pagination-bottom">
      <button onclick="prevPage()" id="prevBtnBot" disabled>&larr; Prev</button>
      <span id="pageInfoBot" class="page-info">Page 1 of 1</span>
      <button onclick="nextPage()" id="nextBtnBot">Next &rarr;</button>
    </div>
  </div>
  <div id="tab-timeline" class="tab">${renderTimeline(sortedRevs, events)}</div>
  <div id="tab-revisions" class="tab">${renderRevisionTable(sortedRevs, events)}</div>
  <div id="tab-summary" class="tab">${renderSummary(events, eventCounts)}</div>
</main>
<div id="diff-modal" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <button class="close" onclick="closeModal()">&times;</button>
    <h3 id="diff-title"></h3>
    <div id="diff-content" class="diff-side"></div>
  </div>
</div>
<script>
const eventColors = ${eventColorsJson};
const allEvents = ${JSON.stringify(
    events.map((e) => ({
      eventType: e.eventType,
      section: e.section,
      before: e.before,
      after: e.after,
      fromRevisionId: e.fromRevisionId,
      toRevisionId: e.toRevisionId,
      timestamp: e.timestamp,
      deterministicFacts: e.deterministicFacts?.map((f) => `${f.fact}${f.detail ? `: ${f.detail}` : ""}`),
      confidence: e.modelInterpretation?.confidence,
    })),
  )};

let currentPage = 1;
let pageSize = 50;
let filteredEvents = [];

function getFilteredEvents() {
  const typeFilter = document.getElementById('eventFilter').value;
  const sectionFilter = document.getElementById('sectionFilter').value;
  if (!typeFilter && !sectionFilter) return allEvents;
  return allEvents.filter(function(e) {
    return (!typeFilter || e.eventType === typeFilter) &&
           (!sectionFilter || e.section === sectionFilter);
  });
}

function renderEventHTML(ev) {
  const color = eventColors[ev.eventType] || '#999';
  const facts = (ev.deterministicFacts || [])
    .map(function(f) { return '<span class="fact-chip">' + esc(f) + '</span>'; })
    .join('');
  const text = ev.after || ev.before || '';
  const typeClass = ev.eventType.replace(/_/g, ' ');
  const conf = ev.confidence != null
    ? '<span class="event-confidence">' + Math.round(ev.confidence * 100) + '%</span>'
    : '';
  return '<div class="event-row" data-type="' + esc(ev.eventType) + '" data-section="' + esc(ev.section || '') + '">' +
    '<span class="event-type" style="background:' + color + '22;color:' + color + '">' + typeClass + '</span>' +
    '<span class="event-section">' + esc(ev.section || '\u2014') + '</span>' +
    '<span class="event-text" title="' + esc(text) + '">' + esc(text.slice(0, 120)) + '</span>' +
    '<span class="event-revs">r' + ev.fromRevisionId + '\u2192r' + ev.toRevisionId + '</span>' +
    '<button class="event-diff" onclick="showDiff(' + ev.fromRevisionId + ',' + ev.toRevisionId + ',' + "'" + esc(ev.eventType) + "'" + ')">diff</button>' +
    conf +
    '<span class="fact-chip-container">' + facts + '</span>' +
    '</div>';
}

function renderPage() {
  filteredEvents = getFilteredEvents();
  const total = filteredEvents.length;
  const effectiveSize = pageSize === 0 ? total : pageSize;
  const totalPages = Math.max(1, Math.ceil(total / effectiveSize));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  const start = pageSize === 0 ? 0 : (currentPage - 1) * pageSize;
  const end = pageSize === 0 ? total : start + pageSize;
  const pageEvents = filteredEvents.slice(start, end);
  const list = document.getElementById('eventList');
  if (pageEvents.length === 0) {
    list.innerHTML = '<div class="empty">No events match the current filters</div>';
  } else {
    list.innerHTML = pageEvents.map(renderEventHTML).join('\n');
  }
  const displayPage = pageSize === 0 ? 1 : currentPage;
  const displayTotal = pageSize === 0 ? 1 : totalPages;
  const info = 'Page ' + displayPage + ' of ' + displayTotal + ' (' + total + ' events)';
  document.getElementById('pageInfo').textContent = info;
  document.getElementById('pageInfoBot').textContent = info;
  const atStart = currentPage <= 1 || pageSize === 0;
  const atEnd = currentPage >= totalPages || pageSize === 0;
  document.getElementById('prevBtn').disabled = atStart;
  document.getElementById('prevBtnBot').disabled = atStart;
  document.getElementById('nextBtn').disabled = atEnd;
  document.getElementById('nextBtnBot').disabled = atEnd;
}

function filterEvents() {
  currentPage = 1;
  renderPage();
}

function nextPage() {
  currentPage++;
  renderPage();
}

function prevPage() {
  currentPage--;
  renderPage();
}

function setPageSize(val) {
  pageSize = parseInt(val);
  currentPage = 1;
  renderPage();
}

function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById('tab-' + name);
  const nav = document.getElementById('nav-' + name);
  if (tab) tab.classList.add('active');
  if (nav) nav.classList.add('active');
}

function showDiff(from, to, eventType) {
  const ev = allEvents.find(e => e.fromRevisionId === from && e.toRevisionId === to && e.eventType === eventType);
  if (!ev) return;
  document.getElementById('diff-title').textContent = eventType.replace(/_/g, ' ') + ' (rev ' + from + ' \u2192 ' + to + ')';
  document.getElementById('diff-content').innerHTML =
    '<div><div class="diff-label">Before (rev ' + from + ')</div><pre>' + esc(ev.before || '(empty)') + '</pre></div>' +
    '<div><div class="diff-label">After (rev ' + to + ')</div><pre>' + esc(ev.after || '(empty)') + '</pre></div>';
  document.getElementById('diff-modal').classList.add('open');
}

function closeModal() { document.getElementById('diff-modal').classList.remove('open'); }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
${inlineDownloadScript}
renderPage();
</script>
</body>
</html>`;
}
