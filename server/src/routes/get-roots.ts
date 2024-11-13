import { and, asc, desc, eq, gte, isNull, like, lte, or } from 'drizzle-orm';
import { RequestHandler } from 'express';
import { drizzleClient, inGroup } from '../db';
import { thoughtsTable } from '../db/schema';
import { Personas } from '../types/Personas';
import { Thought } from '../types/Thought';
import env from '../utils/env';
import { Author } from '../types/Author';

type Query = {
	mode: 'new' | 'old';
	thoughtId?: string;
	authorIds?: string[];
	tags?: string[];
	other?: string[];
};

type ResultsQuery = Query & {
	ignoreRootIds: string[];
	thoughtsBeyond: number;
};

const getRoots: RequestHandler = async (req, res) => {
	console.time('query time');
	const {
		message: {
			from,
			query: { thoughtId, authorIds, tags = [], other = [], mode, ignoreRootIds, thoughtsBeyond },
		},
	} = req.body as { message: { from: string; query: ResultsQuery } };

	const fromExistingMember = await inGroup(from);
	if (env.GLOBAL_HOST && !env.ANYONE_CAN_JOIN && !fromExistingMember) {
		throw new Error('Access denied');
	}
	if (fromExistingMember?.frozen) throw new Error('Frozen persona');

	const oldToNew = mode === 'old';
	const excludeIds = new Set(ignoreRootIds);
	const roots: Thought['clientProps'][] = [];
	const mentionedThoughtIds = new Set<string>();
	const allAuthorIdsSet = new Set<string>();
	const mentionedThoughts: Record<string, Thought> = {};
	const authors: Record<string, Author['clientProps']> = {};
	let latestCreateDate = oldToNew ? 0 : Number.MAX_SAFE_INTEGER;
	const rootsPerLoad = 8;

	if (thoughtId && !ignoreRootIds.length) {
		const thought = await Thought.query(thoughtId);
		if (!thought) {
			res.send({ mentionedThoughts: {}, roots: [] });
			return;
		}

		const rootThought = await thought.getRootThought();
		const { clientProps, allMentionedIds, allAuthorIds } = await rootThought.expand(from);
		allMentionedIds.forEach((id) => mentionedThoughtIds.add(id));
		allAuthorIds.forEach((id) => allAuthorIdsSet.add(id));
		roots.push(clientProps);
	}

	let offset = 0;
	while (true) {
		const [currentRow] = await drizzleClient
			.select()
			.from(thoughtsTable)
			.where(
				and(
					or(
						...(authorIds || []).map((id) =>
							id ? eq(thoughtsTable.authorId, id) : isNull(thoughtsTable.authorId),
						),
					),
					thoughtId
						? like(thoughtsTable.content, `%${thoughtId}%`)
						: or(
								...tags.map((tag) => like(thoughtsTable.tags, `%"${tag}"%`)),
								...other.map((term) => like(thoughtsTable.content, `%${term}%`)),
							),

					(oldToNew ? gte : lte)(thoughtsTable.createDate, thoughtsBeyond),
				),
			)
			.orderBy((oldToNew ? asc : desc)(thoughtsTable.createDate))
			.limit(1)
			.offset(offset++);

		if (!currentRow) break;
		const rootThought = await new Thought(currentRow).getRootThought();
		if (
			!excludeIds.has(rootThought.id) &&
			!roots.find((root) => new Thought(root).id === rootThought.id)
		) {
			const { clientProps, allMentionedIds, allAuthorIds } = await rootThought.expand(from);
			allMentionedIds.forEach((id) => mentionedThoughtIds.add(id));
			allAuthorIds.forEach((id) => allAuthorIdsSet.add(id));
			roots.push(clientProps);
		}
		latestCreateDate = (oldToNew ? Math.max : Math.min)(latestCreateDate, currentRow.createDate);
		if (roots.length === rootsPerLoad) {
			break;
		}
	}

	await Promise.all(
		[...mentionedThoughtIds].map((id) => {
			return Thought.query(id).then((thought) => {
				if (thought) {
					mentionedThoughts[id] = thought;
					allAuthorIdsSet.add(mentionedThoughts[id].authorId);
				}
			});
		}),
	);

	allAuthorIdsSet.delete('');
	await Promise.all(
		[...allAuthorIdsSet].map((id) => {
			if (id) return Personas.getAuthor(id).then((a) => a && (authors[id] = a));
		}),
	);
	res.send({ latestCreateDate, authors, mentionedThoughts, roots });
	// console.log('roots:', roots);
	console.timeEnd('query time');
};

export default getRoots;
