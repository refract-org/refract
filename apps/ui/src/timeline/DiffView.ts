import type { DiffLine, EvidenceEvent } from "../types.js";

function computeWordDiff(before: string, after: string): DiffLine[] {
	const beforeWords = before.split(/(\s+)/);
	const afterWords = after.split(/(\s+)/);
	const result: DiffLine[] = [];

	let bi = 0;
	let ai = 0;

	while (bi < beforeWords.length || ai < afterWords.length) {
		if (bi >= beforeWords.length) {
			result.push({
				type: "added",
				content: afterWords.slice(ai).join(""),
				lineNumber: 0,
			});
			break;
		}
		if (ai >= afterWords.length) {
			result.push({
				type: "removed",
				content: beforeWords.slice(bi).join(""),
				lineNumber: 0,
			});
			break;
		}

		if (beforeWords[bi] === afterWords[ai]) {
			let chunk = "";
			while (
				bi < beforeWords.length &&
				ai < afterWords.length &&
				beforeWords[bi] === afterWords[ai]
			) {
				chunk += beforeWords[bi];
				bi++;
				ai++;
			}
			if (chunk)
				result.push({ type: "unchanged", content: chunk, lineNumber: 0 });
		} else {
			const bStart = bi;
			const aStart = ai;

			while (
				bi < beforeWords.length &&
				(ai >= afterWords.length || beforeWords[bi] !== afterWords[ai])
			) {
				bi++;
			}

			if (
				ai < afterWords.length &&
				bi < beforeWords.length &&
				beforeWords[bi] === afterWords[ai]
			) {
				const removed = beforeWords.slice(bStart, bi).join("");
				const added = afterWords.slice(aStart, ai).join("");
				if (removed)
					result.push({ type: "removed", content: removed, lineNumber: 0 });
				if (added)
					result.push({ type: "added", content: added, lineNumber: 0 });
			} else {
				const removed = beforeWords.slice(bStart).join("");
				const added = afterWords.slice(aStart).join("");
				if (removed)
					result.push({ type: "removed", content: removed, lineNumber: 0 });
				if (added)
					result.push({ type: "added", content: added, lineNumber: 0 });
				break;
			}
		}
	}

	return result.length > 0
		? result
		: [{ type: "unchanged", content: after || before, lineNumber: 0 }];
}

export class DiffView {
	private container: HTMLElement;
	private event: EvidenceEvent | null = null;

	constructor(container: HTMLElement) {
		this.container = container;
		this.renderEmpty();
	}

	showDiff(event: EvidenceEvent): void {
		this.event = event;
		this.render();
	}

	clear(): void {
		this.event = null;
		this.renderEmpty();
	}

	private renderEmpty(): void {
		this.container.innerHTML = "";
		const title = document.createElement("div");
		title.className = "panel-title";
		title.textContent = "Diff";
		this.container.appendChild(title);

		// The timeline selects its first listed event, so this shows only when
		// no event is loaded or none matches the filter.
		const hint = document.createElement("div");
		hint.style.cssText = "color:var(--text-dim);font-size:0.85rem;";
		hint.textContent = "No event selected.";
		this.container.appendChild(hint);
	}

	private render(): void {
		if (!this.event) {
			this.renderEmpty();
			return;
		}

		const event = this.event;
		this.container.innerHTML = "";

		const title = document.createElement("div");
		title.className = "panel-title";
		title.textContent = `Diff · r${event.fromRevisionId} → r${event.toRevisionId}`;
		this.container.appendChild(title);

		const sectionInfo = document.createElement("div");
		sectionInfo.style.cssText =
			"font-size:0.78rem;color:var(--text-dim);margin-bottom:0.5rem;font-family:var(--mono);";
		sectionInfo.textContent = event.section || "(no section)";
		this.container.appendChild(sectionInfo);

		const diffLines = computeWordDiff(event.before, event.after);

		const diffContainer = document.createElement("div");
		diffContainer.className = "diff-container";

		for (const line of diffLines) {
			const el = document.createElement("span");
			if (line.type === "added") {
				el.className = "diff-word-added";
			} else if (line.type === "removed") {
				el.className = "diff-word-removed";
			}
			el.textContent = line.content;
			diffContainer.appendChild(el);
		}

		this.container.appendChild(diffContainer);

		const labels = document.createElement("div");
		labels.className = "diff-legend";
		labels.innerHTML =
			'<span style="color:var(--red)">⬤ Removed</span><span style="color:var(--green)">⬤ Added</span>';
		this.container.appendChild(labels);
	}
}
