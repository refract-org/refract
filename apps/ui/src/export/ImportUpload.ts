import { Throbber } from "../brand/Throbber.js";
import type { EvidenceEvent, EvidenceLayer } from "../types.js";
import { isEventType } from "../types.js";

const LAYER_RECORD: Record<EvidenceLayer, true> = {
	observed: true,
	policy_coded: true,
	model_interpretation: true,
	speculative: true,
	unknown: true,
};
const VALID_LAYERS = new Set<string>(Object.keys(LAYER_RECORD));

// The throbber animates on the main thread, so a long parse has to give it
// turns or it freezes on the frame it reached.
const LINES_BETWEEN_YIELDS = 2000;

export class ImportUpload {
	private container: HTMLElement;
	private onData: (events: EvidenceEvent[]) => void;

	constructor(
		container: HTMLElement,
		onData: (events: EvidenceEvent[]) => void,
	) {
		this.container = container;
		this.onData = onData;
		this.render();
	}

	private render(): void {
		this.container.innerHTML = "";

		const uploadZone = document.createElement("div");
		uploadZone.className = "upload-zone";
		uploadZone.textContent = "Upload JSONL";

		const fileInput = document.createElement("input");
		fileInput.type = "file";
		fileInput.accept = ".jsonl,.ndjson,.json";
		fileInput.style.display = "none";

		uploadZone.addEventListener("click", () => fileInput.click());
		uploadZone.addEventListener("dragover", (e) => {
			e.preventDefault();
			uploadZone.style.borderColor = "var(--accent)";
		});
		uploadZone.addEventListener("dragleave", () => {
			uploadZone.style.borderColor = "";
		});
		uploadZone.addEventListener("drop", (e) => {
			e.preventDefault();
			uploadZone.style.borderColor = "";
			const files = e.dataTransfer?.files;
			if (files && files.length > 0) {
				this.handleFile(files[0]);
			}
		});

		fileInput.addEventListener("change", () => {
			const file = fileInput.files?.[0];
			if (file) {
				this.handleFile(file);
			}
		});

		this.container.appendChild(uploadZone);
		this.container.appendChild(fileInput);

		const status = document.createElement("div");
		status.id = "import-status";
		status.style.cssText = "font-size:0.75rem;color:var(--text-dim);";
		this.container.appendChild(status);
	}

	private async handleFile(file: File): Promise<void> {
		const status = document.getElementById("import-status");
		if (!status) return;

		status.textContent = "";
		const throbber = new Throbber(status, `Reading ${file.name}`);
		throbber.start();

		try {
			const text = await file.text();
			const lines = text.split("\n").filter((l) => l.trim().length > 0);
			const events: EvidenceEvent[] = [];
			const errors: string[] = [];

			for (let i = 0; i < lines.length; i++) {
				if (i > 0 && i % LINES_BETWEEN_YIELDS === 0) {
					await new Promise((resolve) => setTimeout(resolve));
				}
				try {
					const parsed = JSON.parse(lines[i]);
					const validation = this.validateEvent(parsed);
					if (validation.valid) {
						events.push(parsed as EvidenceEvent);
					} else {
						errors.push(`Line ${i + 1}: ${validation.error}`);
					}
				} catch {
					errors.push(`Line ${i + 1}: Invalid JSON`);
				}
			}

			throbber.stop();

			if (events.length > 0) {
				status.textContent = `Imported ${events.length} events${errors.length > 0 ? ` (${errors.length} errors)` : ""}`;
				status.style.color = "var(--green)";
				this.onData(events);
			} else {
				status.textContent = "No valid events found.";
				status.style.color = "var(--red)";
			}

			if (errors.length > 0) {
				const errorList = document.createElement("div");
				errorList.style.cssText = `margin-top:0.5rem;padding:0.75rem;background:var(--red-soft);border-radius:var(--radius-sm);font-size:0.72rem;color:var(--red);max-height:8rem;overflow-y:auto;white-space:pre-wrap;line-height:1.5;`;
				errorList.textContent = errors.slice(0, 10).join("\n");
				if (errors.length > 10) {
					errorList.textContent += `\n\u2026 and ${errors.length - 10} more errors`;
				}
				status.appendChild(errorList);
			}
		} catch (err) {
			throbber.stop();
			status.textContent = `Error reading file: ${err}`;
			status.style.color = "var(--red)";
		}
	}

	private validateEvent(obj: unknown): { valid: boolean; error?: string } {
		if (!obj || typeof obj !== "object") {
			return { valid: false, error: "Not an object" };
		}

		const e = obj as Record<string, unknown>;

		if (!isEventType(e.eventType)) {
			return {
				valid: false,
				error: `Invalid or missing eventType: ${e.eventType}`,
			};
		}

		if (
			typeof e.fromRevisionId !== "number" ||
			typeof e.toRevisionId !== "number"
		) {
			return { valid: false, error: "Missing fromRevisionId or toRevisionId" };
		}

		if (
			typeof e.timestamp !== "string" ||
			Number.isNaN(new Date(e.timestamp).getTime())
		) {
			return { valid: false, error: "Invalid or missing timestamp" };
		}

		if (typeof e.section !== "string") {
			return { valid: false, error: "Missing section" };
		}

		if (typeof e.before !== "string" || typeof e.after !== "string") {
			return { valid: false, error: "Missing before or after text" };
		}

		if (
			!Array.isArray(e.deterministicFacts) ||
			e.deterministicFacts.some(
				(fact) =>
					!fact || typeof fact !== "object" || typeof fact.fact !== "string",
			)
		) {
			return { valid: false, error: "Invalid or missing deterministicFacts" };
		}

		if (e.layer && typeof e.layer === "string" && !VALID_LAYERS.has(e.layer)) {
			return { valid: false, error: `Invalid layer: ${e.layer}` };
		}

		return { valid: true };
	}
}
