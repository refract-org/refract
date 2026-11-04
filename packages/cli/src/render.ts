import type { EvidenceEvent } from "@refract-org/evidence-graph";

const isTTY = process.stdout.isTTY;
const noColor = process.env.NO_COLOR !== undefined;
const forceColor = process.env.FORCE_COLOR !== undefined;
const useColor = (isTTY && !noColor) || forceColor;

function ansi(code: number) {
  return (text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
}

export const bold = ansi(1);
export const dim = ansi(2);
export const red = ansi(31);
export const green = ansi(32);
export const yellow = ansi(33);
export const blue = ansi(34);
export const cyan = ansi(36);
export const gray = ansi(90);

export function heading(text: string): string {
  const bar = "─".repeat(Math.min(50, text.length + 4));
  return `\n${cyan(bar)}\n  ${bold(text)}\n${cyan(bar)}`;
}

export function eventIcon(eventType: string): string {
  if (eventType.startsWith("citation_")) return yellow("◆");
  if (eventType.startsWith("template_")) return cyan("◇");
  if (eventType.startsWith("sentence_")) return green("●");
  if (eventType === "revert_detected") return red("◉");
  if (eventType.startsWith("section_")) return gray("○");
  if (eventType.startsWith("category_")) return dim("△");
  if (eventType.startsWith("wikilink_")) return blue("◇");
  if (eventType === "protection_changed") return red("⬡");
  return gray("·");
}

export function eventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    citation_added: "citation added",
    citation_removed: "citation removed",
    citation_replaced: "citation replaced",
    template_added: "template added",
    template_removed: "template removed",
    template_parameter_changed: "param changed",
    section_reorganized: "section changed",
    sentence_first_seen: "sentence introduced",
    sentence_removed: "sentence removed",
    sentence_modified: "sentence modified",
    sentence_reintroduced: "sentence reintroduced",
    wikilink_added: "wikilink added",
    wikilink_removed: "wikilink removed",
    category_added: "category added",
    category_removed: "category removed",
    revert_detected: "revert detected",
    protection_changed: "protection changed",
    lead_promotion: "lead promoted",
    lead_demotion: "lead demoted",
    talk_page_correlated: "talk page correlated",
    talk_thread_opened: "talk thread opened",
    talk_thread_archived: "talk thread archived",
    talk_reply_added: "talk reply added",
    talk_activity_spike: "talk activity spike",
    edit_cluster_detected: "edit cluster detected",
  };
  return labels[eventType] ?? eventType.replace(/_/g, " ");
}

