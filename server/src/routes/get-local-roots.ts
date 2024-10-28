import { RequestHandler } from 'express';

const entrance: RequestHandler = (req, res) => {
	res.redirect('/get-roots');
};

export default entrance;
