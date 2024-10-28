import { RequestHandler } from 'express';
import env from '../utils/env';

const root: RequestHandler = (req, res) => {
	res.send({ 'env.GLOBAL_HOST': env.GLOBAL_HOST });
};

export default root;
