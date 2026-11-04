-- refract-analytics.sql
-- Pre-built DuckDB views for Refract event streams.
-- Load with: duckdb -c ".read examples/refract-analytics.sql"
-- Then query: SELECT * FROM contested_claims;

-- Claims that have been reverted, lost citations, or generated disputes.
-- High-score claims are candidates for closer examination.
CREATE OR REPLACE VIEW contested_claims AS
SELECT
  claim_id,
  after AS claim_text,
  min(timestamp) AS first_seen,
  max(timestamp) AS last_seen,
  count(*) FILTER (WHERE event_type = 'revert_detected') AS revert_count,
  count(*) FILTER (WHERE event_type LIKE 'citation_%') AS citation_churn,
  count(*) FILTER (WHERE event_type LIKE 'talk_%') AS talk_activity,
  count(*) FILTER (WHERE event_type LIKE 'template_%') AS template_disputes,
  count(*) FILTER (WHERE event_type = 'edit_cluster_detected') AS edit_clusters,
  revert_count + citation_churn + template_disputes + edit_clusters AS contestation_score
FROM read_json_auto('events.jsonl')
WHERE claim_id IS NOT NULL
  AND event_type LIKE 'sentence_%'
GROUP BY claim_id, after
ORDER BY contestation_score DESC;

-- Citation activity aggregated by month.
-- Months with more removals than additions indicate net citation loss.
CREATE OR REPLACE VIEW citation_churn_by_month AS
SELECT
  strftime(timestamp, '%Y-%m') AS month,
  count(*) FILTER (WHERE event_type = 'citation_added') AS added,
  count(*) FILTER (WHERE event_type = 'citation_removed') AS removed,
  count(*) FILTER (WHERE event_type = 'citation_replaced') AS replaced,
  added + removed + replaced AS total_churn
FROM read_json_auto('events.jsonl')
WHERE event_type LIKE 'citation_%'
GROUP BY month
ORDER BY month;

-- Sections ranked by activity and conflict.
-- Sections with high reverts + low talk activity = edit-warred.
-- Sections with high reverts + high talk activity = deliberated.
CREATE OR REPLACE VIEW section_activity AS
SELECT
  section,
  count(*) AS total_events,
  count(*) FILTER (WHERE event_type = 'revert_detected') AS reverts,
  count(*) FILTER (WHERE event_type LIKE 'citation_%') AS citation_events,
  count(*) FILTER (WHERE event_type LIKE 'talk_%') AS talk_events,
  count(*) FILTER (WHERE event_type = 'edit_cluster_detected') AS clusters,
  count(*) FILTER (WHERE event_type LIKE 'sentence_%') AS sentence_events
FROM read_json_auto('events.jsonl')
GROUP BY section
HAVING reverts > 0 OR clusters > 0
ORDER BY (reverts + clusters) DESC;

-- Event type distribution.
CREATE OR REPLACE VIEW event_type_distribution AS
SELECT
  event_type,
  count(*) AS count,
  round(count(*) * 100.0 / sum(count(*)) OVER (), 1) AS pct
FROM read_json_auto('events.jsonl')
GROUP BY event_type
ORDER BY count DESC;

-- Talk-to-content ratio per page.
-- Low ratio + high reverts = edit warring. High ratio = active deliberation.
CREATE OR REPLACE VIEW talk_content_ratio AS
SELECT
  count(*) FILTER (WHERE event_type LIKE 'talk_%') AS talk_events,
  count(*) FILTER (WHERE event_type LIKE 'sentence_%' OR event_type = 'revert_detected') AS content_events,
  count(*) FILTER (WHERE event_type = 'revert_detected') AS reverts,
  CASE
    WHEN content_events > 0 THEN round(talk_events * 100.0 / content_events, 1)
    ELSE 0
  END AS talk_pct
FROM read_json_auto('events.jsonl');
