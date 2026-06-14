import { describe, expect, it, vi } from "vitest";

vi.mock("../commands/claim.js", () => ({
  runClaim: vi.fn(),
  runClaimHistory: vi.fn(),
}));

import { runClaimHistory } from "../commands/claim.js";
import { handleToolCall, TOOLS } from "../commands/mcp.js";

describe("mcp server", () => {
  it("registers get_statement_history in tools list", () => {
    const tool = TOOLS.find((t) => t.name === "get_statement_history");
    expect(tool).toBeDefined();
    expect(tool?.inputSchema.required).toEqual(["statement", "page"]);
    expect(tool?.inputSchema.properties).toHaveProperty("statement");
    expect(tool?.inputSchema.properties).toHaveProperty("page");
    expect(tool?.inputSchema.properties).toHaveProperty("context");
    expect(tool?.inputSchema.properties).toHaveProperty("depth");
    expect(tool?.inputSchema.properties).toHaveProperty("api");
  });

  it("get_statement_history returns a valid response shape", async () => {
    vi.mocked(runClaimHistory).mockResolvedValue({
      statement: "Earth is the third planet from the Sun",
      page: "Earth",
      revisions: [
        {
          revisionId: 100,
          timestamp: "2024-01-01T00:00:00Z",
          text: "Earth is the third planet from the Sun.",
          section: "(lead)",
        },
        {
          revisionId: 101,
          timestamp: "2024-01-02T00:00:00Z",
          text: "Earth is the third planet from the Sun and the only astronomical object known to harbor life.",
          section: "(lead)",
        },
      ],
      status: "modified",
      historySummary: "Statement appeared, then wording expanded.",
    });

    const result = await handleToolCall("get_statement_history", {
      statement: "Earth is the third planet from the Sun",
      page: "Earth",
      depth: "detailed",
    });

    expect(result.content).toHaveLength(1);
    const text = result.content[0].text;
    const json = JSON.parse(text);

    expect(json.statement).toBe("Earth is the third planet from the Sun");
    expect(json.page).toBe("Earth");
    expect(json.revisions).toHaveLength(2);
    expect(json.revisions[0]).toHaveProperty("revisionId");
    expect(json.revisions[0]).toHaveProperty("timestamp");
    expect(json.status).toBe("modified");
    expect(json.history_summary).toBeTruthy();
    expect(["present", "absent", "modified", "contested"]).toContain(json.status);
  });

  it("get_statement_history defaults depth to detailed", async () => {
    vi.mocked(runClaimHistory).mockResolvedValue({
      statement: "Mars is a planet",
      page: "Mars",
      revisions: [{ revisionId: 1, timestamp: "2024-01-01T00:00:00Z", text: "Mars is a planet.", section: "(lead)" }],
      status: "present",
      historySummary: "Present continuously.",
    });

    await handleToolCall("get_statement_history", {
      statement: "Mars is a planet",
      page: "Mars",
    });

    expect(runClaimHistory).toHaveBeenCalledWith("Mars", "Mars is a planet", false, undefined, undefined, undefined);
  });

  it("get_statement_history passes api url to claim history", async () => {
    vi.mocked(runClaimHistory).mockResolvedValue({
      statement: "Venus is a planet",
      page: "Venus",
      revisions: [],
      status: "absent",
      historySummary: "Not found.",
    });

    await handleToolCall("get_statement_history", {
      statement: "Venus is a planet",
      page: "Venus",
      api: "https://wiki.example.com/api.php",
    });

    expect(runClaimHistory).toHaveBeenCalledWith(
      "Venus",
      "Venus is a planet",
      false,
      "https://wiki.example.com/api.php",
      undefined,
      undefined,
    );
  });
});
