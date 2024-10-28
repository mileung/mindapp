import { RequestHandler } from 'express';
import { drizzleClient, inGroup } from '../db';
import { votesTable } from '../db/schema';
import { second } from '../utils/time';
import { verifyItem } from '../utils/security';
import env from '../utils/env';
import { and, eq } from 'drizzle-orm';
import { SignedVote, Vote } from '../types/Vote';
import { tokenNetwork } from '../types/TokenNetwork';
import Big from 'big.js';
import { Thought } from '../types/Thought';

const voteOnThought: RequestHandler = async (req, res) => {
	const { message } = req.body as {
		message: {
			from: string;
			replace: boolean;
			signedVote: SignedVote;
		};
	};
	// console.log('message:', message);
	if (!env.GLOBAL_HOST) throw new Error('!env.GLOBAL_HOST');
	const { signedVote } = message;
	const vote = new Vote(signedVote);
	if (!vote.signature) throw new Error('Unsigned vote');
	const now = Date.now();
	if (now < vote.voteDate || now - vote.voteDate > 10 * second) {
		throw new Error('voteDate out of sync');
	}
	if (vote.voterId !== message.from) throw new Error('vote not from sender');
	const fromAuthor = await inGroup(message.from);
	if (!fromAuthor) throw new Error('Access denied');
	if (fromAuthor?.frozen) throw new Error('Frozen persona');
	const toAuthorId = vote.thoughtAuthorId;
	const toAuthor = await inGroup(toAuthorId);
	if (!toAuthor) throw new Error('toAuthor dne');

	if (env.TOKEN_ID) {
		if (!vote.txHash) throw new Error('Missing tx hash');
		const block = await tokenNetwork.getBlock(vote.txHash);
		// console.log('block:', block);
		if (block.fromAddress !== fromAuthor.walletAddress) {
			throw new Error('Token sender is not from voter');
		}
		if (Big(block.amount).lt(1)) throw new Error('Insufficient amount sent to vote');
		if (vote.up) {
			if (block.toAddress !== toAuthor.walletAddress)
				throw new Error('Token sent to wrong address');
		} else if (block.toAddress !== env.DOWNVOTE_ADDRESS) {
			throw new Error('Token sent to wrong downvote address');
		}
	}

	if (message.replace) {
		if (!env.DELETABLE_VOTES) throw new Error('Votes cannot be deleted in this space');
		const thing = await drizzleClient
			.update(votesTable)
			.set(vote.dbColumns)
			.where(
				Vote.makeVoteFilter(
					Thought.calcId(vote.thoughtCreateDate, vote.thoughtAuthorId, vote.thoughtSpaceHost),
					message.from,
				),
			);
		if (!thing.rowsAffected) throw new Error('No vote to replace');
		// console.log('thing:', thing);
	} else {
		const stuff = await drizzleClient.insert(votesTable).values(vote.dbColumns);
		// console.log('stuff:', stuff);
	}

	res.send({});
};

export default voteOnThought;
