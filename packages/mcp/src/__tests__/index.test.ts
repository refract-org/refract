import { describe, expect, it, vi } from "vitest";
import { CLIENT_OPENING, driveStdioServer } from "../../../../tests/support/mcp-stdio.js";
import { type McpServerOptions, runMcpServer } from "../index.js";

// None of these messages reaches a tool, so no handler is ever called.
const options: McpServerOptions = { analyze: vi.fn(), claim: vi.fn(), exportData: vi.fn(), cron: vi.fn() };
const run = () => runMcpServer(options);

describe("mcp stdio transport", () => {
  it("answers requests and stays silent on notifications/initialized", async () => {
    const replies = await driveStdioServer(run, CLIENT_OPENING);

    expect(replies.map((r) => r.id)).toEqual([1, 2]);
    expect(replies.every((r) => r.error === undefined)).toBe(true);
  });

  it("never answers a notification, known or not, but still rejects an unknown request", async () => {
    const replies = await driveStdioServer(run, [
      { jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 1, reason: "client gave up" } },
      { jsonrpc: "2.0", method: "notifications/not-a-method" },
      { jsonrpc: "2.0", id: 3, method: "not/a-method" },
      { jsonrpc: "2.0", id: 4, method: "initialized" },
    ]);

    expect(replies).toEqual([
      { jsonrpc: "2.0", id: 3, error: { code: -32601, message: "Method not found: not/a-method" } },
      { jsonrpc: "2.0", id: 4, error: { code: -32601, message: "Method not found: initialized" } },
    ]);
  });
});
