import Ajv from 'ajv';
import { sortUniArr } from '../utils/tags';
import { verifyItem } from '../utils/security';
import { localApiHost } from '../utils/api';

const ajv = new Ajv({ verbose: true });

const schema = {
	type: 'object',
	properties: {
		createDate: { type: 'number' },
		authorId: { type: 'string' },
		spaceHost: { type: 'string' },
		content: { type: 'string' },
		tags: { type: 'array', items: { type: 'string' } },
		parentId: { type: 'string' },
		signature: { type: 'string' },
	},
	required: ['createDate', 'authorId', 'spaceHost', 'content'],
	additionalProperties: false,
};

const thoughtIdsRegex = /(^|\s)\d{9,}_(|[A-HJ-NP-Za-km-z1-9]{9,})_(|[\w:\.-]{3,})($|\s)/g;

export class Thought {
	public createDate: number;
	public authorId: string;
	public spaceHost: string;
	public content: string;
	public tags: string[];
	public parentId: string;
	public signature: string;
	public children?: Thought[];
	public votes?: { own?: boolean; up?: number; down?: number };

	constructor({
		createDate,
		authorId,
		spaceHost,
		content,
		tags,
		parentId,
		signature,
	}: {
		createDate: number;
		authorId?: null | string;
		spaceHost?: null | string;
		content?: null | string;
		tags?: null | string[];
		parentId?: null | string;
		signature?: null | string;
	}) {
		// save these props on disk
		this.createDate = createDate;
		this.authorId = authorId || '';
		this.spaceHost = spaceHost || '';
		this.content = (content || '').trim();
		this.tags = sortUniArr((tags || []).map((t) => t.trim()));
		this.parentId = parentId || '';
		this.signature = signature || '';

		if (!ajv.validate(schema, this)) throw new Error('Invalid Thought: ' + JSON.stringify(this));

		this.verifySignature();
	}

	get signedProps() {
		return {
			createDate: this.createDate,
			authorId: this.authorId || undefined,
			spaceHost: this.spaceHost || undefined,
			content: this.content || undefined,
			tags: this.tags.length ? this.tags : undefined,
			parentId: this.parentId || undefined,
		};
	}

	get dbColumns() {
		return {
			createDate: this.createDate,
			authorId: this.authorId || null,
			spaceHost: this.spaceHost || null,
			content: this.content || null,
			tags: this.tags.length ? this.tags : null,
			parentId: this.parentId || null,
			signature: this.signature || null,
		};
	}

	get savedProps() {
		return {
			content: this.content || undefined,
			tags: this.tags.length ? this.tags : undefined,
			parentId: this.parentId || undefined,
			signature: this.signature || undefined,
		};
	}

	get clientProps(): {
		createDate: number;
		authorId?: string;
		signature?: string;
		spaceHost?: string;
		content?: string;
		tags?: string[];
		parentId?: string;
		votes?: Thought['votes'];
		children?: Thought['clientProps'][];
	} {
		return {
			createDate: this.createDate,
			authorId: this.authorId || undefined,
			signature: this.signature || undefined,
			spaceHost: this.spaceHost || undefined,
			content: this.content || undefined,
			tags: this.tags.length ? this.tags : undefined,
			parentId: this.parentId || undefined,
			votes: this.votes || undefined,
			children: this.children?.length ? this.children.map((c) => c.clientProps) : undefined,
		} as const;
	}

	get mentionedIds() {
		return [...` ${this.content} `.matchAll(thoughtIdsRegex)].map((match) => match[0]);
	}

	get id() {
		return Thought.calcId(this.createDate, this.authorId, this.spaceHost);
	}

	get reactions() {
		// reactions: Record<string, number>; // emoji, personaId
		return {};
	}

	verifySignature() {
		if (this.authorId) {
			if (this.content) {
				if (this.signature) {
					const valid = verifyItem(this.signedProps, this.authorId, this.signature);
					if (!valid) {
						throw new Error('Invalid signature');
					}
				} else {
					throw new Error('signature missing');
				}
			} else if (this.signature) {
				console.log('Unnecessary signature', this);
			}
		}
	}

	static calcId(createDate: number, authorId = '', spaceHost = '') {
		spaceHost = spaceHost === localApiHost ? '' : spaceHost;
		return `${createDate}_${authorId}_${spaceHost}`;
	}
}
