import { PassThrough } from "node:stream";
import { vi } from "vitest";

/** What an MCP client sends on connecting: the handshake, then its first request. */
export const CLIENT_OPENING = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test-client", version: "0" } },
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list" },
];

/**
 * Run a stdio MCP server against a scripted client and return every line it
 * wrote to stdout, parsed. Each message goes to the server's stdin as one line,
 * then stdin closes, which ends the server's read loop and lets `run` resolve.
 *
 * The server runs in-process from source rather than as a spawned `refract
 * mcp`, which would run whatever `dist` was last built. Only replies written
 * before `run` resolves are collected: a server that does not await its
 * handlers must answer these messages synchronously for them to be seen.
 */
export async function driveStdioServer(
  run: () => Promise<void>,
  messages: readonly object[],
): Promise<Record<string, unknown>[]> {
  const stdin = new PassThrough();
  const written: string[] = [];
  const spies = [
    vi.spyOn(process, "stdin", "get").mockReturnValue(stdin as unknown as typeof process.stdin),
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      written.push(String(chunk));
      return true;
    }),
    vi.spyOn(process.stderr, "write").mockImplementation(() => true),
  ];
  try {
    for (const message of messages) stdin.write(`${JSON.stringify(message)}\n`);
    stdin.end();
    await run();
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  return written
    .join("")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}
