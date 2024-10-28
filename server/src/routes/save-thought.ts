import { RequestHandler } from 'express';
import { Thought } from '../types/Thought';
import { debouncedSnapshot } from '../utils/git';
import { addTagsByLabel } from '../utils/tags';

const saveThought: RequestHandler = async (req, res) => {
	// return res.send({});
	const { thought } = req.body as {
		thought: Thought;
	};

	const newThought = new Thought(thought);
	if (await Thought.query(newThought.id)) {
		newThought.overwrite();
	} else {
		newThought.write();
	}
	addTagsByLabel(newThought.tags.filter((tag) => !tag.includes('@')));
	res.send({});
	debouncedSnapshot();
};

export default saveThought;
