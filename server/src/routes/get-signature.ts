import { RequestHandler } from 'express';
import { Personas } from '../types/Personas';
import { Item } from '../utils/security';

const getSignature: RequestHandler = (req, res) => {
	const { item, personaId } = req.body as { item: Item; personaId: string };
	res.send({
		signature: Personas.get().getSignature(item, personaId),
	});
};

export default getSignature;
