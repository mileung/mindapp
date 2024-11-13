import path from 'path';
import Ajv from 'ajv';
import { isFile, parseFile, touchIfDne, writeObjectFile } from '../utils/files';
import { sortUniArr } from '../utils/tags';
import { WorkingDirectory } from './WorkingDirectory';
import { day } from '../utils/time';
import { Personas } from './Personas';
import { verifyItem } from '../utils/security';
import { drizzleClient } from '../db';
import { thoughtsTable, votesTable } from '../db/schema';
import { and, asc, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import env from '../utils/env';
import { localApiHost } from '../utils/api';
import { Vote } from './Vote';

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

	constructor(
		{
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
		},
		write?: boolean,
	) {
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
		if (write) this.write();
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

	async getRootThought(): Promise<Thought> {
		if (!this.parentId) return this;
		const parentThought = await Thought.query(this.parentId);
		if (!parentThought) return this; // TODO: show missing parent on UI
		return parentThought.getRootThought();
	}

	get mentionedIds() {
		return [...` ${this.content} `.matchAll(thoughtIdsRegex)].map((match) => match[0].trim());
	}

	get id() {
		return Thought.calcId(this.createDate, this.authorId, this.spaceHost);
	}

	get filePath() {
		return Thought.calcFilePath(this.createDate, this.authorId, this.spaceHost);
	}

	get reactions() {
		// reactions: Record<string, number>; // emoji, personaId
		return {};
	}

	async expand(voterId?: string) {
		const allMentionedIds = [...this.mentionedIds];
		const allAuthorIds = [this.authorId];
		this.votes = await this.getVotes(voterId);
		this.children = await Promise.all(
			(
				await drizzleClient
					.select()
					.from(thoughtsTable)
					.where(eq(thoughtsTable.parentId, this.id))
					// .limit(8)
					// .offset(0)
					// TODO: make asc an option
					.orderBy((false ? asc : desc)(thoughtsTable.createDate))
			).map(async (row) => {
				const child = new Thought(row);
				const expansion = await child.expand(voterId);
				allMentionedIds.push(...child.mentionedIds, ...expansion.allMentionedIds);
				allAuthorIds.push(...expansion.allAuthorIds);
				return child;
			}),
		);
		return {
			clientProps: this.clientProps,
			allMentionedIds,
			allAuthorIds: [...new Set(allAuthorIds)],
		};
	}

	async getVotes(voterId?: string) {
		const [[own], [voteCount]] = await Promise.all([
			!voterId
				? []
				: drizzleClient
						.select({ up: votesTable.up })
						.from(votesTable)
						.where(Vote.makeVoteFilter(this.id, voterId)),
			drizzleClient
				.select({
					up: sql<number>`count(case when up then 1 end)`,
					down: sql<number>`count(case when up is null then 1 end)`,
				})
				.from(votesTable)
				.where(Vote.makeVoteFilter(this.id)),
		]);

		return {
			own: own === undefined ? undefined : !!own.up,
			up: voteCount.up || undefined,
			down: voteCount.down || undefined,
		};
	}

	signAsAuthor() {
		this.signature = this.authorId
			? Personas.get().getSignature(this.signedProps, this.authorId)
			: '';
	}

	verifySignature() {
		if (this.authorId) {
			if (this.content) {
				if (this.signature) {
					const valid = verifyItem(this.signedProps, this.authorId, this.signature);
					if (!valid) {
						// this.signAsAuthor();
						// this.overwrite();
						throw new Error('Invalid signature');
					}
				} else {
					// this.signAsAuthor();
					// this.overwrite();
					throw new Error('signature missing');
				}
			} else if (this.signature) {
				console.log('Unnecessary signature', this);
			}
		}
	}

	async hasUserInteraction() {
		// TODO: this can be optimized with a join right?
		const [[vote], [childOrMention]] = await Promise.all([
			drizzleClient.select().from(votesTable).where(Vote.makeVoteFilter(this.id)).limit(1),
			drizzleClient
				.select()
				.from(thoughtsTable)
				.where(
					or(
						eq(thoughtsTable.parentId, this.id), //
						like(thoughtsTable.content, `%${this.id}%`),
					),
				)
				.limit(1),
		]);

		return !!childOrMention || !!vote;
	}

	async write() {
		if (!env.GLOBAL_HOST) {
			const successfulTouch = touchIfDne(this.filePath, JSON.stringify(this.savedProps));
			if (!successfulTouch) throw new Error('filePath taken');
		}
		const existingThought = await Thought.query(this.id);
		if (existingThought) throw new Error('thoughtId taken');
		return this.addToDb();
	}

	async overwrite() {
		!env.GLOBAL_HOST && writeObjectFile(this.filePath, this.savedProps);
		return await drizzleClient
			.update(thoughtsTable)
			.set(this.dbColumns)
			.where(Thought.parseIdFilter(this.id));
	}

	async addToDb() {
		return await drizzleClient // QUESTION: Why does removing async and await make this not work?
			.insert(thoughtsTable)
			.values(this.dbColumns);
	}

	async removeFromDb() {
		const res = await drizzleClient // same here
			.delete(thoughtsTable)
			.where(Thought.parseIdFilter(this.id));
		// console.log('this.id:', this.id);
		// console.log('res:', res);
		return res;
	}

	static async query(id: string) {
		const [row] = await drizzleClient
			.select()
			.from(thoughtsTable)
			.where(Thought.makeIdFilter(id))
			.limit(1);
		return row ? new Thought(row) : null;
	}

	static parseIdFilter(id: string) {
		return Thought.makeIdFilter(id);
	}

	static makeIdFilter(id: string) {
		const [createDate, authorId, spaceHost] = id.split('_', 3);
		return and(
			eq(thoughtsTable.createDate, +createDate),
			authorId //
				? eq(thoughtsTable.authorId, authorId)
				: isNull(thoughtsTable.authorId),
			spaceHost //
				? eq(thoughtsTable.spaceHost, spaceHost)
				: isNull(thoughtsTable.spaceHost),
		);
	}

	static read(filePath: string) {
		const fileName = path.basename(filePath, path.extname(filePath));
		const [createDate, authorId, spaceHost] = parseSafeFilename(fileName).split('_');
		return new Thought({
			...parseFile<Thought>(filePath),
			createDate: +createDate,
			authorId,
			spaceHost,
		});
	}

	static calcId(createDate: number, authorId = '', spaceHost = '') {
		spaceHost = spaceHost === localApiHost ? '' : spaceHost;
		return `${createDate}_${authorId}_${spaceHost}`;
	}

	static calcFilePath(createDate: number, authorId: string, spaceHost: string) {
		const daysSince1970 = +createDate / day;
		return path.join(
			WorkingDirectory.current.timelinePath,
			Math.floor(daysSince1970 / 10000) * 10000 + '', // 27.38 years
			Math.floor(daysSince1970 / 1000) * 1000 + '',
			Math.floor(daysSince1970 / 100) * 100 + '',
			Math.floor(daysSince1970 / 10) * 10 + '',
			Math.floor(daysSince1970) + '',
			`${makeSafeFilename(Thought.calcId(createDate, authorId, spaceHost))}.json`,
		);
	}
}

function makeSafeFilename(name: string) {
	return name //
		.replace('.', '_dot_')
		.replace(':', '_colon_');
}

function parseSafeFilename(name: string) {
	return name //
		.replace('_dot_', '.')
		.replace('_colon_', ':');
}
