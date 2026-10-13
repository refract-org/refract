import { Database, type QueryBuilder, type Statement } from "bun:sqlite";
import type { ClaimObject, Revision } from "@refract-org/evidence-graph";

export interface PersistenceConfig {
  dbPath: string;
}

export interface PersistenceAdapter {
  insertRevision(rev: Revision): void;
  insertRevisions(revisions: Revision[]): void;
  getRevisions(pageTitle: string, options?: { limit?: number; direction?: "newer" | "older" }): Revision[];
  hasRevision(revId: number): boolean;
  getLatestTimestamp(pageTitle: string): string | undefined;
  insertClaim(claim: ClaimObject): void;
  getClaims(pageTitle: string): Array<{
    claim_id: string;
    identity_key: string;
    current_state: string;
    proposition_type: string;
    first_seen_rev_id: number;
    first_seen_at: string;
  }>;
  close(): void;
}

export class Persistence implements PersistenceAdapter {
  private db: Database;
  private insertRevStmt: Statement;
  private insertClaimStmt: Statement;
  private getRevisionsAsc: QueryBuilder;
  private getRevisionsDesc: QueryBuilder;
  private hasRevisionQuery: QueryBuilder;
  private latestTimestampQuery: QueryBuilder;
  private getClaimsQuery: QueryBuilder;

  constructor(config: PersistenceConfig) {
    this.db = new Database(config.dbPath);
    this.db.run("PRAGMA journal_mode=WAL");
    this.db.run("PRAGMA synchronous=NORMAL");
    this.db.run("PRAGMA cache_size=-64000");
    this.db.run("PRAGMA mmap_size=268435456");
    this.db.run("PRAGMA busy_timeout=5000");
    this.migrate();

    this.insertRevStmt = this.db.prepare(`
      INSERT OR REPLACE INTO revisions
        (rev_id, page_id, page_title, timestamp, comment, content, size, minor, parent_id, content_available)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertClaimStmt = this.db.prepare(`
      INSERT OR REPLACE INTO claims
        (claim_id, identity_key, page_title, page_id, current_state,
         proposition_type, first_seen_rev_id, first_seen_at,
         last_seen_rev_id, last_seen_at, phase)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.getRevisionsAsc = this.db.query(`
      SELECT rev_id, page_id, page_title, timestamp, comment, content, size, minor, parent_id, content_available
      FROM revisions
      WHERE page_title = ?
      ORDER BY timestamp ASC
      LIMIT ?
    `);
    this.getRevisionsDesc = this.db.query(`
      SELECT rev_id, page_id, page_title, timestamp, comment, content, size, minor, parent_id, content_available
      FROM revisions
      WHERE page_title = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    this.hasRevisionQuery = this.db.query("SELECT 1 FROM revisions WHERE rev_id = ? LIMIT 1");
    this.latestTimestampQuery = this.db.query("SELECT MAX(timestamp) as latest FROM revisions WHERE page_title = ?");
    this.getClaimsQuery = this.db.query(`
      SELECT claim_id, identity_key, current_state, proposition_type,
             first_seen_rev_id, first_seen_at
      FROM claims WHERE page_title = ?
    `);
  }

  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS revisions (
        rev_id INTEGER PRIMARY KEY,
        page_id INTEGER NOT NULL,
        page_title TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        comment TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        size INTEGER NOT NULL DEFAULT 0,
        minor INTEGER NOT NULL DEFAULT 0,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const columns = this.db.query("PRAGMA table_info(revisions)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "parent_id"))
      this.db.run("ALTER TABLE revisions ADD COLUMN parent_id INTEGER");
    if (!columns.some((column) => column.name === "content_available"))
      this.db.run("ALTER TABLE revisions ADD COLUMN content_available INTEGER");

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_revisions_page
      ON revisions(page_title, timestamp)
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS claims (
        claim_id TEXT PRIMARY KEY,
        identity_key TEXT NOT NULL,
        page_title TEXT NOT NULL,
        page_id INTEGER NOT NULL,
        current_state TEXT NOT NULL DEFAULT 'absent',
        proposition_type TEXT NOT NULL DEFAULT 'unknown',
        first_seen_rev_id INTEGER NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_rev_id INTEGER,
        last_seen_at TEXT,
        phase TEXT NOT NULL DEFAULT 'Phase 0',
        stored_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_claims_page
      ON claims(page_title)
    `);
  }

  insertRevision(rev: Revision): void {
    this.insertRevStmt.run(
      rev.revId,
      rev.pageId,
      rev.pageTitle,
      rev.timestamp,
      rev.comment,
      rev.content,
      rev.size,
      rev.minor ? 1 : 0,
      rev.parentId ?? null,
      rev.contentAvailable === undefined ? null : rev.contentAvailable ? 1 : 0,
    );
  }

  insertRevisions(revisions: Revision[]): void {
    this.db.transaction(() => {
      for (const rev of revisions) {
        this.insertRevision(rev);
      }
    })();
  }

  getRevisions(pageTitle: string, options?: { limit?: number; direction?: "newer" | "older" }): Revision[] {
    const dir = options?.direction === "newer" ? this.getRevisionsAsc : this.getRevisionsDesc;
    const limit = options?.limit ?? 100;
    const rows = dir.all(pageTitle, limit) as Array<{
      rev_id: number;
      page_id: number;
      page_title: string;
      timestamp: string;
      comment: string;
      content: string;
      size: number;
      minor: number;
      parent_id?: number | null;
      content_available?: number | null;
    }>;

    return rows.map((r) => ({
      revId: r.rev_id,
      parentId: r.parent_id ?? undefined,
      contentAvailable: r.content_available == null ? undefined : r.content_available === 1,
      pageId: r.page_id,
      pageTitle: r.page_title,
      timestamp: r.timestamp,
      comment: r.comment,
      content: r.content,
      size: r.size,
      minor: r.minor === 1,
    }));
  }

  hasRevision(revId: number): boolean {
    const row = this.hasRevisionQuery.get(revId);
    return row !== null;
  }

  getLatestTimestamp(pageTitle: string): string | undefined {
    const row = this.latestTimestampQuery.get(pageTitle) as { latest: string | null } | undefined;
    return row?.latest ?? undefined;
  }

  insertClaim(claim: ClaimObject): void {
    this.insertClaimStmt.run(
      claim.identity.claimId,
      claim.identity.identityKey,
      claim.identity.pageTitle,
      claim.identity.pageId,
      claim.currentState,
      claim.propositionType,
      claim.lineage.firstSeenRevisionId,
      claim.lineage.firstSeenAt,
      claim.lineage.lastSeenRevisionId ?? null,
      claim.lineage.lastSeenAt ?? null,
      claim.phase,
    );
  }

  getClaims(pageTitle: string): Array<{
    claim_id: string;
    identity_key: string;
    current_state: string;
    proposition_type: string;
    first_seen_rev_id: number;
    first_seen_at: string;
  }> {
    return this.getClaimsQuery.all(pageTitle) as Array<{
      claim_id: string;
      identity_key: string;
      current_state: string;
      proposition_type: string;
      first_seen_rev_id: number;
      first_seen_at: string;
    }>;
  }

  close(): void {
    this.db.close();
  }
}