const EXCERPT_LENGTH = 240;

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH)}\u2026` : flat;
}

export function formatEvent(event: EvidenceEvent): string {
  const icon = eventIcon(event.eventType);
  const label = eventLabel(event.eventType);
  const rev = dim(`(rev ${event.fromRevisionId}\u2192${event.toRevisionId})`);
  let line = `  ${icon} ${bold(label)} ${rev}`;

  if (event.section) {
    line += ` ${gray(`[${event.section}]`)}`;
  }

  const detail = event.deterministicFacts
    .filter((f) => f.fact !== "full_wikitext_before" && f.fact !== "full_wikitext_after")
    .map((f) => (f.detail ? f.detail : f.fact))
    .join(", ");
  if (detail) {
    line += `\n    ${dim(detail)}`;
  }

  // Sentence and citation events hold one passage. Other events can hold a whole section.
  if (/^(sentence|citation)_/.test(event.eventType)) {
    if (event.before) line += `\n    ${dim("Before:")} ${excerpt(event.before)}`;
    if (event.after) line += `\n    ${dim("After:")}  ${excerpt(event.after)}`;
  }

  if (event.modelInterpretation) {
    const conf = event.modelInterpretation.confidence;
    const confColor = conf >= 0.7 ? green : conf >= 0.4 ? yellow : red;
    line += `\n    ${dim("\u21b3")} ${event.modelInterpretation.semanticChange} ${gray(`(${confColor(conf.toFixed(2))})`)}`;
    if (event.modelInterpretation.policyDimension) {
      line += ` ${gray(`policy: ${event.modelInterpretation.policyDimension}`)}`;
    }
  }

  return line;
}

export function status(message: string): string {
  return dim(`\u2502 ${message}`);
}

export function success(message: string): string {
  return `${green("\u2714")} ${message}`;
}

export function fail(message: string): string {
  return `${red("\u2718")} ${message}`;
}

export function table(headers: string[], rows: string[][], align: ("left" | "right")[] = []): string {
  const colWidths = headers.map((h, i) => {
    const dataWidths = rows.map((r) => (r[i] ?? "").length);
    return Math.max(h.length, ...dataWidths);
  });

  const pad = (text: string, width: number, a: "left" | "right") =>
    a === "right" ? text.padStart(width) : text.padEnd(width);

  const sep = colWidths.map((w) => "\u2500".repeat(w + 2)).join("\u253c");

  const headerRow = bold(headers.map((h, i) => pad(h, colWidths[i], align[i] ?? "left")).join(` ${dim("\u2502")} `));
  const dataRows = rows.map((row) =>
    row.map((cell, i) => pad(cell, colWidths[i], align[i] ?? "left")).join(` ${dim("\u2502")} `),
  );

  return [headerRow, sep, ...dataRows].join("\n");
}

// The logo's rays in one line of text: focus falls behind the retina, in front of
// it, splits onto it, then lands on it.
const FOCUSED_FRAME = ")>   \u2022 ";
const FOCUS_FRAMES = [")>   |\u00b7", ")> \u00b7 | ", ")>   : ", FOCUSED_FRAME];
const FRAME_MS = 350;

function paintFrame(frame: string): string {
  return frame
    .split(/([\u00b7:\u2022])/)
    .map((part, i) => (i % 2 === 1 ? yellow(part) : gray(part)))
    .join("");
}

type SpinnerStream = { write(text: string): unknown; isTTY?: boolean; columns?: number };

/**
 * Draws on stderr, so `--json` on stdout stays clean. Off a terminal it prints
 * the message once. It can only tick while the event loop is free, so wrap
 * waiting on I/O, not synchronous work.
 */
export function spinner(stream: SpinnerStream = process.stderr): {
  start(msg: string): void;
  /** Finish: keep the message, beside the focused frame. */
  land(): void;
  /** Abandon: clear the line, because whatever it was waiting for failed. */
  stop(): void;
} {
  let interval: ReturnType<typeof setInterval> | null = null;
  let currentMsg = "";

  // Parks the cursor at column 0, so a retry warning printed mid-fetch replaces
  // the frame instead of trailing it. Clipping keeps the line from wrapping,
  // since only the last row of a wrapped line could be cleared.
  function draw(frame: string) {
    const room = stream.columns ? stream.columns - frame.length - 1 : undefined;
    stream.write(`\r\x1b[2K${paintFrame(frame)} ${currentMsg.slice(0, room)}\r`);
  }

  function halt() {
    if (interval) clearInterval(interval);
    interval = null;
  }

  return {
    start(msg: string) {
      currentMsg = msg;
      if (!stream.isTTY) {
        stream.write(`${msg}\n`);
        return;
      }
      let frameIdx = 0;
      const tick = () => {
        draw(FOCUS_FRAMES[frameIdx] ?? FOCUSED_FRAME);
        frameIdx = (frameIdx + 1) % FOCUS_FRAMES.length;
      };
      tick();
      interval = setInterval(tick, FRAME_MS);
      interval.unref();
    },
    land() {
      halt();
      if (stream.isTTY) stream.write(`\r\x1b[2K${paintFrame(FOCUSED_FRAME)} ${currentMsg}\n`);
    },
    stop() {
      halt();
      if (stream.isTTY) stream.write("\r\x1b[2K");
    },
  };
}
