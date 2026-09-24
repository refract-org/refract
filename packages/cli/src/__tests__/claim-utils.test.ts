import { describe, expect, it, vi } from "vitest";

vi.mock("bun:sqlite", () => {
  class MockDB {
    run() {}
    query() {
      return { all: () => [], get: () => null };
    }
    prepare() {
      return { run: () => {} };
    }
    transaction(fn: () => void) {
      fn();
    }
    close() {}
  }
  return { Database: MockDB };
});

import { stripWikitext } from "@refract-org/analyzers";
import { fuzzyFindText } from "../commands/claim.js";

describe("stripWikitext", () => {
  it("strips HTML comments", () => {
    const result = stripWikitext("text <!-- comment --> more");
    expect(result).not.toContain("comment");
  });

  it("strips ref tags", () => {
    expect(stripWikitext("text<ref>citation</ref>more")).toBe("textmore");
  });

  it("strips templates", () => {
    expect(stripWikitext("{{citation needed}}")).toBe("");
  });

  it("strips wikilinks keeping display text", () => {
    expect(stripWikitext("[[Foo]] and [[Bar|baz]]")).toBe("Foo and baz");
  });

  it("strips bold and italic markers", () => {
    expect(stripWikitext("'''bold''' and ''italic''")).toBe("bold and italic");
  });

  it("collapses multiple newlines", () => {
    expect(stripWikitext("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("removes HTML tags", () => {
    expect(stripWikitext("hello<br/>world")).toBe("helloworld");
  });
});

describe("fuzzyFindText", () => {
  it("finds exact match", () => {
    const result = fuzzyFindText("Earth is the third planet", "Earth is the third planet from the Sun.");
    expect(result).toBeTruthy();
    expect(result?.length).toBeGreaterThan(0);
  });

  it("finds case-insensitive match", () => {
    const result = fuzzyFindText("earth is the third", "Earth is the third planet.");
    expect(result).toBeTruthy();
  });

  it("finds partial matches with sufficient word overlap", () => {
    const result = fuzzyFindText("Earth third planet Sun", "Earth is the third planet from the Sun.");
    expect(result).toBeTruthy();
  });

  it("returns empty string for no match", () => {
    const result = fuzzyFindText("completely unrelated", "Earth is a planet.");
    expect(result).toBe("");
  });

  it("handles empty claim text (returns source text since empty is always found)", () => {
    const result = fuzzyFindText("", "Some text.");
    expect(result).toBeTruthy();
    expect(result?.length).toBeGreaterThan(0);
  });
});
