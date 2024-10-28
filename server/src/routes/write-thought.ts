import { RequestHandler } from 'express';
import { Thought } from '../types/Thought';
import { debouncedSnapshot } from '../utils/git';
import { Personas } from '../types/Personas';
import env from '../utils/env';
import { inGroup } from '../db';
import { second } from '../utils/time';
import { Author } from '../types/Author';

const writeThought: RequestHandler = async (req, res) => {
	// return res.send({});
	const { message } = req.body as {
		message: { from?: string; thought: { signature: string } & Thought['signedProps'] };
		fromSignature?: string;
	};
	// console.log('message:', message);
	// console.log('thought:', message.thought);
	if (env.GLOBAL_HOST && !message.from) throw new Error('Anon cannot write in global spaces');
	if ((message.from || '') !== (message.thought.authorId || '')) {
		throw new Error('message sender and thought author do not match');
	}

	const fromExistingMember = await inGroup(message.from);
	if (fromExistingMember?.frozen) throw new Error('Frozen persona');
	if (env.GLOBAL_HOST && !env.ANYONE_CAN_JOIN && !fromExistingMember) {
		throw new Error('Access denied');
	}
	if (!message.thought.content) {
		throw new Error('No message.thought.content');
	}
	if (env.CONTENT_LIMIT && (message.thought.content || '').length > env.CONTENT_LIMIT) {
		throw new Error('message.thought.content exceeds limit');
	}
	if (env.TAG_LIMIT && JSON.stringify(message.thought.tags || []).length > env.TAG_LIMIT) {
		throw new Error('message.thought.tags exceeds limit');
	}
	if ((message.thought.authorId || '') !== (message.from || '')) {
		throw new Error('message.from is not message.thought.authorId');
	}

	let newThought: Thought;

	const oldThought = await Thought.query(
		Thought.calcId(
			//
			message.thought.createDate,
			message.thought.authorId,
			message.thought.spaceHost,
		),
	);
	// console.log('oldThought:', oldThought);
	if (oldThought) {
		if (env.GLOBAL_HOST && (await oldThought.hasUserInteraction())) {
			// TODO: make this atomic with the overwrite
			// TODO: allow edits if all the interactions were by the same author
			throw new Error('Global thoughts with user interaction cannot be edited');
		}
		newThought = new Thought({
			...oldThought,
			content: message.thought.content,
			tags: message.thought.tags,
			signature: message.thought.signature,
		});
		newThought.overwrite();
	} else {
		const now = Date.now();
		if (now < message.thought.createDate || now - message.thought.createDate > 10 * second) {
			throw new Error('createDate out of sync');
		}
		newThought = new Thought(message.thought, true);
	}

	const mentionedThoughts: Record<string, Thought> = {};
	const authors: Record<string, Author['clientProps']> = {};
	const authorIds = new Set<string>();
	await Promise.all(
		[...newThought.mentionedIds].map((id) => {
			return Thought.query(id).then((thought) => {
				if (thought) {
					mentionedThoughts[id] = thought;
					authorIds.add(mentionedThoughts[id].authorId);
				}
			});
		}),
	);

	authorIds.delete('');
	await Promise.all(
		[...authorIds].map((id) => {
			if (id) return Personas.getAuthor(id).then((a) => a && (authors[id] = a));
		}),
	);

	res.send({ authors, mentionedThoughts, thought: newThought.clientProps });
	debouncedSnapshot();
};

export default writeThought;
