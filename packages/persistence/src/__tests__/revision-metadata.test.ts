import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("migrates an existing SQLite cache and retains parent and withheld-text metadata", () => {
  const dir = mkdtempSync(join(tmpdir(), "refract-cache-metadata-"));
  try {
    const script = `
      import {Database} from "bun:sqlite";
      import {Persistence} from "./packages/persistence/dist/src/index.js";
      const path = process.argv[1];
      const old = new Database(path);
      old.run("CREATE TABLE revisions (rev_id INTEGER PRIMARY KEY, page_id INTEGER, page_title TEXT, timestamp TEXT, comment TEXT, content TEXT, size INTEGER, minor INTEGER)");
      old.run("INSERT INTO revisions VALUES (1,1,'Page','2025-01-01T00:00:00Z','','Original text',13,0)");
      old.close();
      const db = new Persistence({dbPath:path});
      db.insertRevisions([{revId:2,parentId:1,contentAvailable:false,pageId:1,pageTitle:'Page',timestamp:'2025-01-02T00:00:00Z',comment:'',content:'',size:0,minor:false}]);
      console.log(JSON.stringify(db.getRevisions('Page',{direction:'newer'})));
      db.close();
    `;
    const revisions = JSON.parse(execFileSync("bun", ["--eval", script, join(dir, "cache.db")], { encoding: "utf8" }));
    expect(revisions[0].parentId).toBeUndefined();
    expect(revisions[0].contentAvailable).toBeUndefined();
    expect(revisions[1]).toMatchObject({ parentId: 1, contentAvailable: false });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
