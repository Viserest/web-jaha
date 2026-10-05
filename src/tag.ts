
export type Node = Element | string | number;

export class Element {
	public name: string;
	public attributes: Record<string, string>;
	public children: Node[];
	constructor(name: string) {
		this.name = name;
		this.attributes = {};
		this.children = [];
		return this;
	}
	// Single attribute
	attr(key: string, value: string): Element {
		if (this.attributes[key]) {
			this.attributes[key] = this.attributes[key] + " " + value;
		}
		else {
			this.attributes[key] = value;
		}
		return this;
	}
	// Many attributes
	attrs(entries: Record<string, string>): Element {
		for (const [key, value] of Object.entries(entries)) {
			this.attr(key, value);
		}
		return this;
	}
	// Push child
	appendChild(child: Node): Element {
		this.children.push(child);
		return this;
	}
	// Push children
	appendChildren(...children: Node[]): Element {
		this.children.push(...children);
		return this;
	}
	// Query for a certain tag
	queryAll(name: string): Element[] {
		const found: Element[] = [];
		for (const child of this.children) {
			// Only search elements
			if (child instanceof Element) {
				// If child has tag name then add to found list
				if (child.name === name) found.push(child);
				// Search all of its children too
				const found_inner = child.queryAll(name);
				if (found_inner != null) found.push(...found_inner);
			}
		}
		return found;
	}
	// Get as string
	toString(): string {
    const attributes = Object.entries(this.attributes)
      .map(([key, value]) => ` ${key}="${value}"`)
      .join("");
    const children = this.children.map(String).join("");
    return `<${this.name}${attributes}>${children}</${this.name}>`;
  }
}

export function tag(name: string, ...children: Node[]): Element {
	let result = new Element(name);
	result.appendChildren(...children);
	return result;
}
