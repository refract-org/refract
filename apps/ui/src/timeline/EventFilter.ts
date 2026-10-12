import type { EventType } from "../types.js";

export interface EventFilterOptions {
	container: HTMLElement;
	allTypes: EventType[];
	onChange: (activeTypes: Set<EventType>) => void;
}

export class EventFilter {
	private container: HTMLElement;
	private allTypes: EventType[];
	private activeTypes: Set<EventType>;
	private onChange: (activeTypes: Set<EventType>) => void;

	constructor(opts: EventFilterOptions) {
		this.container = opts.container;
		this.allTypes = opts.allTypes;
		this.activeTypes = new Set(opts.allTypes);
		this.onChange = opts.onChange;
		this.render();
	}

	setTypes(types: EventType[]): void {
		this.allTypes = types;
		this.activeTypes = new Set(types);
		this.render();
	}

	getActiveTypes(): Set<EventType> {
		return this.activeTypes;
	}

	toggleType(type: EventType): void {
		if (this.activeTypes.has(type)) {
			if (this.activeTypes.size > 1) {
				this.activeTypes.delete(type);
			}
		} else {
			this.activeTypes.add(type);
		}
		this.render();
		this.onChange(this.activeTypes);
	}

	selectAll(): void {
		this.activeTypes = new Set(this.allTypes);
		this.render();
		this.onChange(this.activeTypes);
	}

	clearAll(): void {
		this.activeTypes = new Set();
		this.render();
		this.onChange(this.activeTypes);
	}

	render(): void {
		this.container.innerHTML = "";

		// All and None are actions, not states: the chips already show which
		// types are on, so neither button is highlighted. Each is disabled when
		// it would change nothing.
		const selectAll = document.createElement("button");
		selectAll.type = "button";
		selectAll.textContent = "All";
		selectAll.disabled = this.activeTypes.size === this.allTypes.length;
		selectAll.addEventListener("click", () => this.selectAll());
		this.container.appendChild(selectAll);

		const clearBtn = document.createElement("button");
		clearBtn.type = "button";
		clearBtn.textContent = "None";
		clearBtn.disabled = this.activeTypes.size === 0;
		clearBtn.addEventListener("click", () => this.clearAll());
		this.container.appendChild(clearBtn);

		for (const type of this.allTypes) {
			const tag = document.createElement("button");
			tag.type = "button";
			tag.className = "filter-tag";
			const active = this.activeTypes.has(type);
			if (active) {
				tag.classList.add("active");
			}
			tag.setAttribute("aria-pressed", String(active));
			tag.textContent = formatEventTypeShort(type);
			tag.addEventListener("click", () => this.toggleType(type));
			this.container.appendChild(tag);
		}
	}
}

function formatEventTypeShort(type: EventType): string {
	return type.replace(/_/g, " ");
}
