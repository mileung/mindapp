import { RequestHandler } from 'express';
import TagTree from '../types/TagTree';

const getTagTree: RequestHandler = (req, res) => {
	res.send(TagTree.get());
};

export default getTagTree;
