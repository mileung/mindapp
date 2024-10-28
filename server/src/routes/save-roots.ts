import { RequestHandler } from 'express';
import { Thought } from '../types/Thought';
import { debouncedSnapshot } from '../utils/git';

const saveRoots: RequestHandler = async (req, res) => {
	// return res.send({});
	const { roots } = req.body as {
		roots: (Thought | null)[];
	};

	function processThoughts(thoughts: (Thought | null)[]): void {
		thoughts.forEach(async (thought) => {
			if (!thought) return;
			const newThought = new Thought(thought);
			if (await Thought.query(newThought.id)) {
				newThought.overwrite();
			} else {
				newThought.write();
			}
			processThoughts(thought.children || []);
		});
	}

	processThoughts(roots);

	res.send({});
	debouncedSnapshot();
};

export default saveRoots;
