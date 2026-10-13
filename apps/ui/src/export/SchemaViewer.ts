export class SchemaViewer {
	private container: HTMLElement;
	private events: Record<string, unknown>[] = [];

	constructor(container: HTMLElement) {
		this.container = container;
		this.render();
	}

	setData(events: Record<string, unknown>[]): void {
		this.events = events;
		this.render();
	}

	render(): void {
		this.container.innerHTML = "";

		const title = document.createElement("div");
		title.className = "panel-title";
		title.textContent = "Event schema";
		this.container.appendChild(title);

		if (this.events.length === 0) {
			const empty = document.createElement("div");
			empty.style.cssText =
				"color:var(--text-dim);font-size:0.85rem;padding:1rem 0;";
			empty.textContent = "Upload data to inspect schema.";
			this.container.appendChild(empty);
			return;
		}

		const keys = this.collectKeys();
		const infos = new Map(keys.map((key) => [key, this.getTypeInfo(key)]));
		const allPresent = [...infos.values()].every((i) => i.inEveryEvent);

		const schema = document.createElement("div");
		schema.className = "schema-viewer";

		// Presence is stated once for the fields every event carries; only the
		// fields some events lack show their share.
		const headerEl = document.createElement("div");
		headerEl.style.cssText =
			"color:var(--text-dim);margin-bottom:0.5rem;font-weight:600;";
		headerEl.textContent = `${this.events.length} events, ${keys.length} fields. ${
			allPresent
				? "Every field is present in every event."
				: "Fields without a percentage are present in every event."
		}`;
		schema.appendChild(headerEl);

		// One grid for every field, so name, type and presence line up across
		// rows whether or not a row has a presence cell.
		const fields = document.createElement("div");
		fields.className = "schema-fields";

		for (const [key, typeInfo] of infos) {
			const keyName = document.createElement("span");
			keyName.className = "schema-key";
			keyName.textContent = key;
			fields.appendChild(keyName);

			const typeName = document.createElement("span");
			typeName.textContent = typeInfo.type;
			fields.appendChild(typeName);

			if (!typeInfo.inEveryEvent) {
				const presence = document.createElement("span");
				presence.textContent = `${typeInfo.presence}% present`;
				fields.appendChild(presence);
			}
		}

		schema.appendChild(fields);
		this.container.appendChild(schema);
	}

	private collectKeys(): string[] {
		const keySet = new Set<string>();
		for (const event of this.events) {
			for (const key of Object.keys(event)) {
				keySet.add(key);
			}
		}
		const keys = Array.from(keySet);
		keys.sort();
		return keys;
	}

	private getTypeInfo(key: string): {
		type: string;
		presence: number;
		inEveryEvent: boolean;
	} {
		let present = 0;
		const types = new Set<string>();

		for (const event of this.events) {
			if (key in event) {
				present++;
				const val = event[key];
				if (val === null) types.add("null");
				else if (Array.isArray(val)) types.add("array");
				else types.add(typeof val);
			}
		}

		const typeStr = Array.from(types).join(" | ");
		const inEveryEvent = present === this.events.length;
		// A field missing from some events never rounds up to 100%.
		const pct = inEveryEvent
			? 100
			: Math.min(99, Math.round((present / this.events.length) * 100));
		return { type: typeStr, presence: pct, inEveryEvent };
	}
}
