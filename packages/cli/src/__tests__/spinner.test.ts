import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spinner } from "../render.js";

function fakeStream(options: { isTTY: boolean; columns?: number }) {
  const writes: string[] = [];
  return { ...options, writes, write: (text: string) => writes.push(text) };
}

// Colors are off under vitest, because stdout is not a terminal.
const CLEAR = "\r\x1b[2K";

describe("spinner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hunts through each focus state on a terminal, in order, and repeats", () => {
    const stream = fakeStream({ isTTY: true });
    const progress = spinner(stream);
    progress.start("Analyzing");
    vi.advanceTimersByTime(350 * 4);
    progress.stop();
    expect(stream.writes.slice(0, 5)).toEqual([
      `${CLEAR})>   |· Analyzing\r`,
      `${CLEAR})> · |  Analyzing\r`,
      `${CLEAR})>   :  Analyzing\r`,
      `${CLEAR})>   •  Analyzing\r`,
      `${CLEAR})>   |· Analyzing\r`,
    ]);
  });

  it("keeps the message beside the focused frame when it lands", () => {
    const stream = fakeStream({ isTTY: true });
    const progress = spinner(stream);
    progress.start("Analyzing");
    progress.land();
    expect(stream.writes.at(-1)).toBe(`${CLEAR})>   •  Analyzing\n`);
    const written = stream.writes.length;
    vi.advanceTimersByTime(5000);
    expect(stream.writes).toHaveLength(written);
  });

  it("clears the line when stopped, so a failure does not read as focused", () => {
    const stream = fakeStream({ isTTY: true });
    const progress = spinner(stream);
    progress.start("Analyzing");
    progress.stop();
    expect(stream.writes.at(-1)).toBe(CLEAR);
    const written = stream.writes.length;
    vi.advanceTimersByTime(5000);
    expect(stream.writes).toHaveLength(written);
  });

  it("prints the message once and draws nothing off a terminal", () => {
    const stream = fakeStream({ isTTY: false });
    const progress = spinner(stream);
    progress.start("Analyzing");
    vi.advanceTimersByTime(5000);
    progress.land();
    expect(stream.writes).toEqual(["Analyzing\n"]);
  });

  it("clips a frame to the terminal width but lands with the whole message", () => {
    const stream = fakeStream({ isTTY: true, columns: 12 });
    const progress = spinner(stream);
    progress.start("Analyzing a long title");
    expect(stream.writes[0]).toBe(`${CLEAR})>   |· Anal\r`);
    progress.land();
    expect(stream.writes.at(-1)).toBe(`${CLEAR})>   •  Analyzing a long title\n`);
  });
});
