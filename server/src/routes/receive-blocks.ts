import { RequestHandler } from 'express';
import { Personas } from '../types/Personas';
import { debouncedSnapshot } from '../utils/git';

const receiveBlocks: RequestHandler = async (req, res) => {
	const { personaId } = req.body as { personaId: string };
	await Personas.get().receiveBlocks(personaId);
	res.send({});
	debouncedSnapshot();
};

export default receiveBlocks;
