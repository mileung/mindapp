import { RequestHandler } from 'express';

export const getFile: RequestHandler = (req, res, next) => {
	const { filePath } = req.params;
	// TODO: idk when I'll need this
	res.sendFile(filePath, (err) => next(err));
};
