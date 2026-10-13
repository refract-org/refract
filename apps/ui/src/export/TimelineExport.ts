import type { EvidenceEvent } from "../types.js";

export type ExportFormat = "json" | "jsonl" | "csv";

const FORMATS: [ExportFormat, string][] = [
	["json", "JSON"],
	["jsonl", "JSONL"],
	["csv", "CSV"],
];

export class TimelineExport {
	private container: HTMLElement;
	private events: EvidenceEvent[] = [];

	constructor(container: HTMLElement) {
		this.container = container;
		this.render();
	}

	setData(events: EvidenceEvent[]): void {
		this.events = events;
	}

	private render(): void {
		this.container.innerHTML = "";

		// One export action with a format choice, instead of a button per format.
		const format = document.createElement("select");
		format.setAttribute("aria-label", "Export format");
		for (const [value, label] of FORMATS) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = label;
			format.appendChild(option);
		}

		const exportBtn = document.createElement("button");
		exportBtn.type = "button";
		exportBtn.className = "export-btn";
		exportBtn.textContent = "Export";
		exportBtn.addEventListener("click", () =>
			this.export(format.value as ExportFormat),
		);

		this.container.appendChild(format);
		this.container.appendChild(exportBtn);

		const exportStatus = document.createElement("span");
		exportStatus.id = "export-status";
		exportStatus.style.cssText =
			"font-size:0.72rem;color:var(--text-dim);margin-left:0.5rem;display:none;";
		this.container.appendChild(exportStatus);
	}

	private export(format: ExportFormat): void {
		if (this.events.length === 0) {
			const status = document.getElementById("export-status");
			if (status) {
				status.textContent = "No data to export.";
				status.style.color = "var(--red)";
				status.style.display = "inline";
				setTimeout(() => {
					status.style.display = "none";
				}, 3000);
			}
			return;
		}

		let content: string;
		let mimeType: string;
		let extension: string;

		switch (format) {
			case "json":
				content = JSON.stringify(this.events, null, 2);
				mimeType = "application/json";
				extension = "json";
				break;
			case "jsonl":
				content = this.events.map((e) => JSON.stringify(e)).join("\n");
				mimeType = "application/jsonl";
				extension = "jsonl";
				break;
			case "csv": {
				const headers = [
					"eventType",
					"timestamp",
					"section",
					"fromRevisionId",
					"toRevisionId",
					"claimId",
					"layer",
					"before",
					"after",
				];
				const rows = this.events.map((e) =>
					headers
						.map((h) => {
							const val = (e as unknown as Record<string, unknown>)[h];
							if (val === undefined || val === null) return "";
							const str = String(val);
							return str.includes(",") ||
								str.includes('"') ||
								str.includes("\n")
								? `"${str.replace(/"/g, '""')}"`
								: str;
						})
						.join(","),
				);
				content = [headers.join(","), ...rows].join("\n");
				mimeType = "text/csv";
				extension = "csv";
				break;
			}
		}

		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `refract-timeline.${extension}`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
}
