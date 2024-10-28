import { and, asc, desc, eq, gte, like, lte, or } from 'drizzle-orm';
import { RequestHandler } from 'express';
import { drizzleClient, inGroup } from '../db';
import { votesTable } from '../db/schema';
import { Personas } from '../types/Personas';
import { Vote } from '../types/Vote';
import env from '../utils/env';
import { Author } from '../types/Author';

const votesPerLoad = 333;
const getVotes: RequestHandler = async (req, res) => {
	console.time('query time');
	const {
		message: { from, thoughtId, oldToNew, votesBeyond },
	} = req.body as {
		message: { from: string; thoughtId: string; oldToNew: boolean; votesBeyond: number };
	};

	const fromExistingMember = await inGroup(from);
	if (env.GLOBAL_HOST && !env.ANYONE_CAN_JOIN && !fromExistingMember) {
		throw new Error('Access denied');
	}
	if (fromExistingMember?.frozen) throw new Error('Frozen persona');

	const votes: Vote['clientProps'][] = [];
	const voterIds = new Set<string>();
	const authors: Record<string, Author['clientProps']> = {};

	const rows = await drizzleClient
		.select()
		.from(votesTable)
		.where(
			and(Vote.makeVoteFilter(thoughtId), (oldToNew ? gte : lte)(votesTable.voteDate, votesBeyond)),
		)
		.orderBy((oldToNew ? asc : desc)(votesTable.voteDate))
		.limit(votesPerLoad);

	rows.forEach((row) => {
		votes.push(new Vote(row).clientProps);
		voterIds.add(row.voterId);
	});

	voterIds.delete('');
	await Promise.all(
		[...voterIds].map((id) => {
			if (id) return Personas.getAuthor(id).then((a) => a && (authors[id] = a));
		}),
	);
	res.send({ authors, votes });
	console.timeEnd('query time');
};

export default getVotes;
